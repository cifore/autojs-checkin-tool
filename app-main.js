"ui";
var store = require("./store");

// Main layout
ui.layout(
  <vertical padding="8" bg="#f5f5f5">
    <text id="title" text="📋 签到任务" textSize="22" gravity="center"
      textStyle="bold" padding="8" textColor="#333333"/>
    <text id="nextTime" textSize="13" gravity="center" textColor="#999999" padding="4"/>

    <list id="taskList" layout_weight="1" margin="0">
      <card cardCornerRadius="12" cardElevation="2" margin="0 5" padding="0" bg="#ffffff" h="72" w="*">
        <horizontal id="cardContent" gravity="center_vertical" padding="14 0" layout_weight="1">
          <text id="taskIndex" text="{{this._index}}" textSize="15" textColor="#bbbbbb"
            textStyle="bold" w="28" gravity="center" marginRight="6"/>
          <img id="appIconImg" src="{{this.iconSrc}}" w="46" h="46" marginRight="12" scaleType="fitCenter"/>
          <vertical layout_weight="1" gravity="center_vertical">
            <text id="taskName" text="{{this.name}}" textSize="16" textStyle="bold"
              textColor="#333333" maxLines="1" ellipsize="end"/>
            <text id="taskPkg" text="{{this.packageName}}" textSize="11" textColor="#aaaaaa"
              maxLines="1" ellipsize="end" marginTop="2"/>
            <horizontal marginTop="5">
              <text id="taskSlots" text="{{this.timeSlots}}" textSize="11" textColor="#888888"/>
              <text id="taskStepCount" text="{{this._stepCount}}" textSize="11" textColor="#2196f3" marginLeft="8"/>
              <text id="taskLastDur" text="{{this._lastDuration}}" textSize="11" textColor="#ff9800" marginLeft="8"/>
              <text id="taskDoneToday" text="{{this._doneToday}}" textSize="11" marginLeft="4"/>
              <text id="taskStatus" text="{{this.enabled ? '● 已启用' : '○ 已禁用'}}"
                textSize="11" textColor="{{this.enabled ? '#4caf50' : '#bbbbbb'}}" marginLeft="4"/>
            </horizontal>
          </vertical>
        </horizontal>
      </card>
      <text id="runBtn" text="执行" textSize="13" textColor="#ffffff"
        bg="#ff5722" w="50" h="72" gravity="center" marginLeft="4"/>
    </list>

    <button id="runAllBtn" text="▶▶ 一键执行全部任务" bg="#ff5722" textColor="white"
      padding="14 10" margin="4 0 4 8" textSize="15" textStyle="bold"/>

    <horizontal gravity="center" margin="8">
      <button id="addBtn" text="+ 添加新任务" bg="#2196f3" textColor="white" padding="12 8"/>
      <button id="sortBtn" text="↑↓ 排序" bg="#03a9f4" textColor="white" padding="12 8" marginLeft="8"/>
      <button id="schedulerBtn" text="⏰ 调度" bg="#ff9800" textColor="white" padding="12 8" marginLeft="8"/>
      <button id="logsBtn" text="📝 日志" bg="#9e9e9e" textColor="white" padding="12 8" marginLeft="8"/>
    </horizontal>
  </vertical>
);

function refreshList() {
  var tasks = store.loadTasks();
  // Get today's date for done-today check
  var todayStr = new Date().toISOString().slice(0, 10);
  var logs = store.loadLogs();
  var doneToday = {};
  for (var i = 0; i < logs.length; i++) {
    if (logs[i].status === "success" && logs[i].time && logs[i].time.indexOf(todayStr) === 0) {
      doneToday[logs[i].taskId] = true;
    }
  }
  // Get last execution duration per task
  var lastDuration = {};
  for (var i = logs.length - 1; i >= 0; i--) {
    if (!lastDuration[logs[i].taskId]) {
      lastDuration[logs[i].taskId] = logs[i].duration;
    }
  }
  for (var i = 0; i < tasks.length; i++) {
    tasks[i]._index = (i + 1) + ".";
    tasks[i]._stepCount = tasks[i].steps ? tasks[i].steps.length + "步" : "0步";
    tasks[i]._doneToday = doneToday[tasks[i].id] ? "✅" : "";
    var lastDur = lastDuration[tasks[i].id];
    tasks[i]._lastDuration = lastDur ? (lastDur / 1000).toFixed(1) + "s" : "";
    // Set icon source for data binding (never empty to avoid crash)
    if (tasks[i].name) {
      var cacheName = tasks[i].name.replace(/[\\/:*?"<>|.]/g, "_");
      var cachePath = ICON_DIR + cacheName + ".png";
      tasks[i].iconSrc = files.exists(cachePath) ? "file://" + cachePath : "file:///nonexistent";
    }
  }
  ui.taskList.setDataSource(tasks);
  updateNextTime(tasks);
}

function updateNextTime(tasks) {
  var now = new Date();
  var currentMin = now.getHours() * 60 + now.getMinutes();
  var nextSlot = null;
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].enabled) continue;
    for (var j = 0; j < tasks[i].timeSlots.length; j++) {
      var parts = tasks[i].timeSlots[j].split(":");
      var slotMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      if (slotMin > currentMin) {
        if (!nextSlot || slotMin < nextSlot.min) {
          nextSlot = { time: tasks[i].timeSlots[j], min: slotMin };
        }
      }
    }
  }
  ui.nextTime.setText(nextSlot ? "⏰ 下次执行: " + nextSlot.time : "暂无排期");
}

// Helper: zero-pad numbers
function pad(n) { return n < 10 ? "0" + n : "" + n; }

// Icon cache directory
var ICON_DIR = "/storage/emulated/0/签到工具/icons/";

