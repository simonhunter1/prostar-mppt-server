var path = require("path");

var loadConfig = require("./config/env").loadConfig;
var getChargeStateName = require("./domain/chargeState").getChargeStateName;
var createTelemetryStore =
  require("./state/telemetryStore").createTelemetryStore;
var createServer = require("./app/server").createServer;
var registerCors = require("./app/server").registerCors;
var registerRoutes = require("./app/routes").registerRoutes;
var createModbusProtocol = require("./protocols/modbus").createModbusProtocol;
var createMeterbusProtocol =
  require("./protocols/meterbus").createMeterbusProtocol;
var createPoller = require("./services/poller").createPoller;
var createLiveTableRenderer = require("./ui/liveTable").createLiveTableRenderer;

function createShutdownWithError(httpServer, getProtocolHandle) {
  var isShuttingDown = false;

  return function shutdownWithError(context, error) {
    var errorMessage = error && error.message ? error.message : error;

    if (isShuttingDown) {
      if (context || errorMessage) {
        console.error(
          "[fatal] additional error during shutdown:",
          context,
          errorMessage,
        );
      }
      return;
    }

    isShuttingDown = true;
    console.error("[fatal]", context, errorMessage || "Unknown error");

    try {
      var protocolHandle = getProtocolHandle ? getProtocolHandle() : null;
      if (protocolHandle && protocolHandle.close) {
        protocolHandle.close();
      }
    } catch (_) {}

    try {
      httpServer.close(function () {
        process.exit(1);
      });
      setTimeout(function () {
        process.exit(1);
      }, 250);
    } catch (_) {
      process.exit(1);
    }
  };
}

async function start() {
  var config = loadConfig();
  var protocolName = config.protocol === "meterbus" ? "meterbus" : "modbus";

  var server = createServer();
  var app = server.app;
  var httpServer = server.httpServer;
  var io = server.io;

  var telemetryStore = createTelemetryStore();
  var protocolHandle = null;
  var shutdownWithError = createShutdownWithError(httpServer, function () {
    return protocolHandle;
  });

  var liveTable = createLiveTableRenderer({
    getChargeStateName: getChargeStateName,
    getPollCount: telemetryStore.getPollCount,
    getClientCount: function () {
      return io.engine.clientsCount;
    },
  });

  registerCors(app);
  registerRoutes(app, {
    telemetryStore: telemetryStore,
    getProtocol: function () {
      return protocolName;
    },
    getClientCount: function () {
      return io.engine.clientsCount;
    },
    indexHtmlPath: path.join(process.cwd(), "index.html"),
  });

  io.on("connect", function (socket) {
    liveTable.clear();
    console.log(
      "[socket] client connected:",
      socket.id,
      "| total clients:",
      io.engine.clientsCount,
    );

    socket.on("disconnect", function () {
      liveTable.clear();
      console.log(
        "[socket] client disconnected:",
        socket.id,
        "| total clients:",
        io.engine.clientsCount,
      );
    });
  });

  try {
    protocolHandle =
      protocolName === "meterbus"
        ? createMeterbusProtocol({
            serialPortPath: config.serialPortPath,
            meterbusConfig: config.meterbus,
          })
        : createModbusProtocol({
            serialPortPath: config.serialPortPath,
            modbusConfig: config.modbus,
            onFatal: shutdownWithError,
          });

    await protocolHandle.initialize();
  } catch (error) {
    shutdownWithError("[" + protocolName + "] failed to initialize", error);
    return;
  }

  var poller = createPoller({
    readSnapshot: protocolHandle.readSnapshot,
    onData: function (data) {
      telemetryStore.incrementPoll();
      telemetryStore.setSnapshot(data);

      if (protocolName === "meterbus") {
        liveTable.clear();
        console.log(
          "[meterbus] response bytes:",
          data.byteLength,
          "| raw hex:",
          data.rawHex,
        );
      } else {
        liveTable.clear();
        liveTable.draw(data);
      }

      io.sockets.emit("message", data);
    },
    onNoData: function () {
      telemetryStore.incrementPoll();
      console.log("[" + protocolName + "] no data returned");
    },
    onError: function (error, retryState) {
      console.error(
        "[" + protocolName + "] poll read failed, retrying:",
        error && error.message ? error.message : error,
        "| consecutiveErrors:",
        retryState.consecutiveErrors,
        "| nextBackoffMs:",
        retryState.backoffMs,
      );
    },
    onMaxConsecutiveErrors: function (error, consecutiveErrors) {
      shutdownWithError(
        "[" +
          protocolName +
          "] poll read failed too many times (" +
          consecutiveErrors +
          ")",
        error,
      );
    },
    intervalMs: config.polling.intervalMs,
    maxConsecutiveErrors: config.polling.maxConsecutiveErrors,
    backoffMaxMs: config.polling.backoffMaxMs,
  });

  poller.start();

  process.on("uncaughtException", function (error) {
    shutdownWithError("uncaught exception", error);
  });

  process.on("unhandledRejection", function (error) {
    shutdownWithError("unhandled rejection", error);
  });

  httpServer.on("error", function (error) {
    shutdownWithError("http server error", error);
  });

  httpServer.listen(config.port, function () {
    console.log("listening on *:" + config.port);
  });
}

module.exports = {
  start: start,
};
