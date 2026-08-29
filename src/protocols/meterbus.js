function parseHexBytes(hexText) {
  var cleaned = (hexText || "").replace(/[^a-fA-F0-9]/g, "");
  if (!cleaned || cleaned.length % 2 !== 0) {
    return null;
  }
  return Buffer.from(cleaned, "hex");
}

function createMeterbusProtocol(options) {
  var serialPortPath = options.serialPortPath;
  var meterbusConfig = options.meterbusConfig;

  var SerialPortCtor;
  try {
    SerialPortCtor = require("serialport").SerialPort;
  } catch (_error) {
    throw new Error(
      "[meterbus] serialport dependency not installed. Run: npm install serialport",
    );
  }

  var meterbusPort = null;
  var meterbusBuffer = Buffer.alloc(0);

  function initialize() {
    return new Promise(function (resolve, reject) {
      meterbusPort = new SerialPortCtor({
        path: serialPortPath,
        baudRate: meterbusConfig.baud,
        dataBits: meterbusConfig.dataBits,
        stopBits: meterbusConfig.stopBits,
        parity: meterbusConfig.parity,
        autoOpen: false,
      });

      meterbusPort.on("error", function (error) {
        reject(error);
      });

      meterbusPort.on("close", function () {
        console.log("[meterbus] serial port closed");
      });

      meterbusPort.on("data", function (chunk) {
        meterbusBuffer = Buffer.concat([meterbusBuffer, chunk]);
      });

      console.log(
        "[meterbus] opening serial connection on",
        serialPortPath,
        "| baud:",
        meterbusConfig.baud,
      );

      meterbusPort.open(function (error) {
        if (error) {
          reject(error);
          return;
        }

        console.log("[meterbus] serial connection established");
        resolve();
      });
    });
  }

  function readSnapshot() {
    return new Promise(function (resolve, reject) {
      if (!meterbusPort || !meterbusPort.isOpen) {
        reject(new Error("MeterBus serial port is not open"));
        return;
      }

      var requestBuffer = parseHexBytes(meterbusConfig.requestHex || "");
      if (!requestBuffer) {
        reject(
          new Error(
            "METERBUS_REQUEST_HEX is not set (example: METERBUS_REQUEST_HEX=aa010055)",
          ),
        );
        return;
      }

      meterbusBuffer = Buffer.alloc(0);

      meterbusPort.write(requestBuffer, function (writeError) {
        if (writeError) {
          reject(writeError);
          return;
        }

        setTimeout(function () {
          if (meterbusBuffer.length === 0) {
            reject(new Error("No MeterBus response bytes received"));
            return;
          }

          resolve({
            protocol: "meterbus",
            rawHex: meterbusBuffer.toString("hex"),
            byteLength: meterbusBuffer.length,
          });
        }, meterbusConfig.responseWaitMs);
      });
    });
  }

  function close() {
    try {
      if (meterbusPort && meterbusPort.isOpen) {
        meterbusPort.close();
      }
    } catch (_) {}
  }

  return {
    name: "meterbus",
    initialize: initialize,
    readSnapshot: readSnapshot,
    close: close,
  };
}

module.exports = {
  createMeterbusProtocol: createMeterbusProtocol,
};
