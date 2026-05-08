var store = require("./store");

var MAX_RETRIES = 3;
var RETRY_INTERVAL = 500;

function executeStep(step, task) {
  switch (step.type) {
    case "launch":
      app.launchPackage(task.packageName);
      return { ok: true };

    case "wait":
      sleep(step.value || 1000);
      return { ok: true };

    case "waitText":
      var timeout = step.timeout || 10000;
      var elapsed = 0;
      while (elapsed < timeout) {
        if (text(step.value).exists()) return { ok: true };
        sleep(500);
        elapsed += 500;
      }
      return { ok: false, error: "等待文字超时: " + step.value };

    case "clickText":
      var btn = null;
      // 尝试1: 精确文字匹配
      for (var i = 0; i < MAX_RETRIES; i++) {
        btn = text(step.value).findOne(2000);
        if (btn) break;
        sleep(RETRY_INTERVAL);
      }
      // 尝试2: 文字包含匹配
      if (!btn) {
        for (var i = 0; i < MAX_RETRIES; i++) {
          btn = textContains(step.value).findOne(2000);
          if (btn) break;
          sleep(RETRY_INTERVAL);
        }
      }
      // 尝试3: content-desc 匹配
      if (!btn) {
        for (var i = 0; i < MAX_RETRIES; i++) {
          btn = desc(step.value).findOne(2000);
          if (btn) break;
          sleep(RETRY_INTERVAL);
        }
      }
      // 尝试4: 遍历所有控件递归查找
      if (!btn) {
        var all = className("android.view.View").find();
        for (var i = 0; i < all.length; i++) {
          try {
            var t = all[i].text();
            var d = all[i].desc();
            if ((t && t.indexOf(step.value) >= 0) || (d && d.indexOf(step.value) >= 0)) {
              btn = all[i];
              break;
            }
          } catch(e) {}
        }
      }
      if (btn) {
        // 如果控件不可点击，向上找最近的可点击父控件
        try {
          if (!btn.clickable()) {
            var p = btn.parent();
            while (p && !p.clickable()) {
              p = p.parent();
            }
            if (p && p.clickable()) btn = p;
          }
        } catch(e) {}
        // 用click()点击，如果不生效则用坐标点击
        if (!btn.click()) {
          try {
            var b = btn.bounds();
            if (b) click(b.centerX(), b.centerY());
          } catch(e2) {}
        }
        return { ok: true, retries: MAX_RETRIES };
      }
      return { ok: false, error: "未找到文字按钮: " + step.value };

    case "clickId":
      for (var i = 0; i < MAX_RETRIES; i++) {
        var btn = id(step.value).findOne(2000);
        if (btn) {
          btn.click();
          return { ok: true, retries: i };
        }
        sleep(RETRY_INTERVAL);
      }
      return { ok: false, error: "未找到ID控件: " + step.value };

    case "clickDesc":
      for (var i = 0; i < MAX_RETRIES; i++) {
        var btn = desc(step.value).findOne(2000);
        if (btn) {
          btn.click();
          return { ok: true, retries: i };
        }
        sleep(RETRY_INTERVAL);
      }
      return { ok: false, error: "未找到描述控件: " + step.value };

    case "clickClass":
      for (var i = 0; i < MAX_RETRIES; i++) {
        var btn = className(step.value).findOne(2000);
        if (btn) {
          btn.click();
          return { ok: true, retries: i };
        }
        sleep(RETRY_INTERVAL);
      }
      return { ok: false, error: "未找到类名控件: " + step.value };

    case "clickCoord":
      click(step.x, step.y);
      return { ok: true };

    case "swipe":
      swipe(step.x1, step.y1, step.x2, step.y2, step.duration || 300);
      return { ok: true };

    case "back":
      back();
      sleep(500);
      return { ok: true };

    case "home":
      home();
      return { ok: true };

    case "closeApp":
      if (task && task.packageName) {
        // Method 1: try am force-stop via shell
        try { shell("am force-stop " + task.packageName, false); } catch(e) {
          try { shell("am force-stop " + task.packageName, true); } catch(e2) {}
        }
        // Method 2: kill background processes
        try {
          var am = activity.getSystemService(android.content.Context.ACTIVITY_SERVICE);
          am.killBackgroundProcesses(task.packageName);
        } catch(e3) {}
        sleep(500);
        // Method 3: send back + home to exit
        back();
        sleep(300);
        home();
        sleep(300);
        return { ok: true };
      }
      return { ok: false, error: "未设置包名，无法关闭应用" };

    case "ifText":
      if (text(step.value).exists()) {
        return executeSteps(step.steps, task);
      } else if (step.elseSteps) {
        return executeSteps(step.elseSteps, task);
      }
      return { ok: true };

    case "ifNotText":
      if (!text(step.value).exists()) {
        return executeSteps(step.steps, task);
      } else if (step.elseSteps) {
        return executeSteps(step.elseSteps, task);
      }
      return { ok: true };

    case "loop":
      var count = step.count || 3;
      for (var i = 0; i < count; i++) {
        var result = executeSteps(step.steps, task);
        if (!result.ok) return result;
      }
      return { ok: true };
  }
  return { ok: false, error: "未知步骤类型: " + step.type };
}

function executeSteps(steps, task) {
  var log = [];
  for (var i = 0; i < steps.length; i++) {
    var result = executeStep(steps[i], task);
    log.push({
      type: steps[i].type,
      status: result.ok ? "ok" : "fail",
      retries: result.retries || 0
    });
    if (!result.ok) {
      return { ok: false, error: result.error, log: log, stepIndex: i };
    }
  }
  return { ok: true, log: log };
}

function executeTask(task) {
  var startTime = new Date();
  var result = executeSteps(task.steps, task);
  var endTime = new Date();
  var duration = endTime.getTime() - startTime.getTime();

  var logEntry = {
    taskId: task.id,
    taskName: task.name,
    time: formatTime(startTime),
    duration: duration,
    status: result.ok ? "success" : "fail",
    error: result.error || "",
    steps: result.log || []
  };
  store.addLog(logEntry);
  return result;
}

function formatTime(date) {
  var Y = date.getFullYear();
  var M = pad(date.getMonth() + 1);
  var D = pad(date.getDate());
  var h = pad(date.getHours());
  var m = pad(date.getMinutes());
  var s = pad(date.getSeconds());
  return Y + "-" + M + "-" + D + " " + h + ":" + m + ":" + s;
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

module.exports = {
  executeTask: executeTask,
  executeSteps: executeSteps
};
