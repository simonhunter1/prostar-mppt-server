var test = require("node:test");
var assert = require("node:assert/strict");

var mapModbusSnapshot =
  require("../src/parsers/prostarMapper").mapModbusSnapshot;

test("mapModbusSnapshot maps expected registers to telemetry fields", function () {
  var registers = new Array(49).fill(0);

  registers[0] = 0x4400;
  registers[1] = 0x3c00;
  registers[2] = 0x4200;
  registers[3] = 0x4000;
  registers[17] = 8;
  registers[44] = 0x4600;
  registers[46] = 0x4700;
  registers[47] = 0x4500;

  var snapshot = mapModbusSnapshot(registers);

  assert.deepEqual(snapshot, {
    arrayCurrent: "1.00",
    arrayVoltage: "2.00",
    batteryVoltage: "3.00",
    chargeCurrent: "4.00",
    targetVoltage: "5.00",
    powerOut: "6.00",
    arrayMaxPower: "7.00",
    chargeState: 8,
  });
});

test("mapModbusSnapshot returns null for invalid register input", function () {
  assert.equal(mapModbusSnapshot(null), null);
  assert.equal(mapModbusSnapshot([]), null);
  assert.equal(mapModbusSnapshot(new Array(10).fill(0)), null);
});