// Download icon from iTunes API and cache to local file, then refresh list
function downloadAndRefreshIcon(appName) {
  try {
    var cacheName = appName.replace(/[\\/:*?"<>|.]/g, "_");
    var cachePath = ICON_DIR + cacheName + ".png";
    files.ensureDir(ICON_DIR);
    if (files.exists(cachePath)) return;

    var apiUrl = "https://itunes.apple.com/search?term=" + encodeURI(appName) + "&country=cn&entity=software&limit=5";
    var res = http.get(apiUrl);
    if (res.statusCode == 200) {
      var data = JSON.parse(res.body.string());
      if (data.resultCount > 0 && data.results[0].artworkUrl100) {
        var imgRes = http.get(data.results[0].artworkUrl100);
        if (imgRes.statusCode == 200) {
          files.writeBytes(cachePath, imgRes.body.bytes());
          // Refresh list so data binding picks up the new file
          ui.run(function() { refreshList(); });
        }
      }
    }
  } catch(e) {}
}

// Click on card → open editor (checks flag to avoid runBtn conflict)
ui.taskList.on("item_click", function(item, i, view) {
  if (item && item._execClick) return;
  openTaskEditor(item);
});

// Run button & icon setup
ui.taskList.on("item_bind", function(view, item) {
  var pkg = activity.getPackageName();
  // Run button click → execute task
  var runResId = view.getResources().getIdentifier("runBtn", "id", pkg);
  var runBtn = runResId > 0 ? view.findViewById(runResId) : null;
  if (runBtn) {
    runBtn.setOnTouchListener(new android.view.View.OnTouchListener({
      onTouch: function(v, event) {
        if (event.getAction() == android.view.MotionEvent.ACTION_DOWN) {
          item._execClick = true;
        } else if (event.getAction() == android.view.MotionEvent.ACTION_CANCEL) {
          item._execClick = false;
        }
        return false;
      }
    }));
    runBtn.setOnClickListener(new android.view.View.OnClickListener({
      onClick: function() {
        item._execClick = false;
        runTaskNow(item);
      }
    }));
  }

  // App icon - data binding handles display, only trigger download if not cached
  if (item.name && !item._iconLoading) {
    var cacheName = item.name.replace(/[\\/:*?"<>|.]/g, "_");
    var cachePath = ICON_DIR + cacheName + ".png";
    if (!files.exists(cachePath)) {
      item._iconLoading = true;
      var savedName = item.name;
      threads.start(function() {
        downloadAndRefreshIcon(savedName);
      });
    }
  }
});

ui.addBtn.on("click", function() {
  openTaskEditor(null);
});

ui.sortBtn.on("click", function() {
  openTaskReorderPanel();
});

ui.schedulerBtn.on("click", function() {
  openSchedulerPanel();
});

ui.logsBtn.on("click", function() {
  openLogsPanel();
});

// ▶▶ Run all enabled tasks in sequence
ui.runAllBtn.on("click", function() {
  dialogs.confirm("一键执行", "按序号依次执行所有已启用的任务？", function(yes) {
    if (!yes) return;
    threads.start(function() {
      runAllTasks();
    });
  });
});

// Initial load with crash protection
try { refreshList(); } catch(e) { toast("加载数据失败，已重置"); }

// Preload app icons in background
threads.start(function() {
  var tasks = store.loadTasks();
  var needsRefresh = false;
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].name) continue;
    var cacheName = tasks[i].name.replace(/[\\/:*?"<>|.]/g, "_");
    var cachePath = ICON_DIR + cacheName + ".png";
    if (!files.exists(cachePath)) {
      downloadAndRefreshIcon(tasks[i].name);
      needsRefresh = true;
    }
  }
  if (needsRefresh) {
    ui.run(function() { refreshList(); });
  }
});

// ----- Task Editor Dialog -----
function openTaskEditor(task) {
  var isNew = !task;
  var plugins = store.scanPlugins();

  var name = task && task.name ? task.name : "";
  var pkg = task && task.packageName ? task.packageName : "";
  var pluginName = task && task.plugin ? task.plugin : (plugins.length > 0 ? plugins[0] : "");
  var slots = task && task.timeSlots ? task.timeSlots.slice() : [];
  var enabled = task ? (task.enabled !== false) : true;
  var steps = task && task.steps ? JSON.parse(JSON.stringify(task.steps)) : [];

  var ctx = activity;
  var scroll = new android.widget.ScrollView(ctx);
  var ll = new android.widget.LinearLayout(ctx);
  ll.setOrientation(android.widget.LinearLayout.VERTICAL);
  ll.setPadding(32, 16, 32, 16);

  var matchWrap = new android.widget.LinearLayout.LayoutParams(-1, -2);
  matchWrap.setMargins(0, 4, 0, 4);

  function addLabel(text) {
    var tv = new android.widget.TextView(ctx);
    tv.setText(text);
    tv.setTextSize(14);
    tv.setTextColor(colors.parseColor("#666666"));
    ll.addView(tv, new android.widget.LinearLayout.LayoutParams(-1, -2));
  }

  // 选择应用按钮
  var selectBtn = new android.widget.Button(ctx);
  selectBtn.setText("📱 从应用列表选择");
  selectBtn.setTextColor(colors.parseColor("#ffffff"));
  selectBtn.setBackgroundColor(colors.parseColor("#2196f3"));
  ll.addView(selectBtn, matchWrap);

  // 应用名称
  addLabel("应用名称");
  var nameEdit = new android.widget.EditText(ctx);
  nameEdit.setText(name);
  nameEdit.setHint("如: 快手");
  ll.addView(nameEdit, matchWrap);

  // 包名
  addLabel("包名");
  var pkgEdit = new android.widget.EditText(ctx);
  pkgEdit.setText(pkg);
  pkgEdit.setHint("如: com.kuaishou.nebula");
  ll.addView(pkgEdit, matchWrap);

  // 选择应用按钮事件
  selectBtn.setOnClickListener(new android.view.View.OnClickListener({
    onClick: function() {
      showAppPicker(function(appName, pkgName) {
        nameEdit.setText(appName);
        pkgEdit.setText(pkgName);
      });
    }
  }));

  // 编辑签到步骤按钮
  var stepBtn = new android.widget.Button(ctx);
  stepBtn.setText("✏️ 编辑签到步骤");
  stepBtn.setTextColor(colors.parseColor("#ffffff"));
  stepBtn.setBackgroundColor(colors.parseColor("#4caf50"));
  ll.addView(stepBtn, matchWrap);
  stepBtn.setOnClickListener(new android.view.View.OnClickListener({
    onClick: function() {
      openStepEditor(steps, name || "新任务");
    }
  }));

  // 执行时段
  addLabel("执行时段");
  var defaultSlots = ["08:00", "12:00", "14:00", "18:00", "20:00"];
  var slotCBs = [];
  for (var i = 0; i < defaultSlots.length; i++) {
    var cb = new android.widget.CheckBox(ctx);
    cb.setText(defaultSlots[i]);
    for (var j = 0; j < slots.length; j++) {
      if (slots[j] === defaultSlots[i]) cb.setChecked(true);
    }
    ll.addView(cb, matchWrap);
    slotCBs.push(cb);
  }

  var customSlot = new android.widget.EditText(ctx);
  customSlot.setHint("自定义时段 (HH:MM)");
  ll.addView(customSlot, matchWrap);

  var enabledCB = new android.widget.CheckBox(ctx);
  enabledCB.setText("启用");
  enabledCB.setChecked(enabled);
  ll.addView(enabledCB, matchWrap);

  // 手动执行按钮（在对话框底部）
  var runNowBtn = new android.widget.Button(ctx);
  runNowBtn.setText("▶ 立即执行");
  runNowBtn.setTextColor(colors.parseColor("#ffffff"));
  runNowBtn.setBackgroundColor(colors.parseColor("#ff5722"));
  ll.addView(runNowBtn, matchWrap);
  runNowBtn.setOnClickListener(new android.view.View.OnClickListener({
    onClick: function() {
      if (!(pkgEdit.getText() + "")) {
        toast("请先选择应用");
        return;
      }
      var execTask = {
        id: task ? task.id : store.generateId(),
        name: (nameEdit.getText() + "") || "临时任务",
        packageName: pkgEdit.getText() + "",
        steps: steps,
        timeSlots: [],
        enabled: false
      };
      dialog.dismiss();
      var engine = require("./step-engine");
      threads.start(function() {
        toast("▶ 开始执行: " + execTask.name);
        var result = engine.executeTask(execTask);
        if (result.ok) {
          toast("✅ " + execTask.name + " 执行完成");
        } else {
          toast("❌ 失败: " + result.error);
        }
      });
    }
  }));

  scroll.addView(ll);

  // 使用 AlertDialog.Builder 确保兼容性
  var builder = new android.app.AlertDialog.Builder(ctx);
  builder.setTitle(isNew ? "添加新任务" : "编辑任务");
  builder.setView(scroll);
  builder.setPositiveButton("保存", null);
  builder.setNegativeButton("取消", new android.content.DialogInterface.OnClickListener({
    onClick: function(dialog, which) {
      dialog.dismiss();
    }
  }));
  if (!isNew) {
    builder.setNeutralButton("删除", null);
  }
  var dialog = builder.create();
  dialog.show();

  // 重写保存按钮防止自动关闭
  dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE).setOnClickListener(new android.view.View.OnClickListener({
    onClick: function(v) {
      try {
        var newName = nameEdit.getText() + "";
        var newPkg = pkgEdit.getText() + "";

        if (!newName || !newPkg) {
          toast("请输入应用名称和包名");
          return;
        }

        var selectedSlots = [];
        for (var i = 0; i < slotCBs.length; i++) {
          if (slotCBs[i].isChecked()) selectedSlots.push(defaultSlots[i]);
        }
        var customText = customSlot.getText() + "";
        if (customText.trim()) selectedSlots.push(customText.trim());

        if (isNew) {
          store.addTask({
            id: store.generateId(),
            name: newName,
            packageName: newPkg,
            plugin: pluginName,
            timeSlots: selectedSlots,
            enabled: enabledCB.isChecked(),
            steps: steps
          });
        } else {
          store.updateTask(task.id, {
            name: newName,
            packageName: newPkg,
            plugin: pluginName,
            timeSlots: selectedSlots,
            enabled: enabledCB.isChecked(),
            steps: steps
          });
        }
        refreshList();
        dialog.dismiss();
        toast("保存成功");
      } catch(e) {
        toast("保存失败: " + e);
      }
    }
  }));

  // 删除按钮
  if (!isNew) {
    dialog.getButton(android.content.DialogInterface.BUTTON_NEUTRAL).setOnClickListener(new android.view.View.OnClickListener({
      onClick: function(v) {
        confirmDelete(task, dialog);
      }
    }));
  }
}

// 获取已安装应用列表并弹出选择
function showAppPicker(callback) {
  var pm = activity.getPackageManager();
  var intent = new android.content.Intent(android.content.Intent.ACTION_MAIN, null);
  intent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
  var apps = pm.queryIntentActivities(intent, 0);

  var appList = [];
  var sysFlag = android.content.pm.ApplicationInfo.FLAG_SYSTEM;
  for (var i = 0; i < apps.size(); i++) {
    var info = apps.get(i);
    // Skip system apps
    if ((info.activityInfo.applicationInfo.flags & sysFlag) !== 0) continue;
    var appName = info.loadLabel(pm) + "";
    var pkgName = info.activityInfo.packageName;
    appList.push({ name: appName, pkg: pkgName, info: info });
  }
  appList.sort(function(a, b) { return a.name.localeCompare(b.name); });

  var ctx = activity;

  var scroll = new android.widget.ScrollView(ctx);
  var outer = new android.widget.LinearLayout(ctx);
  outer.setOrientation(android.widget.LinearLayout.VERTICAL);
  outer.setPadding(8, 8, 8, 8);

  var searchEdit = new android.widget.EditText(ctx);
  searchEdit.setHint("🔍 搜索应用");
  searchEdit.setTextSize(16);
  searchEdit.setPadding(20, 14, 20, 14);
  searchEdit.setBackgroundColor(colors.parseColor("#f0f0f0"));
  searchEdit.setGravity(android.view.Gravity.CENTER_VERTICAL);
  var searchLp = new android.widget.LinearLayout.LayoutParams(-1, -2);
  searchLp.setMargins(0, 0, 0, 8);
  searchEdit.setLayoutParams(searchLp);
  outer.addView(searchEdit);

  var listContainer = new android.widget.LinearLayout(ctx);
  listContainer.setOrientation(android.widget.LinearLayout.VERTICAL);

  function renderList(filter) {
    listContainer.removeAllViews();
    for (var i = 0; i < appList.length; i++) {
      var app = appList[i];
      if (filter && app.name.toLowerCase().indexOf(filter.toLowerCase()) < 0 &&
          app.pkg.toLowerCase().indexOf(filter.toLowerCase()) < 0) continue;

      var row = new android.widget.LinearLayout(ctx);
      row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
      row.setGravity(android.view.Gravity.CENTER_VERTICAL);
      row.setPadding(12, 14, 12, 14);
      row.setBackgroundColor(colors.parseColor("#ffffff"));
      var rowLp = new android.widget.LinearLayout.LayoutParams(-1, -2);
      rowLp.setMargins(0, 0, 0, 0);
      row.setLayoutParams(rowLp);

      // App icon
      var iconView = new android.widget.ImageView(ctx);
      iconView.setLayoutParams(new android.widget.LinearLayout.LayoutParams(44, 44));
      iconView.setPadding(0, 0, 14, 0);
      try {
        var iconDrawable = app.info.loadIcon(pm);
        iconView.setImageDrawable(iconDrawable);
      } catch(e) {}
      row.addView(iconView);

      // App name only
      var nameText = new android.widget.TextView(ctx);
      nameText.setText(app.name);
      nameText.setTextSize(16);
      nameText.setTextColor(colors.parseColor("#333333"));
      nameText.setTypeface(null, android.graphics.Typeface.BOLD);
      nameText.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, -2, 1));
      row.addView(nameText);

      (function(capturedApp) {
        row.setOnClickListener(new android.view.View.OnClickListener() {
          onClick: function(v) {
            if (callback) callback(capturedApp.name, capturedApp.pkg);
            dialog.dismiss();
          }
        });
      })(app);
      listContainer.addView(row);

      // Divider line
      var divider = new android.view.View(ctx);
      divider.setBackgroundColor(colors.parseColor("#eeeeee"));
      divider.setLayoutParams(new android.widget.LinearLayout.LayoutParams(-1, 1));
      listContainer.addView(divider);
    }
  }

  renderList("");
  scroll.addView(listContainer);
  outer.addView(scroll);

  var dialog = new android.app.AlertDialog.Builder(ctx)
    .setTitle("📱 选择应用")
    .setView(outer)
    .setNegativeButton("取消", new android.content.DialogInterface.OnClickListener({
      onClick: function(d, which) { d.dismiss(); }
    }))
    .create();
  dialog.show();

  // Request focus and show keyboard
  searchEdit.requestFocus();
  try {
    var imm = ctx.getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
    imm.toggleSoftInput(android.view.inputmethod.InputMethodManager.SHOW_FORCED, 0);
  } catch(e_imm) {}

  // Live search
  searchEdit.addTextChangedListener(new android.text.TextWatcher({
    afterTextChanged: function(s) { renderList(s + ""); },
    beforeTextChanged: function(s, start, count, after) {},
    onTextChanged: function(s, start, before, count) {}
  }));
}

