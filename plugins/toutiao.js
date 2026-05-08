module.exports = {
  name: "今日头条",
  packageName: "com.ss.android.article.news",
  steps: [
    { type: "launch" },
    { type: "wait", value: 6000 },
    { type: "clickText", value: "我的" },
    { type: "wait", value: 3000 },
    { type: "clickText", value: "签到" },
    { type: "wait", value: 3000 },
    { type: "clickText", value: "领取奖励" },
    { type: "wait", value: 2000 },
    { type: "back" },
    { type: "wait", value: 1000 },
    { type: "back" }
  ]
};
