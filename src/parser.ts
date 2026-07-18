import * as chrono from "chrono-node";
import { Chrono, Parser, ParsingContext } from "chrono-node";
import { moment } from "obsidian";

import { DayOfWeek } from "./settings";
import {
  ZH_RELATIVE_DAYS,
  ZH_SPECIAL_DATES,
  ZH_ORDINALS,
  ZH_THIS,
  ZH_NEXT,
  ZH_WEEK_WORDS,
  ZH_MONTH_WORDS,
  ZH_YEAR_WORDS,
  ZH_POSITION,
} from "./locale";
import { getLastDayOfMonth, getLocaleWeekStart } from "./utils";

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: moment.Moment;
}

// 繁体→简体日期字符映射，确保 chrono zh.hans 能正确解析繁体输入
const TRAD_TO_SIMP: Record<string, string> = {
  "週": "周",
  "禮": "礼",
  "個": "个",
  "這": "这",
  "來": "来",
  "節": "节",
  "勞": "劳",
  "動": "动",
  "國": "国",
  "慶": "庆",
  "聖": "圣",
  "誕": "诞",
  "萬": "万",
  "後": "后",
  "陽": "阳",
  "終": "终",
};

function normalizeTraditional(text: string): string {
  let result = text;
  for (const [trad, simp] of Object.entries(TRAD_TO_SIMP)) {
    result = result.replace(new RegExp(trad, "g"), simp);
  }
  return result;
}

function createZhChrono(): Chrono {
  const zhConfig = chrono.zh.hans.createCasualConfiguration();
  const zhChrono = new Chrono(zhConfig);

  // Custom Parser 1: 特殊公历日期（元旦、国庆、圣诞等）
  const specialKeys = Object.keys(ZH_SPECIAL_DATES).sort(
    (a: string, b: string) => b.length - a.length
  );
  if (specialKeys.length > 0) {
    const specialPattern = specialKeys.join("|");
    zhChrono.parsers.push({
      pattern: () => new RegExp(specialPattern),
      extract: (_context: ParsingContext, match: RegExpMatchArray) => {
        const date = ZH_SPECIAL_DATES[match[0] as string];
        if (date) {
          return { day: date.day, month: date.month };
        }
        return null;
      },
    } as Parser);
  }

  // Custom Parser 2: 中文序数词「第一」「第二」... 「第三十一」
  const ordinalKeys = Object.keys(ZH_ORDINALS).sort(
    (a: string, b: string) => b.length - a.length
  );
  const ordinalPattern = ordinalKeys.join("|");
  zhChrono.parsers.push({
    pattern: () => new RegExp(`第(${ordinalPattern})`),
    extract: (_context: ParsingContext, match: RegExpMatchArray) => {
      const num = ZH_ORDINALS[match[1] as string];
      if (num !== undefined) {
        return { day: num, month: moment().month() + 1 };
      }
      return null;
    },
  } as Parser);

  // Custom Parser 3: 相对日（后天、大后天、前天、大前天）
  // chrono zh.hans 只覆盖今天/明天/昨天
  const relativeEntries: [string, number][] = Object.entries(ZH_RELATIVE_DAYS)
    .filter(
      ([, offset]: [string, number]) =>
        offset !== 0 && offset !== 1 && offset !== -1
    )
    .sort(
      (a: [string, number], b: [string, number]) => b[0].length - a[0].length
    );

  if (relativeEntries.length > 0) {
    const relPattern = relativeEntries.map(([k]: [string, number]) => k).join("|");
    zhChrono.parsers.push({
      pattern: () => new RegExp(relPattern),
      extract: (context: any, match: any) => {
        const offset = ZH_RELATIVE_DAYS[match[0] as string];
        if (offset !== undefined) {
          const refDate = context.refDate || new Date();
          const target = new Date(refDate);
          target.setDate(target.getDate() + offset);
          return {
            day: target.getDate(),
            month: target.getMonth() + 1,
            year: target.getFullYear(),
          };
        }
        return null;
      },
    } as Parser);
  }

  return zhChrono;
}

// 构建用于正则的模式片段
function buildPattern(words: string[]): string {
  return words.sort((a: string, b: string) => b.length - a.length).join("|");
}

const THIS_PATTERN = buildPattern(ZH_THIS);
const NEXT_PATTERN = buildPattern(ZH_NEXT);
const WEEK_PATTERN = buildPattern(ZH_WEEK_WORDS);
const MONTH_PATTERN = buildPattern(ZH_MONTH_WORDS);
const YEAR_PATTERN = buildPattern(ZH_YEAR_WORDS);
const END_OF_MONTH_PATTERN = buildPattern(ZH_POSITION.endOfMonth);
const MID_OF_MONTH_PATTERN = buildPattern(ZH_POSITION.midOfMonth);

// 安全解析日期，失败时返回当前日期
function safeParseDate(parser: Chrono, text: string, refDate?: Date, option?: chrono.ParsingOption): Date {
  const result = parser.parseDate(text, refDate, option);
  return result ?? new Date();
}

