import { Lunar, Solar } from "lunar-typescript";

const lunarDates: Record<string, [number, number]> = {
  春节: [1, 1], 元宵: [1, 15], 端午: [5, 5], 七夕: [7, 7],
  中秋: [8, 15], 重阳: [9, 9], 腊八: [12, 8],
};

// A specified year always means the Gregorian year containing the holiday.
export function parseHoliday(text: string, reference = new Date()): { date: Date; explicitYear: boolean } | null {
  const normalized = text.trim().replace(/春節/g, "春节").replace(/重陽/g, "重阳").replace(/臘/g, "腊").replace(/節/g, "节");
  const match = normalized.match(/^(?:(今年|本年|明年|来年|來年|去年)|(\d{4})年)?(春节|元宵节?|端午节?|七夕节?|中秋节?|重阳节?|腊八节?|除夕|清明节?|冬至)$/);
  if (!match) return null;
  const year = match[2] ? Number(match[2]) : reference.getFullYear() + (/^(明年|来年|來年)$/.test(match[1]) ? 1 : match[1] === "去年" ? -1 : 0);
  const name = match[3] === "春节" ? "春节" : match[3].replace(/节$/, "");
  let date: Date = new Date(NaN);
  if (year >= 1900 && year <= 2100) {
    if (name === "清明" || name === "冬至") {
      const table = Solar.fromYmd(year, 7, 1).getLunar().getJieQiTable();
      const solar = Object.values(table).find((value) => value.getYear() === year && value.getMonth() === (name === "清明" ? 4 : 12) && value.getDay() >= (name === "清明" ? 4 : 20) && value.getDay() <= (name === "清明" ? 6 : 23));
      if (solar) date = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
    } else {
      for (const lunarYear of [year - 1, year]) {
        const [month, day] = name === "除夕" ? [1, 1] : lunarDates[name];
        const solar = Lunar.fromYmd(name === "除夕" ? lunarYear + 1 : lunarYear, month, day).getSolar();
        const candidate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
        if (name === "除夕") candidate.setDate(candidate.getDate() - 1);
        if (candidate.getFullYear() === year) { date = candidate; break; }
      }
    }
  }
  return { date, explicitYear: Boolean(match[1] || match[2]) };
}
