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

function buildSerialProfiles(
  configuredDataBits,
  configuredParity,
  configuredStopBits,
) {
  if (configuredParity || configuredStopBits) {
    return [
      {
        dataBits: Number.isFinite(configuredDataBits) ? configuredDataBits : 8,
        parity: configuredParity || "none",
        stopBits: Number.isFinite(configuredStopBits)
          ? configuredStopBits
          : configuredParity === "none"
            ? 2
            : 1,
      },
    ];
  }

  return [
    { dataBits: 8, parity: "none", stopBits: 2 },
    { dataBits: 8, parity: "even", stopBits: 1 },
    { dataBits: 8, parity: "none", stopBits: 1 },
  ];
}

function loadConfig() {
  var protocol = (process.env.PROTOCOL || "modbus").toLowerCase();
  var serialPortPath =
    process.env.SERIAL_PORT ||
    process.env.MODBUS_PORT ||
    "/dev/tty.usbserial-D20JPLBX";

  var configuredDataBits = parseInt(process.env.MODBUS_DATABITS || "8", 10);
  var configuredStopBits = process.env.MODBUS_STOPBITS
    ? parseInt(process.env.MODBUS_STOPBITS, 10)
    : null;
  var configuredParity = process.env.MODBUS_PARITY || null;

  var modbus = {
    baudRates: parseIntList(
      process.env.MODBUS_BAUD_RATES,
      [9600, 19200, 38400],
    ),
    slaveIds: parseIntList(process.env.MODBUS_SLAVE_IDS, [1, 2, 3, 4, 5]),
    testAddresses: parseAddressList(
      process.env.MODBUS_TEST_ADDRESSES,
      [0x0008, 0x0010, 0x0000],
    ),
    timeoutMs: parseInt(process.env.MODBUS_TIMEOUT_MS || "3000", 10),
    serialProfiles: buildSerialProfiles(
      configuredDataBits,
      configuredParity,
      configuredStopBits,
    ),
  };

  var meterbus = {
    baud: parseInt(process.env.METERBUS_BAUD || "9600", 10),
    dataBits: parseInt(process.env.METERBUS_DATABITS || "8", 10),
    stopBits: parseInt(process.env.METERBUS_STOPBITS || "1", 10),
    parity: process.env.METERBUS_PARITY || "none",
    requestHex: process.env.METERBUS_REQUEST_HEX,
    responseWaitMs: parseInt(
      process.env.METERBUS_RESPONSE_WAIT_MS || "600",
      10,
    ),
  };

  var polling = {
    intervalMs: parseInt(process.env.POLL_INTERVAL_MS || "1000", 10),
    maxConsecutiveErrors: parseInt(
      process.env.POLL_MAX_CONSECUTIVE_ERRORS || "5",
      10,
    ),
    backoffMaxMs: parseInt(process.env.POLL_BACKOFF_MAX_MS || "30000", 10),
  };

  return {
    port: parseInt(process.env.PORT || "9001", 10),
    protocol: protocol,
    serialPortPath: serialPortPath,
    modbus: modbus,
    meterbus: meterbus,
    polling: polling,
  };
}

module.exports = {
  loadConfig: loadConfig,
};