export default class NLDParser {
  chrono: Chrono;

  constructor() {
    this.chrono = createZhChrono();
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    const normalizedText = normalizeTraditional(selectedText);
    const parser = this.chrono;
    const initialParse = parser.parse(normalizedText);
    const weekdayIsCertain = initialParse[0]?.start.isCertain("weekday");

    const weekStart =
      weekStartPreference === "locale-default"
        ? getLocaleWeekStart()
        : weekStartPreference;

    // ---- 特殊模式处理 ----

    // 「这周 / 本周 / 这个星期」→ 本周第一天
    const thisWeekRe = new RegExp(
      `^(?:${THIS_PATTERN})\\s*(?:${WEEK_PATTERN})$`
    );
    if (thisWeekRe.test(normalizedText.trim())) {
      return safeParseDate(parser, `本周${weekStart}`, new Date());
    }

    // 「下周 / 下个星期」→ 下周第一天
    const nextWeekRe = new RegExp(
      `^(?:${NEXT_PATTERN})\\s*(?:${WEEK_PATTERN})$`
    );
    if (nextWeekRe.test(normalizedText.trim())) {
      return safeParseDate(parser, `下周${weekStart}`, new Date(), {
        forwardDate: true,
      });
    }

    // 「下个月 / 下月」
    const nextMonthRe = new RegExp(
      `^(?:${NEXT_PATTERN})\\s*(?:${MONTH_PATTERN})$`
    );
    if (nextMonthRe.test(normalizedText.trim())) {
      const thisMonth = safeParseDate(parser, "本月", new Date(), {
        forwardDate: true,
      });
      return safeParseDate(parser, normalizedText, thisMonth, {
        forwardDate: true,
      });
    }

    // 「明年 / 来年」
    const nextYearRe = new RegExp(
      `^(?:${NEXT_PATTERN}|明)\\s*(?:${YEAR_PATTERN})$`
    );
    if (nextYearRe.test(normalizedText.trim())) {
      const thisYear = safeParseDate(parser, "今年", new Date(), {
        forwardDate: true,
      });
      return safeParseDate(parser, normalizedText, thisYear, {
        forwardDate: true,
      });
    }

    // 「月底 / 月末」→ 当月最后一天
    const endOfMonthRe = new RegExp(
      `(${END_OF_MONTH_PATTERN})\\s*([^\\n\\r]*)`
    );
    const endOfMonthMatch = normalizedText.match(endOfMonthRe);
    if (endOfMonthMatch) {
      const contextStr = endOfMonthMatch[2].trim() || "本月";
      const tempDate = parser.parse(contextStr);
      const year =
        tempDate[0]?.start.get("year") ?? moment().year();
      const month =
        tempDate[0]?.start.get("month") ?? moment().month() + 1;
      const lastDay = getLastDayOfMonth(year, month);
      return safeParseDate(
        parser,
        `${year}-${month}-${lastDay}`,
        new Date(),
        { forwardDate: true }
      );
    }

    // 「月中」→ 当月 15 日
    const midOfMonthRe = new RegExp(
      `(${MID_OF_MONTH_PATTERN})\\s*([^\\n\\r]*)`
    );
    const midOfMonthMatch = normalizedText.match(midOfMonthRe);
    if (midOfMonthMatch) {
      const contextStr = midOfMonthMatch[2].trim() || "本月";
      return safeParseDate(parser, `${contextStr} 15日`, new Date(), {
        forwardDate: true,
      });
    }

    // 只对裸星期几（如「周五」而非「下周五」）使用 moment 计算，
    // 避免 chrono「最近匹配」策略受参考日期偏移影响而跳到上周。
    // 「下周五」等带修饰词的由 chrono 正常解析（isCertain("day")=true）。
    if (weekdayIsCertain && !initialParse[0]?.start.isCertain("day")) {
      const weekdayNum = initialParse[0]?.start.get("weekday");
      if (typeof weekdayNum === "number") {
        // 将周几的名称转为数字 (Sunday=0)
        const toDayNum = (d: string): number => {
          switch (d) {
            case "sunday": return 0;
            case "monday": return 1;
            case "tuesday": return 2;
            case "wednesday": return 3;
            case "thursday": return 4;
            case "friday": return 5;
            case "saturday": return 6;
            default: return 1;
          }
        };
        const startDay = weekStartPreference === "locale-default"
          ? toDayNum(getLocaleWeekStart())
          : toDayNum(weekStartPreference);

        const today = moment();
        const weekStart = today.clone().day(startDay);
        if (weekStart.isAfter(today, "day")) {
          weekStart.subtract(7, "days");
        }

        const offset = (weekdayNum - startDay + 7) % 7;
        return weekStart.add(offset, "days").toDate();
      }
    }

    return safeParseDate(parser, normalizedText, new Date());
  }
}