function confirmDelete(task, dialog) {
  dialogs.confirm("确认删除", "确定要删除「" + task.name + "」吗？", function(yes) {
    if (yes) {
      store.deleteTask(task.id);
      refreshList();
      dialog.dismiss();
      toast("已删除");
    }
  });
}

// ----- Step Editor Dialog -----
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function openStepEditor(stepsRef, taskName) {
  var ctx = activity;

  var dialog = new android.app.AlertDialog.Builder(ctx)
    .setTitle("⚙️ 签到步骤 — " + taskName)
    .setPositiveButton("完成", null)
    .setNegativeButton("取消", new android.content.DialogInterface.OnClickListener({
      onClick: function(d, which) { d.dismiss(); }
    }))
    .create();

  // Rebuild dialog content on delete
  function rebuildDialog() {
    scroll.removeAllViews();
    scroll.addView(buildStepList(stepsRef, rebuildDialog));
  }

  var scroll = new android.widget.ScrollView(ctx);
  scroll.addView(buildStepList(stepsRef, rebuildDialog));
  dialog.setView(scroll);

  dialog.show();

  dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE).setOnClickListener(new android.view.View.OnClickListener({
    onClick: function(v) {
      toast("步骤已更新");
      dialog.dismiss();
    }
  }));
}

function buildStepList(steps, onRefresh) {
  var ll = new android.widget.LinearLayout(activity);
  ll.setOrientation(android.widget.LinearLayout.VERTICAL);
  ll.setPadding(16, 8, 16, 8);
  var params = new android.widget.LinearLayout.LayoutParams(-1, -2);
  params.setMargins(0, 4, 0, 4);

  for (var i = 0; i < steps.length; i++) {
    var card = buildStepCard(steps[i], i, steps, onRefresh);
    card.setLayoutParams(params);
    ll.addView(card);
  }

  var addBtn = new android.widget.Button(activity);
  addBtn.setText("+ 添加步骤");
  addBtn.setTextColor(colors.parseColor("#2196f3"));
  addBtn.setBackgroundColor(colors.parseColor("#e3f2fd"));
  addBtn.setLayoutParams(params);
  addBtn.setOnClickListener(new android.view.View.OnClickListener() {
    onClick: function(v) {
      showStepTypePicker(steps, onRefresh);
    }
  });
  ll.addView(addBtn);

  return ll;
}

