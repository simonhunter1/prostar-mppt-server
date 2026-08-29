function float16ToFloat(h) {
  var s = (h & 0x8000) >> 15;
  var e = (h & 0x7c00) >> 10;
  var f = h & 0x03ff;

  if (e == 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  }

  if (e == 0x1f) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }

  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}

module.exports = {
  float16ToFloat: float16ToFloat,
};
