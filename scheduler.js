var store = require("./store");
var engine = require("./step-engine");

var running = true;

function formatHourMin(date) {
  var h = date.getHours();
  var m = date.getMinutes();
  return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
}

function getCurrentTimeSlot() {
  return formatHourMin(new Date());
}

function executeAllTasks(tasks, timeSlot) {
  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i];
    if (!task.enabled) continue;

    var slotMatch = false;
    for (var j = 0; j < task.timeSlots.length; j++) {
      if (task.timeSlots[j] === timeSlot) {
        slotMatch = true;
        break;
      }
    }
    if (!slotMatch) continue;

    toast("⏰ 开始执行: " + task.name);
    var result = engine.executeTask(task);
    if (result.ok) {
      toast("✅ " + task.name + " 完成");
    } else {
      toast("❌ " + task.name + " 失败: " + (result.error || "未知错误"));
    }

    sleep(3000);
  }
}

function main() {
  auto.waitFor();

  var orientation = activity.getRequestedOrientation();
  activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

  toast("⏰ 签到调度器已启动");
  var lastSlot = "";

  while (running) {
    var currentSlot = getCurrentTimeSlot();

    if (currentSlot !== lastSlot) {
      lastSlot = currentSlot;
      var tasks = store.loadTasks();
      var hasWork = false;
      for (var i = 0; i < tasks.length; i++) {
        if (!tasks[i].enabled) continue;
        for (var j = 0; j < tasks[i].timeSlots.length; j++) {
          if (tasks[i].timeSlots[j] === currentSlot) {
            hasWork = true;
            break;
          }
        }
        if (hasWork) break;
      }

      if (hasWork) {
        toast("⏰ 执行 " + currentSlot + " 时段的签到任务");
        executeAllTasks(tasks, currentSlot);
      }
    }

    for (var i = 0; i < 60 && running; i++) {
      sleep(1000);
    }
  }

  activity.setRequestedOrientation(orientation);
  toast("签到调度器已停止");
}

function stop() {
  running = false;
}

module.exports = {
  main: main,
  stop: stop
};