function buildStepCard(step, index, steps, onRefresh) {
  var card = new android.widget.FrameLayout(activity);
  card.setBackgroundColor(colors.parseColor("#ffffff"));

  var row = new android.widget.LinearLayout(activity);
  row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
  row.setPadding(12, 8, 12, 8);
  row.setGravity(android.view.Gravity.CENTER_VERTICAL);

  var num = new android.widget.TextView(activity);
  num.setText("" + (index + 1));
  num.setTextColor(colors.parseColor("#4caf50"));
  num.setTextSize(16);
  num.setTypeface(null, android.graphics.Typeface.BOLD);
  row.addView(num);

  var desc = new android.widget.TextView(activity);
  desc.setText(describeStep(step));
  desc.setTextColor(colors.parseColor("#333333"));
  desc.setTextSize(14);
  desc.setPadding(12, 0, 0, 0);
  desc.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, -2, 1));
  row.addView(desc);

  // Move up button (hidden for first step)
  if (index > 0) {
    var upBtn = new android.widget.TextView(activity);
    upBtn.setText("▲");
    upBtn.setTextColor(colors.parseColor("#2196f3"));
    upBtn.setTextSize(14);
    upBtn.setPadding(6, 0, 4, 0);
    (function(idx) {
      upBtn.setOnClickListener(new android.view.View.OnClickListener() {
        onClick: function(v) {
          moveStep(steps, idx, -1, onRefresh);
        }
      });
    })(index);
    row.addView(upBtn);
  }

  // Move down button (hidden for last step)
  if (index < steps.length - 1) {
    var downBtn = new android.widget.TextView(activity);
    downBtn.setText("▼");
    downBtn.setTextColor(colors.parseColor("#2196f3"));
    downBtn.setTextSize(14);
    downBtn.setPadding(4, 0, 6, 0);
    (function(idx) {
      downBtn.setOnClickListener(new android.view.View.OnClickListener() {
        onClick: function(v) {
          moveStep(steps, idx, 1, onRefresh);
        }
      });
    })(index);
    row.addView(downBtn);
  }

  var editBtn = new android.widget.TextView(activity);
  editBtn.setText("✎");
  editBtn.setTextColor(colors.parseColor("#999999"));
  editBtn.setTextSize(18);
  editBtn.setPadding(8, 0, 8, 0);
  editBtn.setOnClickListener(new android.view.View.OnClickListener() {
    onClick: function(v) {
      showStepDetailEditor(steps, index);
    }
  });
  row.addView(editBtn);

  var delBtn = new android.widget.TextView(activity);
  delBtn.setText("✕");
  delBtn.setTextColor(colors.parseColor("#f44336"));
  delBtn.setTextSize(18);
  delBtn.setPadding(8, 0, 0, 0);
  delBtn.setOnClickListener(new android.view.View.OnClickListener() {
    onClick: function(v) {
      steps.splice(index, 1);
      if (onRefresh) onRefresh();
      toast("已删除");
    }
  });
  row.addView(delBtn);

  card.addView(row);
  return card;
}

