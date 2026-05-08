var DATA_DIR = "/sdcard/签到工具/data/";

function ensureDir(dir) {
  files.ensureDir(dir);
}

function readJSON(filename) {
  var path = DATA_DIR + filename;
  if (!files.exists(path)) return null;
  try {
    var content = files.read(path);
    return JSON.parse(content);
  } catch(e) {
    // JSON parse error - reset the corrupted file
    files.write(path, "{}");
    return null;
  }
}

function writeJSON(filename, data) {
  ensureDir(DATA_DIR);
  files.write(DATA_DIR + filename, JSON.stringify(data, null, 2));
}

// Task operations
function loadTasks() {
  var data = readJSON("tasks.json");
  return data && data.tasks ? data.tasks : [];
}

function saveTasks(tasks) {
  writeJSON("tasks.json", { tasks: tasks });
}

function addTask(task) {
  var tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);
  return tasks;
}

function updateTask(taskId, updates) {
  var tasks = loadTasks();
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      for (var key in updates) {
        tasks[i][key] = updates[key];
      }
      break;
    }
  }
  saveTasks(tasks);
  return tasks;
}

function deleteTask(taskId) {
  var tasks = loadTasks();
  var newTasks = [];
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id !== taskId) {
      newTasks.push(tasks[i]);
    }
  }
  saveTasks(newTasks);
  return newTasks;
}

// Log operations
function loadLogs() {
  var data = readJSON("logs.json");
  return data || [];
}

function addLog(logEntry) {
  var logs = loadLogs();
  logs.push(logEntry);
  // Keep last 100 logs
  if (logs.length > 100) {
    logs = logs.slice(logs.length - 100);
  }
  writeJSON("logs.json", logs);
}

// Plugin discovery
function scanPlugins() {
  var pluginDir = "/sdcard/签到工具/plugins/";
  var list = [];
  if (files.exists(pluginDir)) {
    var files_ = files.listDir(pluginDir, function(name) {
      return name.endsWith(".js");
    });
    for (var i = 0; i < files_.length; i++) {
      list.push(files_[i]);
    }
  }
  return list;
}

function loadPluginDefault(name) {
  var path = "plugins/" + name;
  return require(path);
}

// ID generation
function generateId() {
  return "task_" + new Date().getTime();
}

module.exports = {
  loadTasks: loadTasks,
  saveTasks: saveTasks,
  addTask: addTask,
  updateTask: updateTask,
  deleteTask: deleteTask,
  loadLogs: loadLogs,
  addLog: addLog,
  scanPlugins: scanPlugins,
  loadPluginDefault: loadPluginDefault,
  generateId: generateId
};
