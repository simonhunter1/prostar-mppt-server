var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  },
});
var ModbusRTU = require("modbus-serial");

var protocol = (process.env.PROTOCOL || "modbus").toLowerCase();

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});
var connectionExists = false;
var pollLoopStarted = false;
var isShuttingDown = false;

function shutdownWithError(context, error) {
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
    if (meterbusPort && meterbusPort.isOpen) {
      meterbusPort.close();
    }
  } catch (_) {}

  try {
    modbusClient.close();
  } catch (_) {}

  try {
    http.close(function () {
      process.exit(1);
    });
    setTimeout(function () {
      process.exit(1);
    }, 250);
  } catch (_) {
    process.exit(1);
  }
}

function startPollingLoop() {
  if (pollLoopStarted) {
    return;
  }

  pollLoopStarted = true;
  console.log("[poll] polling loop started");
  setTimeout(solarStatus, 1000);
}

io.on("connect", function (socket) {
  connectionExists = true;
  console.log(
    "[socket] client connected:",
    socket.id,
    "| total clients:",
    io.engine.clientsCount,
  );
  startPollingLoop();

  socket.on("disconnect", function () {
    connectionExists = false;
    console.log(
      "[socket] client disconnected:",
      socket.id,
      "| total clients:",
      io.engine.clientsCount,
    );
  });
});
// protocol clients
var modbusClient = new ModbusRTU();
var meterbusPort = null;
var meterbusBuffer = Buffer.alloc(0);
var serialPortPath =
  process.env.SERIAL_PORT ||
  process.env.MODBUS_PORT ||
  "/dev/tty.usbserial-D20JPLBX";

modbusClient.on("error", function (error) {
  shutdownWithError("[modbus] client error", error);
});

var details = [];

// Try each baud rate in turn, and within each baud rate scan slave IDs 1-5
// at the register addresses the ProStar MPPT is known to use.
function parseIntList(input, fallback) {
  if (!input) {
    return fallback;
  }

  var values = String(input)
    .split(",")
    .map(function (entry) {
      return parseInt(entry.trim(), 10);
    })
    .filter(function (num) {
      return Number.isFinite(num);
    });

  return values.length > 0 ? values : fallback;
}

function parseAddressList(input, fallback) {
  if (!input) {
    return fallback;
  }

  var values = String(input)
    .split(",")
    .map(function (entry) {
      return parseInt(entry.trim(), 0);
    })
    .filter(function (num) {
      return Number.isFinite(num);
    });

  return values.length > 0 ? values : fallback;
}

var BAUD_RATES = parseIntList(
  process.env.MODBUS_BAUD_RATES,
  [9600, 19200, 38400],
);
var SLAVE_IDS = parseIntList(process.env.MODBUS_SLAVE_IDS, [1, 2, 3, 4, 5]);
var TEST_ADDRESSES = parseAddressList(
  process.env.MODBUS_TEST_ADDRESSES,
  [0x0008, 0x0010, 0x0000],
);

var configuredDataBits = parseInt(process.env.MODBUS_DATABITS || "8", 10);
var configuredStopBits = process.env.MODBUS_STOPBITS
  ? parseInt(process.env.MODBUS_STOPBITS, 10)
  : null;
var configuredParity = process.env.MODBUS_PARITY || null;
var configuredTimeout = parseInt(process.env.MODBUS_TIMEOUT_MS || "3000", 10);

var SERIAL_PROFILES =
  configuredParity || configuredStopBits
    ? [
        {
          dataBits: Number.isFinite(configuredDataBits)
            ? configuredDataBits
            : 8,
          parity: configuredParity || "none",
          stopBits: Number.isFinite(configuredStopBits)
            ? configuredStopBits
            : configuredParity === "none"
              ? 2
              : 1,
        },
      ]
    : [
        { dataBits: 8, parity: "none", stopBits: 2 },
        { dataBits: 8, parity: "even", stopBits: 1 },
        { dataBits: 8, parity: "none", stopBits: 1 },
      ];

function formatScanContext(baudRate, profile) {
  return (
    "baud=" +
    baudRate +
    ", dataBits=" +
    profile.dataBits +
    ", parity=" +
    profile.parity +
    ", stopBits=" +
    profile.stopBits
  );
}

function isModbusExceptionResponse(error) {
  if (!error) {
    return false;
  }

  // Exception code means the controller did answer, even if the probed function/address is invalid.
  var modbusCode =
    typeof error.modbusCode === "number" ? error.modbusCode : error.errno;

  return modbusCode >= 1 && modbusCode <= 11;
}

