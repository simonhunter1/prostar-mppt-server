var ModbusRTU = require("modbus-serial");
var mapModbusSnapshot = require("../parsers/prostarMapper").mapModbusSnapshot;

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

  var modbusCode =
    typeof error.modbusCode === "number" ? error.modbusCode : error.errno;

  return modbusCode >= 1 && modbusCode <= 11;
}

function createModbusProtocol(options) {
  var serialPortPath = options.serialPortPath;
  var modbusConfig = options.modbusConfig;
  var onFatal = options.onFatal;

  var client = new ModbusRTU();

  client.on("error", function (error) {
    onFatal("[modbus] client error", error);
  });

  function connectWithBaud(baudRate, serialProfile) {
    return new Promise(function (resolve, reject) {
      try {
        client.close(function () {
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
        client
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
      if (profileIdx >= modbusConfig.serialProfiles.length) {
        return null;
      }

      var profile = modbusConfig.serialProfiles[profileIdx];
      var baud = modbusConfig.baudRates[baudIdx];

      baudIdx++;
      if (baudIdx >= modbusConfig.baudRates.length) {
        baudIdx = 0;
        profileIdx++;
      }

      return { profile: profile, baud: baud };
    }

    return new Promise(function (resolve, reject) {
      function tryNextConnection() {
        var nextConnection = selectNextConnection();
        if (!nextConnection) {
          reject(
            new Error(
              "[modbus] scan complete - no response at any serial setting, baud rate, slave ID, or address. Check controller power, RJ cable, and A/B wiring.",
            ),
          );
          return;
        }

        var baud = nextConnection.baud;
        var profile = nextConnection.profile;

        connectWithBaud(baud, profile)
          .then(function () {
            client.setTimeout(modbusConfig.timeoutMs);
            var slaveIdx = 0;
            var addrIdx = 0;

            function tryNextSlave() {
              if (slaveIdx >= modbusConfig.slaveIds.length) {
                tryNextConnection();
                return;
              }
              addrIdx = 0;
              client.setID(modbusConfig.slaveIds[slaveIdx]);
              tryNextAddress();
            }

            function tryNextAddress() {
              if (addrIdx >= modbusConfig.testAddresses.length) {
                slaveIdx++;
                tryNextSlave();
                return;
              }

              var slaveId = modbusConfig.slaveIds[slaveIdx];
              var address = modbusConfig.testAddresses[addrIdx++];

              console.log(
                "[modbus] probing slave",
                slaveId,
                "addr 0x" + address.toString(16).padStart(4, "0"),
                "@ " + formatScanContext(baud, profile),
              );

              client
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
                    slaveId,
                    "| address 0x" + address.toString(16).padStart(4, "0"),
                  );
                  client.setID(slaveId);
                  client.setTimeout(5000);
                  resolve();
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
                      slaveId,
                    );
                    client.setID(slaveId);
                    client.setTimeout(5000);
                    resolve();
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

      tryNextConnection();
    });
  }

  async function initialize() {
    console.log("[modbus] attempting serial connection on", serialPortPath);
    console.log(
      "[modbus] starting device scan across profiles:",
      modbusConfig.serialProfiles,
      "| baud rates:",
      modbusConfig.baudRates,
      "| slave IDs:",
      modbusConfig.slaveIds,
      "| test addresses:",
      modbusConfig.testAddresses.map(function (addr) {
        return "0x" + addr.toString(16);
      }),
    );

    await scanForDevice();
  }

  async function readSnapshot() {
    var data = await client.readHoldingRegisters(0x0010, 49);
    if (!data) {
      return null;
    }

    return mapModbusSnapshot(data.data);
  }

  function close() {
    try {
      client.close();
    } catch (_) {}
  }

  return {
    name: "modbus",
    initialize: initialize,
    readSnapshot: readSnapshot,
    close: close,
  };
}

module.exports = {
  createModbusProtocol: createModbusProtocol,
};