// Strip display-only properties before persisting
function cleanTaskArray(tasks) {
  var clean = [];
  for (var i = 0; i < tasks.length; i++) {
    var t = {};
    for (var key in tasks[i]) {
      if (key.indexOf("_") !== 0 && key !== "iconSrc") {
        t[key] = tasks[i][key];
      }
    }
    clean.push(t);
  }
  return clean;
}

function moveStep(steps, index, direction, onRefresh) {
  var newIndex = index + direction;
  if (newIndex < 0 || newIndex >= steps.length) return;
  var temp = steps[index];
  steps[index] = steps[newIndex];
  steps[newIndex] = temp;
  if (onRefresh) onRefresh();
}

function describeStep(step) {
  var icons = {
    launch: "🚀 打开应用",
    wait: "⏳ 等待 " + (step.value || 1000) + "ms",
    waitText: "⏳ 等待文字「" + (step.value || "") + "」",
    clickText: "👆 点击「" + (step.value || "") + "」",
    clickId: "👆 点击ID: " + (step.value || ""),
    clickDesc: "👆 点击描述: " + (step.value || ""),
    clickCoord: "👆 坐标 (" + (step.x || 0) + "," + (step.y || 0) + ")",
    swipe: "↕ 滑动",
    back: "🔙 返回",
    home: "🏠 桌面",
    closeApp: "✖ 关闭应用",
    ifText: "❓ 如果存在「" + (step.value || "") + "」",
    ifNotText: "❓ 如果不存在「" + (step.value || "") + "」",
    loop: "🔄 循环 " + (step.count || 3) + " 次"
  };
  return icons[step.type] || step.type;
}

function showStepTypePicker(steps, onRefresh) {
  var typeValues = [
    "launch", "wait", "waitText", "clickText", "clickId",
    "clickDesc", "clickCoord", "swipe", "back", "home", "closeApp",
    "ifText", "loop"
  ];
  var typeNames = [
    "🚀 启动应用", "⏳ 等待(毫秒)", "⏳ 等待文字出现", "👆 点击文字", "👆 点击ID",
    "👆 点击描述", "👆 点击坐标", "↕ 滑动", "🔙 返回", "🏠 回到桌面", "✖ 关闭应用",
    "❓ 如果存在文字", "🔄 循环"
  ];
  dialogs.select("选择步骤类型", typeNames, function(index) {
    if (index < 0) return;
    var type = typeValues[index];
    var newStep = { type: type };
    if (type === "wait") newStep.value = 2000;
    if (type === "waitText" || type === "clickText" ||
        type === "clickId" || type === "clickDesc" ||
        type === "ifText") newStep.value = "";
    if (type === "clickCoord") { newStep.x = 0; newStep.y = 0; }
    if (type === "swipe") { newStep.x1 = 0; newStep.y1 = 0; newStep.x2 = 0; newStep.y2 = 0; }
    if (type === "loop") { newStep.count = 3; newStep.steps = []; }

    steps.push(newStep);
    if (onRefresh) onRefresh();
    if (newStep.value === "" || newStep.x !== undefined) {
      showStepDetailEditor(steps, steps.length - 1);
    }
    toast("已添加步骤");
  });
}

