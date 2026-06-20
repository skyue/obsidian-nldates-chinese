/**
 * 中文日期词库：序数词、星期、相对日期、特殊日期
 */

// ---- 序数词 ----
export const ZH_ORDINALS: Record<string, number> = {
  "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
  "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
  "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
  "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
  "二十一": 21, "二十二": 22, "二十三": 23, "二十四": 24, "二十五": 25,
  "二十六": 26, "二十七": 27, "二十八": 28, "二十九": 29, "三十": 30,
  "三十一": 31,
};

// ---- 星期 ----
export const ZH_WEEKDAYS_LONG = [
  "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日",
];

export const ZH_WEEKDAYS_SHORT = [
  "周一", "周二", "周三", "周四", "周五", "周六", "周日",
];

export const ZH_WEEKDAYS_ALT = [
  "礼拜一", "礼拜二", "礼拜三", "礼拜四", "礼拜五", "礼拜六", "礼拜天",
];

// 星期名称 → 序号（0=Sunday 对应 moment）
export const ZH_WEEKDAY_TO_NUM: Record<string, number> = {
  "星期一": 1, "星期二": 2, "星期三": 3, "星期四": 4, "星期五": 5, "星期六": 6, "星期日": 0,
  "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5, "周六": 6, "周日": 0,
  "礼拜一": 1, "礼拜二": 2, "礼拜三": 3, "礼拜四": 4, "礼拜五": 5, "礼拜六": 6, "礼拜天": 0,
};

// ---- 相对日期 ----
export const ZH_RELATIVE_DAYS: Record<string, number> = {
  "今天": 0,
  "今日": 0,
  "明天": 1,
  "明日": 1,
  "后天": 2,
  "後天": 2,
  "大后天": 3,
  "大後天": 3,
  "昨天": -1,
  "昨日": -1,
  "前天": -2,
  "大前天": -3,
};

// ---- 周期指示词 ----
export const ZH_THIS = ["这个", "这", "本"];
export const ZH_NEXT = ["下个", "下", "来"];
export const ZH_LAST = ["上个", "上", "去"];

// ---- 周期单位 ----
export const ZH_WEEK_WORDS = ["周", "星期", "礼拜"];
export const ZH_MONTH_WORDS = ["月", "月份"];
export const ZH_YEAR_WORDS = ["年"];

// ---- 月份名称 ----
export const ZH_MONTHS: Record<string, number> = {
  "一月": 1, "二月": 2, "三月": 3, "四月": 4, "五月": 5, "六月": 6,
  "七月": 7, "八月": 8, "九月": 9, "十月": 10, "十一月": 11, "十二月": 12,
  "1月": 1, "2月": 2, "3月": 3, "4月": 4, "5月": 5, "6月": 6,
  "7月": 7, "8月": 8, "9月": 9, "10月": 10, "11月": 11, "12月": 12,
};

// ---- 特殊位置 ----
export const ZH_POSITION = {
  endOfMonth: ["月底", "月末"],
  midOfMonth: ["月中"],
  startOfMonth: ["月初"],
  endOfYear: ["年底", "年末", "年终"],
  startOfYear: ["年初"],
};

// ---- 特殊公历日期 ----
export const ZH_SPECIAL_DATES: Record<string, { month: number; day: number }> = {
  "元旦": { month: 1, day: 1 },
  "劳动节": { month: 5, day: 1 },
  "五一": { month: 5, day: 1 },
  "五四": { month: 5, day: 4 },
  "六一": { month: 6, day: 1 },
  "七一": { month: 7, day: 1 },
  "八一": { month: 8, day: 1 },
  "国庆": { month: 10, day: 1 },
  "十一": { month: 10, day: 1 },
  "圣诞": { month: 12, day: 25 },
  "圣诞节": { month: 12, day: 25 },
  "平安夜": { month: 12, day: 24 },
  "情人节": { month: 2, day: 14 },
  "愚人节": { month: 4, day: 1 },
  "万圣节": { month: 10, day: 31 },
  "感恩节": { month: 11, day: 27 }, // 近似，实际是11月第四个周四
  "除夕": { month: 1, day: 28 }, // 农历，仅作近似
  "元宵": { month: 2, day: 12 }, // 农历，仅作近似
  "端午": { month: 6, day: 1 }, // 农历，仅作近似
  "中秋": { month: 9, day: 15 }, // 农历，仅作近似
  "重阳": { month: 10, day: 9 }, // 农历，仅作近似
  "七夕": { month: 8, day: 4 }, // 农历，仅作近似
};

// ---- 数量单位（用于 X天前/后 类型）----
export const ZH_NUMBER_UNITS: Record<string, string> = {
  "天": "d",
  "日": "d",
  "周": "w",
  "星期": "w",
  "礼拜": "w",
  "月": "M",
  "个月": "M",
  "年": "y",
};
