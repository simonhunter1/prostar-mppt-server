function createLiveTableRenderer(options) {
  var getChargeStateName = options.getChargeStateName;
  var getPollCount = options.getPollCount;
  var getClientCount = options.getClientCount;

  var liveTableLines = 0;

  function clear() {
    if (liveTableLines > 0) {
      process.stdout.write("\x1b[" + liveTableLines + "A\x1b[0J");
    }
  }

  function draw(data) {
    var LABEL_W = 18;
    var VALUE_W = 27;
    var TOTAL_W = 1 + 1 + LABEL_W + 1 + 1 + 1 + VALUE_W + 1 + 1;

    var now = new Date().toLocaleTimeString();
    var lines = [];

    function pad(str, len) {
      str = String(str);
      return str.length >= len
        ? str.slice(0, len)
        : str + " ".repeat(len - str.length);
    }

    function row(label, value) {
      return "│ " + pad(label, LABEL_W) + " │ " + pad(value, VALUE_W) + " │";
    }

    var LEFT_SEG = 1 + LABEL_W + 1;
    var RIGHT_SEG = 1 + VALUE_W + 1;

    var mid = "├" + "─".repeat(LEFT_SEG) + "┼" + "─".repeat(RIGHT_SEG) + "┤";
    var bottom = "└" + "─".repeat(LEFT_SEG) + "┴" + "─".repeat(RIGHT_SEG) + "┘";

    var headerInner = TOTAL_W - 2;
    var headerTop = "┌" + "─".repeat(headerInner) + "┐";
    var header = "│ " + pad("ProStar MPPT  " + now, headerInner - 2) + " │";
    var headerMid =
      "└" + "─".repeat(LEFT_SEG) + "┬" + "─".repeat(RIGHT_SEG) + "┘";

    lines.push(headerTop);
    lines.push(header);
    lines.push(headerMid);
    lines.push(
      row(
        "Charge State",
        getChargeStateName(data.chargeState) + " (" + data.chargeState + ")",
      ),
    );
    lines.push(mid);
    lines.push(row("Array Voltage", data.arrayVoltage + " V"));
    lines.push(row("Array Current", data.arrayCurrent + " A"));
    lines.push(row("Array Max Power", data.arrayMaxPower + " W"));
    lines.push(mid);
    lines.push(row("Battery Voltage", data.batteryVoltage + " V"));
    lines.push(row("Charge Current", data.chargeCurrent + " A"));
    lines.push(row("Target Voltage", data.targetVoltage + " V"));
    lines.push(row("Power Out", data.powerOut + " W"));
    lines.push(mid);
    lines.push(
      row("Poll #", getPollCount() + " | Clients: " + getClientCount()),
    );
    lines.push(bottom);

    liveTableLines = lines.length;
    process.stdout.write(lines.join("\n") + "\n");
  }

  return {
    clear: clear,
    draw: draw,
  };
}

module.exports = {
  createLiveTableRenderer: createLiveTableRenderer,
};
