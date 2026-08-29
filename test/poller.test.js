var test = require("node:test");
var assert = require("node:assert/strict");

var createPoller = require("../src/services/poller").createPoller;

function createFakeTimers() {
  var queue = [];
  var nextId = 1;

  function fakeSetTimeout(fn, delay) {
    var id = nextId++;
    queue.push({ id: id, fn: fn, delay: delay });
    return id;
  }

  function fakeClearTimeout(id) {
    queue = queue.filter(function (item) {
      return item.id !== id;
    });
  }

  async function runNextTimer() {
    if (queue.length === 0) {
      throw new Error("No queued timer to run");
    }

    var timer = queue.shift();
    timer.fn();
    await Promise.resolve();
    await Promise.resolve();
    return timer.delay;
  }

  function queuedDelays() {
    return queue.map(function (item) {
      return item.delay;
    });
  }

  return {
    fakeSetTimeout: fakeSetTimeout,
    fakeClearTimeout: fakeClearTimeout,
    runNextTimer: runNextTimer,
    queuedDelays: queuedDelays,
  };
}

test("poller retries with exponential backoff and stops after max consecutive errors", async function () {
  var timers = createFakeTimers();
  var originalSetTimeout = global.setTimeout;
  var originalClearTimeout = global.clearTimeout;

  global.setTimeout = timers.fakeSetTimeout;
  global.clearTimeout = timers.fakeClearTimeout;

  var onErrorStates = [];
  var maxErrorCount = 0;

  try {
    var poller = createPoller({
      readSnapshot: function () {
        return Promise.reject(new Error("read failed"));
      },
      onData: function () {},
      onError: function (_error, state) {
        onErrorStates.push(state);
      },
      onMaxConsecutiveErrors: function (_error, count) {
        maxErrorCount = count;
      },
      intervalMs: 100,
      maxConsecutiveErrors: 3,
      backoffMaxMs: 500,
    });

    poller.start();
    assert.equal(poller.isStarted(), true);
    assert.deepEqual(timers.queuedDelays(), [100]);

    await timers.runNextTimer();
    assert.equal(onErrorStates.length, 1);
    assert.equal(onErrorStates[0].consecutiveErrors, 1);
    assert.equal(onErrorStates[0].backoffMs, 100);
    assert.equal(onErrorStates[0].limitReached, false);
    assert.deepEqual(timers.queuedDelays(), [100]);

    await timers.runNextTimer();
    assert.equal(onErrorStates.length, 2);
    assert.equal(onErrorStates[1].consecutiveErrors, 2);
    assert.equal(onErrorStates[1].backoffMs, 200);
    assert.equal(onErrorStates[1].limitReached, false);
    assert.deepEqual(timers.queuedDelays(), [200]);

    await timers.runNextTimer();
    assert.equal(onErrorStates.length, 3);
    assert.equal(onErrorStates[2].consecutiveErrors, 3);
    assert.equal(onErrorStates[2].limitReached, true);
    assert.equal(maxErrorCount, 3);
    assert.equal(poller.isStarted(), false);
    assert.deepEqual(timers.queuedDelays(), []);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});

test("poller resets consecutive errors after a successful read", async function () {
  var timers = createFakeTimers();
  var originalSetTimeout = global.setTimeout;
  var originalClearTimeout = global.clearTimeout;

  global.setTimeout = timers.fakeSetTimeout;
  global.clearTimeout = timers.fakeClearTimeout;

  var calls = 0;
  var errorStates = [];
  var dataEvents = 0;

  try {
    var poller = createPoller({
      readSnapshot: function () {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(new Error("first failure"));
        }
        return Promise.resolve({ ok: true });
      },
      onData: function () {
        dataEvents += 1;
      },
      onError: function (_error, state) {
        errorStates.push(state);
      },
      intervalMs: 50,
      maxConsecutiveErrors: 5,
      backoffMaxMs: 500,
    });

    poller.start();
    await timers.runNextTimer();

    assert.equal(errorStates.length, 1);
    assert.equal(poller.getConsecutiveErrors(), 1);

    await timers.runNextTimer();

    assert.equal(dataEvents, 1);
    assert.equal(poller.getConsecutiveErrors(), 0);

    poller.stop();
    assert.equal(poller.isStarted(), false);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});
