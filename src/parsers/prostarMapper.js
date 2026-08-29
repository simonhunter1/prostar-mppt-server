var float16ToFloat = require("../utils/float16").float16ToFloat;

function mapModbusSnapshot(registers) {
  if (!registers || registers.length < 49) {
    return null;
  }

  return {
    arrayCurrent: float16ToFloat(registers[1]).toFixed(2),
    arrayVoltage: float16ToFloat(registers[3]).toFixed(2),
    batteryVoltage: float16ToFloat(registers[2]).toFixed(2),
    chargeCurrent: float16ToFloat(registers[0]).toFixed(2),
    targetVoltage: float16ToFloat(registers[47]).toFixed(2),
    powerOut: float16ToFloat(registers[44]).toFixed(2),
    arrayMaxPower: float16ToFloat(registers[46]).toFixed(2),
    chargeState: registers[17],
  };
}

module.exports = {
  mapModbusSnapshot: mapModbusSnapshot,
};
