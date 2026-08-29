var CHARGE_STATE = {
  0: "START",
  1: "NIGHT_CHECK",
  2: "DISCONNECT",
  3: "NIGHT",
  4: "FAULT",
  5: "MPPT",
  6: "ABSORPTION",
  7: "FLOAT",
  8: "EQUALIZE",
  9: "SLAVE",
  10: "FIXED",
};

function getChargeStateName(value) {
  if (Object.prototype.hasOwnProperty.call(CHARGE_STATE, value)) {
    return CHARGE_STATE[value];
  }

  return "UNKNOWN";
}

module.exports = {
  CHARGE_STATE: CHARGE_STATE,
  getChargeStateName: getChargeStateName,
};
