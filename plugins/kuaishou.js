module.exports = {
  name: "快手",
  packageName: "com.kuaishou.nebula",
  steps: [
    { type: "launch" },
    { type: "wait", value: 5000 },
    { type: "clickText", value: "签到" },
    { type: "wait", value: 3000 },
    { type: "clickText", value: "领取" },
    { type: "wait", value: 2000 },
    { type: "back" }
  ]
};
