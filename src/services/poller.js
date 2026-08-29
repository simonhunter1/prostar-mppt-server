function createPoller(options) {
  var readSnapshot = options.readSnapshot;
  var onData = options.onData;
  var onNoData = options.onNoData;
  var onError = options.onError;
  var intervalMs = options.intervalMs || 1000;
  var maxConsecutiveErrors = Number.isFinite(options.maxConsecutiveErrors)
    ? options.maxConsecutiveErrors
    : 5;
  var backoffMaxMs = options.backoffMaxMs || 30000;
  var onMaxConsecutiveErrors = options.onMaxConsecutiveErrors;

  var started = false;
  var timer = null;
  var consecutiveErrors = 0;

  function scheduleNext(delayMs) {
    timer = setTimeout(tick, delayMs);
  }

  function computeBackoffMs() {
    var factor = Math.pow(2, Math.max(0, consecutiveErrors - 1));
    var nextDelay = intervalMs * factor;
    return Math.min(backoffMaxMs, nextDelay);
  }

  function tick() {
    readSnapshot()
      .then(function (data) {
        consecutiveErrors = 0;

        if (data) {
          onData(data);
        } else if (onNoData) {
          onNoData();
        }

        scheduleNext(intervalMs);
      })
      .catch(function (error) {
        consecutiveErrors += 1;
        var backoffMs = computeBackoffMs();
        var limitReached =
          maxConsecutiveErrors > 0 && consecutiveErrors >= maxConsecutiveErrors;

        if (onError) {
          onError(error, {
            consecutiveErrors: consecutiveErrors,
            backoffMs: backoffMs,
            limitReached: limitReached,
          });
        }

        if (limitReached) {
          started = false;
          if (onMaxConsecutiveErrors) {
            onMaxConsecutiveErrors(error, consecutiveErrors);
          }
          return;
        }

        scheduleNext(backoffMs);
      });
  }

  function start() {
    if (started) {
      return;
    }

    started = true;
    consecutiveErrors = 0;
    console.log("[poll] polling loop started");
    scheduleNext(intervalMs);
  }

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    started = false;
  }

  return {
    start: start,
    stop: stop,
    isStarted: function () {
      return started;
    },
    getConsecutiveErrors: function () {
      return consecutiveErrors;
    },
  };
}

module.exports = {
  createPoller: createPoller,
};