function connectWithBaud(baudRate, serialProfile) {
  return new Promise(function (resolve, reject) {
    // Close any existing connection before reconnecting
    try {
      modbusClient.close(function () {
        doConnect();
      });
    } catch (_) {
      doConnect();
    }

    function doConnect() {
      console.log(
        "[modbus] trying",
        formatScanContext(baudRate, serialProfile),
        "on",
        serialPortPath,
      );
      modbusClient
        .connectRTUBuffered(serialPortPath, {
          baudRate: baudRate,
          dataBits: serialProfile.dataBits,
          stopBits: serialProfile.stopBits,
          flowControl: false,
          parity: serialProfile.parity,
        })
        .then(resolve)
        .catch(reject);
    }
  });
}

function scanForDevice() {
  var profileIdx = 0;
  var baudIdx = 0;

  function selectNextConnection() {
    if (profileIdx >= SERIAL_PROFILES.length) {
      return null;
    }

    var profile = SERIAL_PROFILES[profileIdx];
    var baud = BAUD_RATES[baudIdx];

    baudIdx++;
    if (baudIdx >= BAUD_RATES.length) {
      baudIdx = 0;
      profileIdx++;
    }

    return { profile: profile, baud: baud };
  }

  function tryNextConnection() {
    var nextConnection = selectNextConnection();
    if (!nextConnection) {
      shutdownWithError(
        "[modbus] scan complete - no response at any serial setting, baud rate, slave ID, or address. Check controller power, RJ cable, and A/B wiring.",
      );
      return;
    }

    var baud = nextConnection.baud;
    var profile = nextConnection.profile;

    connectWithBaud(baud, profile)
      .then(function () {
        modbusClient.setTimeout(configuredTimeout);
        var slaveIdx = 0;
        var addrIdx = 0;

        function tryNextSlave() {
          if (slaveIdx >= SLAVE_IDS.length) {
            // No slave responded at this connection profile, try next.
            tryNextConnection();
            return;
          }
          var slaveId = SLAVE_IDS[slaveIdx];
          addrIdx = 0;
          modbusClient.setID(slaveId);
          tryNextAddress();
        }

        function tryNextAddress() {
          if (addrIdx >= TEST_ADDRESSES.length) {
            slaveIdx++;
            tryNextSlave();
            return;
          }
          var address = TEST_ADDRESSES[addrIdx++];
          console.log(
            "[modbus] probing slave",
            SLAVE_IDS[slaveIdx],
            "addr 0x" + address.toString(16).padStart(4, "0"),
            "@ " + formatScanContext(baud, profile),
          );
          modbusClient
            .readHoldingRegisters(address, 1)
            .then(function () {
              console.log(
                "[modbus] device found! baud =",
                baud,
                "| parity =",
                profile.parity,
                "| stopBits =",
                profile.stopBits,
                "| slave ID =",
                SLAVE_IDS[slaveIdx],
                "| address 0x" + address.toString(16).padStart(4, "0"),
              );
              modbusClient.setID(SLAVE_IDS[slaveIdx]);
              modbusClient.setTimeout(5000);
              startPollingLoop();
            })
            .catch(function (err) {
              if (isModbusExceptionResponse(err)) {
                console.log(
                  "[modbus] device replied with exception code",
                  err.modbusCode,
                  "while probing; communication is alive.",
                );
                console.log(
                  "[modbus] using detected link settings:",
                  formatScanContext(baud, profile),
                  "| slave ID =",
                  SLAVE_IDS[slaveIdx],
                );
                modbusClient.setID(SLAVE_IDS[slaveIdx]);
                modbusClient.setTimeout(5000);
                startPollingLoop();
                return;
              }
              tryNextAddress();
            });
        }

        tryNextSlave();
      })
      .catch(function (err) {
        console.error(
          "[modbus] failed to open port at",
          formatScanContext(baud, profile),
          ":",
          err && err.message ? err.message : err,
        );
        tryNextConnection();
      });
  }

  console.log(
    "[modbus] starting device scan across profiles:",
    SERIAL_PROFILES,
    "| baud rates:",
    BAUD_RATES,
    "| slave IDs:",
    SLAVE_IDS,
    "| test addresses:",
    TEST_ADDRESSES.map(function (addr) {
      return "0x" + addr.toString(16);
    }),
  );
  tryNextConnection();
}

function setupModbus() {
  console.log("[modbus] attempting serial connection on", serialPortPath);
  scanForDevice();
}

function parseHexBytes(hexText) {
  var cleaned = (hexText || "").replace(/[^a-fA-F0-9]/g, "");
  if (!cleaned || cleaned.length % 2 !== 0) {
    return null;
  }
  return Buffer.from(cleaned, "hex");
}