function showStepDetailEditor(steps, index) {
  var step = steps[index];
  var ctx = activity;

  var scroll = new android.widget.ScrollView(ctx);
  var ll = new android.widget.LinearLayout(ctx);
  ll.setOrientation(android.widget.LinearLayout.VERTICAL);
  ll.setPadding(32, 16, 32, 16);

  var matchWrap = new android.widget.LinearLayout.LayoutParams(-1, -2);
  matchWrap.setMargins(0, 4, 0, 4);

  function addLabel(text) {
    var tv = new android.widget.TextView(ctx);
    tv.setText(text);
    tv.setTextSize(14);
    tv.setTextColor(colors.parseColor("#666666"));
    ll.addView(tv, new android.widget.LinearLayout.LayoutParams(-1, -2));
  }

  // Type (read-only)
  addLabel("类型");
  var tvType = new android.widget.TextView(ctx);
  tvType.setText(step.type);
  tvType.setTextSize(16);
  ll.addView(tvType, matchWrap);

  var inputs = {};

  switch (step.type) {
    case "wait":
      addLabel("等待时间(毫秒)");
      var et = new android.widget.EditText(ctx);
      et.setText(step.value + "");
      ll.addView(et, matchWrap);
      inputs.value = et;
      break;
    case "waitText":
    case "clickText":
    case "clickId":
    case "clickDesc":
    case "ifText":
      addLabel("文本内容");
      var et = new android.widget.EditText(ctx);
      et.setText(step.value);
      ll.addView(et, matchWrap);
      inputs.value = et;
      break;
    case "clickCoord":
      addLabel("X 坐标");
      var etX = new android.widget.EditText(ctx);
      etX.setText(step.x + "");
      ll.addView(etX, matchWrap);
      inputs.x = etX;
      addLabel("Y 坐标");
      var etY = new android.widget.EditText(ctx);
      etY.setText(step.y + "");
      ll.addView(etY, matchWrap);
      inputs.y = etY;
      break;
    case "swipe":
      addLabel("起点 X");
      var et = new android.widget.EditText(ctx);
      et.setText(step.x1 + "");
      ll.addView(et, matchWrap);
      inputs.x1 = et;
      addLabel("起点 Y");
      var et2 = new android.widget.EditText(ctx);
      et2.setText(step.y1 + "");
      ll.addView(et2, matchWrap);
      inputs.y1 = et2;
      addLabel("终点 X");
      var et3 = new android.widget.EditText(ctx);
      et3.setText(step.x2 + "");
      ll.addView(et3, matchWrap);
      inputs.x2 = et3;
      addLabel("终点 Y");
      var et4 = new android.widget.EditText(ctx);
      et4.setText(step.y2 + "");
      ll.addView(et4, matchWrap);
      inputs.y2 = et4;
      break;
    case "loop":
      addLabel("循环次数");
      var et = new android.widget.EditText(ctx);
      et.setText(step.count + "");
      ll.addView(et, matchWrap);
      inputs.count = et;
      break;
  }

  scroll.addView(ll);

  var dialog = new android.app.AlertDialog.Builder(ctx)
    .setTitle("编辑步骤")
    .setPositiveButton("确定", null)
    .setNegativeButton("取消", new android.content.DialogInterface.OnClickListener({
      onClick: function(d, which) { d.dismiss(); }
    }))
    .setView(scroll)
    .create();
  dialog.show();
  dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE).setOnClickListener(new android.view.View.OnClickListener({
    onClick: function(v) {
      if (inputs.value) step.value = inputs.value.getText() + "";
      if (inputs.x) step.x = parseInt(inputs.x.getText()) || 0;
      if (inputs.y) step.y = parseInt(inputs.y.getText()) || 0;
      if (inputs.x1) step.x1 = parseInt(inputs.x1.getText()) || 0;
      if (inputs.y1) step.y1 = parseInt(inputs.y1.getText()) || 0;
      if (inputs.x2) step.x2 = parseInt(inputs.x2.getText()) || 0;
      if (inputs.y2) step.y2 = parseInt(inputs.y2.getText()) || 0;
      if (inputs.count) step.count = parseInt(inputs.count.getText()) || 3;
      toast("步骤已更新");
      dialog.dismiss();
    }
  }));
}

// ----- Manual execution -----
// Run all enabled tasks in sequence with 2s interval
function runAllTasks() {
  var tasks = store.loadTasks();
  var enabled = [];
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].enabled) enabled.push(tasks[i]);
  }
  if (enabled.length === 0) {
    toast("没有已启用的任务");
    return;
  }
  var engine = require("./step-engine");
  var successCount = 0;
  var failCount = 0;
  toast("▶ 开始执行 " + enabled.length + " 个任务");
  for (var i = 0; i < enabled.length; i++) {
    var t = enabled[i];
    toast("(" + (i + 1) + "/" + enabled.length + ") 执行: " + t.name);
    var result = engine.executeTask(t);
    if (result.ok) {
      toast("✅ " + t.name + " 完成");
      successCount++;
    } else {
      toast("❌ " + t.name + " 失败: " + result.error);
      failCount++;
    }
    // Wait 2 seconds between tasks
    if (i < enabled.length - 1) sleep(2000);
  }
  toast("✅ 全部完成: " + successCount + "成功, " + failCount + "失败");
}

function runTaskNow(task) {
  dialogs.confirm("手动执行", "立即执行「" + task.name + "」的签到任务？", function(yes) {
    if (!yes) return;
    var engine = require("./step-engine");
    var thread = threads.start(function() {
      toast("开始执行: " + task.name);
      var result = engine.executeTask(task);
      if (result.ok) {
        toast("✅ " + task.name + " 签到完成");
      } else {
        toast("❌ " + task.name + " 失败: " + result.error);
      }
    });
  });
}

// ----- Scheduler Panel -----
var schedulerThread = null;

