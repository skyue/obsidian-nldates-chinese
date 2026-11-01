import { ZH_ORDINALS, ZH_SPECIAL_DATES, ZH_WEEKDAY_TO_NUM } from "../locale";

export interface DateCandidate {
  label: string;
  date: Date;
}

// null means this is not a supported ambiguous expression; [] means no valid date.
export function getDateCandidates(query: string, today: Date, weekStart: number): DateCandidate[] | null {
  const text = query.trim();
  const offsets = [0, 1, -1];
  const day = (year: number, month: number, date: number): Date | null => {
    const result = new Date(year, month, date);
    return result.getFullYear() === year && result.getMonth() === month && result.getDate() === date ? result : null;
  };
  const collect = (build: (offset: number, index: number) => { label: string; date: Date | null }): DateCandidate[] =>
    offsets.map(build).filter((item): item is DateCandidate => item.date !== null);
  const year = today.getFullYear();
  const month = today.getMonth();
  const weekday = ZH_WEEKDAY_TO_NUM[text];
  if (weekday !== undefined) {
    return collect((offset, index) => ({
      label: ["本", "下", "上"][index] + text,
      date: new Date(year, month, today.getDate() - (today.getDay() - weekStart + 7) % 7 + (weekday - weekStart + 7) % 7 + offset * 7),
    }));
  }
  const number = (value: string): number => /^\d+$/.test(value) ? Number(value) : ZH_ORDINALS[value];
  const dateMatch = text.match(/^([\d一二三四五六七八九十]+)[号號日]$/);
  const monthDateMatch = text.match(/^([\d一二三四五六七八九十]+)月([\d一二三四五六七八九十]+)[日号號]?$/);
  if (dateMatch) {
    const date = number(dateMatch[1]);
    return collect((offset, index) => {
      const target = new Date(year, month + offset, 1);
      return { label: ["本月", "下月", "上月"][index] + date + "日", date: day(target.getFullYear(), target.getMonth(), date) };
    });
  }
  const position = text.match(/^(月初|月中|月底|月末|年初|年底|年末|年终|年終)$/);
  if (position) {
    const annual = text.startsWith("年");
    return collect((offset, index) => {
      const targetYear = year + (annual ? offset : 0);
      const targetMonth = annual ? 0 : month + offset;
      const date = text.endsWith("初") ? new Date(targetYear, targetMonth, 1)
        : text === "月中" ? new Date(targetYear, targetMonth, 15)
        : annual ? new Date(targetYear, 11, 31) : new Date(targetYear, targetMonth + 1, 0);
      return { label: (annual ? ["今年", "明年", "去年"] : ["本月", "下月", "上月"])[index] + text.slice(1), date };
    });
  }
  // These entries currently contain fixed approximations, not annual calendar rules.
  const excluded = /^(除夕|元宵|端午|中秋|七夕|重阳|重陽|感恩节|感恩節)$/;
  const holiday = excluded.test(text) ? undefined : ZH_SPECIAL_DATES[text];
  if (monthDateMatch || holiday) {
    const targetMonth = monthDateMatch ? number(monthDateMatch[1]) : holiday!.month;
    const targetDay = monthDateMatch ? number(monthDateMatch[2]) : holiday!.day;
    return collect((offset, index) => ({
      label: ["今年", "明年", "去年"][index] + text,
      date: day(year + offset, targetMonth - 1, targetDay),
    }));
  }
  return null;
}