function setupMeterbus() {
  var SerialPortCtor;

  try {
    SerialPortCtor = require("serialport").SerialPort;
  } catch (error) {
    console.error(
      "[meterbus] serialport dependency not installed. Run: npm install serialport",
    );
    return;
  }

  var baud = parseInt(process.env.METERBUS_BAUD || "9600", 10);
  var dataBits = parseInt(process.env.METERBUS_DATABITS || "8", 10);
  var stopBits = parseInt(process.env.METERBUS_STOPBITS || "1", 10);
  var parity = process.env.METERBUS_PARITY || "none";

  meterbusPort = new SerialPortCtor({
    path: serialPortPath,
    baudRate: baud,
    dataBits: dataBits,
    stopBits: stopBits,
    parity: parity,
    autoOpen: false,
  });

  meterbusPort.on("error", function (error) {
    shutdownWithError("[meterbus] serial error", error);
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
    baud,
  );
  meterbusPort.open(function (error) {
    if (error) {
      shutdownWithError("[meterbus] failed to open serial port", error);
      return;
    }
    console.log("[meterbus] serial connection established");
    startPollingLoop();
  });
}

function setupProtocol() {
  if (protocol === "meterbus") {
    setupMeterbus();
    return;
  }

  protocol = "modbus";
  setupModbus();
}

function readModbusSnapshot() {
  return modbusClient.readHoldingRegisters(0x0010, 49).then(function (data) {
    if (!data) {
      return null;
    }

    return {
      arrayCurrent: float16_to_float(data.data[1]).toFixed(2),
      arrayVoltage: float16_to_float(data.data[3]).toFixed(2),
      batteryVoltage: float16_to_float(data.data[2]).toFixed(2),
      chargeCurrent: float16_to_float(data.data[0]).toFixed(2),
      targetVoltage: float16_to_float(data.data[47]).toFixed(2),
      powerOut: float16_to_float(data.data[44]).toFixed(2),
      arrayMaxPower: float16_to_float(data.data[46]).toFixed(2),
    };
  });
}

function readMeterbusSnapshot() {
  return new Promise(function (resolve, reject) {
    if (!meterbusPort || !meterbusPort.isOpen) {
      reject(new Error("MeterBus serial port is not open"));
      return;
    }

    var requestHex = process.env.METERBUS_REQUEST_HEX;
    var requestBuffer = parseHexBytes(requestHex || "");
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

      var responseWaitMs = parseInt(
        process.env.METERBUS_RESPONSE_WAIT_MS || "600",
        10,
      );
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
      }, responseWaitMs);
    });
  });
}

setupProtocol();

function solarStatus() {
  console.log("[poll] tick | protocol:", protocol);
  var readPromise =
    protocol === "meterbus" ? readMeterbusSnapshot() : readModbusSnapshot();

  readPromise
    .then(function (data) {
      if (data) {
        details = data;
        if (protocol === "meterbus") {
          console.log(
            "[meterbus] response bytes:",
            details.byteLength,
            "| raw hex:",
            details.rawHex,
          );
        } else {
          console.log(
            "[modbus] data read -",
            "arrayCurrent:",
            details.arrayCurrent + "A",
            "| arrayVoltage:",
            details.arrayVoltage + "V",
            "| batteryVoltage:",
            details.batteryVoltage + "V",
            "| chargeCurrent:",
            details.chargeCurrent + "A",
            "| targetVoltage:",
            details.targetVoltage + "V",
            "| powerOut:",
            details.powerOut + "W",
            "| arrayMaxPower:",
            details.arrayMaxPower + "W",
          );
        }
        if (connectionExists) {
          console.log(
            "[socket] sending message to",
            io.engine.clientsCount,
            "client(s)",
          );
          io.sockets.emit("message", details);
        } else {
          console.log("[socket] no clients connected, skipping emit");
        }
      } else {
        console.log("[" + protocol + "] no data returned");
      }
      setTimeout(solarStatus, 1000);
    })
    .catch(function (error) {
      shutdownWithError("[" + protocol + "] poll read failed", error);
    });
}

process.on("uncaughtException", function (error) {
  shutdownWithError("uncaught exception", error);
});

process.on("unhandledRejection", function (error) {
  shutdownWithError("unhandled rejection", error);
});

http.on("error", function (error) {
  shutdownWithError("http server error", error);
});

http.listen(9001, function () {
  console.log("listening on *:9001");
});

// function to input a float16 and return a float
function float16_to_float(h) {
  var s = (h & 0x8000) >> 15;
  var e = (h & 0x7c00) >> 10;
  var f = h & 0x03ff;

  if (e == 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  } else if (e == 0x1f) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }

  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}