function openSchedulerPanel() {
  var ctx = activity;
  var statusText = schedulerThread ? "🟢 运行中" : "🔴 已停止";

  var ll = new android.widget.LinearLayout(ctx);
  ll.setOrientation(android.widget.LinearLayout.VERTICAL);
  ll.setPadding(32, 16, 32, 16);

  var title = new android.widget.TextView(ctx);
  title.setText("后台调度器");
  title.setTextSize(16);
  title.setTypeface(null, android.graphics.Typeface.BOLD);
  title.setTextColor(colors.parseColor("#333333"));
  ll.addView(title);

  var desc = new android.widget.TextView(ctx);
  desc.setText("调度器每分钟检查一次，到达设定时段时自动执行签到任务。");
  desc.setTextSize(13);
  desc.setTextColor(colors.parseColor("#666666"));
  desc.setPadding(0, 16, 0, 0);
  ll.addView(desc);

  var status = new android.widget.TextView(ctx);
  status.setText("状态: " + statusText);
  status.setTextSize(14);
  status.setPadding(0, 16, 0, 0);
  ll.addView(status);

  var btnText = schedulerThread ? "停止调度" : "启动调度";
  var dialog = new android.app.AlertDialog.Builder(ctx)
    .setTitle("⏰ 调度设置")
    .setView(ll)
    .setPositiveButton(btnText, null)
    .setNegativeButton("关闭", new android.content.DialogInterface.OnClickListener({
      onClick: function(d, which) { d.dismiss(); }
    }))
    .create();
  dialog.show();
  dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE).setOnClickListener(new android.view.View.OnClickListener({
    onClick: function(v) {
      if (schedulerThread) {
        schedulerThread.interrupt();
        schedulerThread = null;
        toast("调度器已停止");
      } else {
        schedulerThread = threads.start(function() {
          var sched = require("./scheduler");
          sched.main();
        });
        toast("调度器已启动");
      }
      dialog.dismiss();
    }
  }));
}

// ----- Task Reorder Panel -----
function openTaskReorderPanel() {
  var ctx = activity;
  var scroll = new android.widget.ScrollView(ctx);

  function buildList() {
    var tasks = store.loadTasks();
    var ll = new android.widget.LinearLayout(ctx);
    ll.setOrientation(android.widget.LinearLayout.VERTICAL);
    ll.setPadding(16, 8, 16, 8);
    var matchWrap = new android.widget.LinearLayout.LayoutParams(-1, -2);
    matchWrap.setMargins(0, 4, 0, 4);

    for (var i = 0; i < tasks.length; i++) {
      (function(idx) {
        var task = tasks[idx];
        var row = new android.widget.LinearLayout(ctx);
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        row.setPadding(12, 8, 12, 8);
        row.setBackgroundColor(colors.parseColor("#ffffff"));
        row.setLayoutParams(matchWrap);

        var indexText = new android.widget.TextView(ctx);
        indexText.setText((idx + 1) + ".");
        indexText.setTextColor(colors.parseColor("#4caf50"));
        indexText.setTextSize(15);
        indexText.setTypeface(null, android.graphics.Typeface.BOLD);
        indexText.setPadding(0, 0, 8, 0);
        row.addView(indexText);

        var nameText = new android.widget.TextView(ctx);
        nameText.setText(task.name || "未命名");
        nameText.setTextColor(colors.parseColor("#333333"));
        nameText.setTextSize(14);
        nameText.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, -2, 1));
        row.addView(nameText);

        if (idx > 0) {
          var upBtn = new android.widget.TextView(ctx);
          upBtn.setText("▲");
          upBtn.setTextColor(colors.parseColor("#2196f3"));
          upBtn.setTextSize(18);
          upBtn.setPadding(6, 0, 6, 0);
          upBtn.setOnClickListener(new android.view.View.OnClickListener() {
            onClick: function(v) {
              var t = tasks[idx]; tasks[idx] = tasks[idx - 1]; tasks[idx - 1] = t;
              store.saveTasks(cleanTaskArray(tasks)); refreshList();
              scroll.removeAllViews(); scroll.addView(buildList());
            }
          });
          row.addView(upBtn);
        }
        if (idx < tasks.length - 1) {
          var downBtn = new android.widget.TextView(ctx);
          downBtn.setText("▼");
          downBtn.setTextColor(colors.parseColor("#2196f3"));
          downBtn.setTextSize(18);
          downBtn.setPadding(6, 0, 6, 0);
          downBtn.setOnClickListener(new android.view.View.OnClickListener() {
            onClick: function(v) {
              var t = tasks[idx]; tasks[idx] = tasks[idx + 1]; tasks[idx + 1] = t;
              store.saveTasks(cleanTaskArray(tasks)); refreshList();
              scroll.removeAllViews(); scroll.addView(buildList());
            }
          });
          row.addView(downBtn);
        }
        ll.addView(row);
      })(i);
    }
    return ll;
  }

  scroll.addView(buildList());

  new android.app.AlertDialog.Builder(ctx)
    .setTitle("↑↓ 任务排序")
    .setView(scroll)
    .setPositiveButton("完成", new android.content.DialogInterface.OnClickListener({
      onClick: function(d, which) { d.dismiss(); }
    }))
    .show();
}

// ----- Logs Panel -----
function openLogsPanel() {
  var logs = store.loadLogs();
  var ctx = activity;

  var scroll = new android.widget.ScrollView(ctx);
  var ll = new android.widget.LinearLayout(ctx);
  ll.setOrientation(android.widget.LinearLayout.VERTICAL);
  ll.setPadding(16, 8, 16, 8);

  // ====== Statistics Section ======
  var todayStr = new Date().toISOString().slice(0, 10);
  var totalExec = logs.length;
  var todayExec = 0, todaySuccess = 0, todayFail = 0;
  var totalSuccess = 0, totalFail = 0;
  var taskStats = {};
  var successDays = {};

  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    var dateKey = log.time.slice(0, 10);

    if (dateKey === todayStr) {
      todayExec++;
      if (log.status === "success") todaySuccess++; else todayFail++;
    }
    if (log.status === "success") {
      totalSuccess++;
      successDays[dateKey] = true;
    } else {
      totalFail++;
    }

    if (!taskStats[log.taskId]) {
      taskStats[log.taskId] = { name: log.taskName, s: 0, f: 0 };
    }
    if (log.status === "success") taskStats[log.taskId].s++;
    else taskStats[log.taskId].f++;
  }

  // Streak: count consecutive days back from today with at least one success
  var streak = 0;
  var d = new Date();
  while (successDays[d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate())]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  var successRate = totalExec > 0 ? (totalSuccess / totalExec * 100).toFixed(1) : "0.0";
  var matchWrap = new android.widget.LinearLayout.LayoutParams(-1, -2);
  matchWrap.setMargins(0, 4, 0, 4);

  // Stats card
  var statsCard = new android.widget.FrameLayout(ctx);
  statsCard.setBackgroundColor(colors.parseColor("#ffffff"));
  statsCard.setPadding(16, 12, 16, 12);
  var cardLp = new android.widget.LinearLayout.LayoutParams(-1, -2);
  cardLp.setMargins(0, 0, 0, 12);
  statsCard.setLayoutParams(cardLp);

  var statsInner = new android.widget.LinearLayout(ctx);
  statsInner.setOrientation(android.widget.LinearLayout.VERTICAL);

  function addStatRow(label, value, color) {
    var row = new android.widget.LinearLayout(ctx);
    row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    row.setPadding(0, 4, 0, 4);
    var tv1 = new android.widget.TextView(ctx);
    tv1.setText(label);
    tv1.setTextSize(13);
    tv1.setTextColor(colors.parseColor("#666666"));
    row.addView(tv1);
    var tv2 = new android.widget.TextView(ctx);
    tv2.setText(value);
    tv2.setTextSize(13);
    tv2.setTypeface(null, android.graphics.Typeface.BOLD);
    tv2.setTextColor(colors.parseColor(color || "#333333"));
    tv2.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, -2, 1));
    tv2.setGravity(android.view.Gravity.RIGHT);
    row.addView(tv2);
    statsInner.addView(row);
  }

  addStatRow("📊 总体统计", "", "#333333");
  addStatRow("  总执行", totalExec + " 次", "#333333");
  addStatRow("  成功率", successRate + "%", successRate >= 80 ? "#4caf50" : "#ff9800");
  addStatRow("  累计成功天数", Object.keys(successDays).length + " 天", "#2196f3");
  addStatRow("  连续签到", streak + " 天", streak >= 3 ? "#ff5722" : "#2196f3");
  addStatRow("", "", "#333333");
  addStatRow("📅 今日统计", "", "#333333");
  addStatRow("  执行次数", todayExec + " 次", "#333333");
  addStatRow("  成功", todaySuccess + " 次", "#4caf50");
  addStatRow("  失败", todayFail + " 次", todayFail > 0 ? "#f44336" : "#999999");

  // Task breakdown
  var taskKeys = Object.keys(taskStats);
  if (taskKeys.length > 0) {
    addStatRow("", "", "#333333");
    addStatRow("📋 各任务统计", "", "#333333");
    for (var t = 0; t < taskKeys.length; t++) {
      var ts = taskStats[taskKeys[t]];
      var tr = ts.s + ts.f > 0 ? (ts.s / (ts.s + ts.f) * 100).toFixed(1) : "0.0";
      addStatRow("  " + ts.name, "✅" + ts.s + " ❌" + ts.f + " (" + tr + "%)", "#333333");
    }
  }

  statsCard.addView(statsInner);
  ll.addView(statsCard);

  // ====== Log Entries ======
  var logTitle = new android.widget.TextView(ctx);
  logTitle.setText("📋 最近执行记录");
  logTitle.setTextSize(14);
  logTitle.setTypeface(null, android.graphics.Typeface.BOLD);
  logTitle.setTextColor(colors.parseColor("#333333"));
  logTitle.setPadding(0, 8, 0, 8);
  ll.addView(logTitle);

  if (logs.length === 0) {
    var empty = new android.widget.TextView(ctx);
    empty.setText("暂无执行日志");
    empty.setTextSize(14);
    empty.setTextColor(colors.parseColor("#999999"));
    empty.setGravity(android.view.Gravity.CENTER);
    empty.setPadding(0, 32, 0, 32);
    ll.addView(empty);
  } else {
    var start = Math.max(0, logs.length - 20);
    for (var i = logs.length - 1; i >= start; i--) {
      var log = logs[i];
      var logRow = new android.widget.LinearLayout(ctx);
      logRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
      logRow.setPadding(16, 8, 16, 8);
      logRow.setBackgroundColor(colors.parseColor("#f5f5f5"));
      var lp = new android.widget.LinearLayout.LayoutParams(-1, -2);
      lp.setMargins(0, 4, 0, 4);
      logRow.setLayoutParams(lp);

      var statusIcon = new android.widget.TextView(ctx);
      statusIcon.setText(log.status === "success" ? "✅" : "❌");
      statusIcon.setTextSize(16);
      logRow.addView(statusIcon);

      var infoCol = new android.widget.LinearLayout(ctx);
      infoCol.setOrientation(android.widget.LinearLayout.VERTICAL);
      infoCol.setPadding(12, 0, 0, 0);
      infoCol.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, -2, 1));

      var taskName = new android.widget.TextView(ctx);
      taskName.setText(log.taskName);
      taskName.setTextSize(14);
      taskName.setTypeface(null, android.graphics.Typeface.BOLD);
      taskName.setTextColor(colors.parseColor("#333333"));
      infoCol.addView(taskName);

      var meta = new android.widget.TextView(ctx);
      meta.setText(log.time + " | " + (log.duration / 1000).toFixed(1) + "s");
      meta.setTextSize(11);
      meta.setTextColor(colors.parseColor("#999999"));
      infoCol.addView(meta);

      if (log.error) {
        var err = new android.widget.TextView(ctx);
        err.setText(log.error);
        err.setTextSize(11);
        err.setTextColor(colors.parseColor("#f44336"));
        infoCol.addView(err);
      }

      logRow.addView(infoCol);
      ll.addView(logRow);
    }
  }

  scroll.addView(ll);

  new android.app.AlertDialog.Builder(ctx)
    .setTitle("📝 执行日志")
    .setView(scroll)
    .setPositiveButton("关闭", new android.content.DialogInterface.OnClickListener({
      onClick: function(d, which) { d.dismiss(); }
    }))
    .show();
}
