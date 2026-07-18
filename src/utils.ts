import {
  App,
  Editor,
  EditorRange,
  EditorPosition,
  normalizePath,
  TFile,
  moment,
} from "obsidian";
import { createDailyNote, getAllDailyNotes, getDailyNote } from "./daily-notes";
import { DayOfWeek } from "./settings";
import { ZH_ORDINALS } from "./locale";

const daysOfWeek: Exclude<DayOfWeek, "locale-default">[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

declare module "obsidian" {
  interface Editor {
    cm: {
      state: {
        wordAt(pos: number): { from: number; to: number } | null;
      };
    };
  }
}

export default function getWordBoundaries(editor: Editor): EditorRange {
  const cursor = editor.getCursor();
  const pos = editor.posToOffset(cursor);
  const word = editor.cm.state.wordAt(pos);
  if (!word) {
    return {
      from: editor.offsetToPos(pos),
      to: editor.offsetToPos(pos),
    };
  }
  const wordStart = editor.offsetToPos(word.from);
  const wordEnd = editor.offsetToPos(word.to);
  return {
    from: wordStart,
    to: wordEnd,
  };
}

export function getSelectedText(editor: Editor): string {
  if (editor.somethingSelected()) {
    return editor.getSelection();
  } else {
    const wordBoundaries = getWordBoundaries(editor);
    editor.setSelection(wordBoundaries.from, wordBoundaries.to);
    return editor.getSelection();
  }
}

export function adjustCursor(
  editor: Editor,
  cursor: EditorPosition,
  newStr: string,
  oldStr: string
): void {
  const cursorOffset = newStr.length - oldStr.length;
  editor.setCursor({
    line: cursor.line,
    ch: cursor.ch + cursorOffset,
  });
}

export function getFormattedDate(date: Date, format: string): string {
  return window.moment(date).format(format);
}

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function parseTruthy(flag: string): boolean {
  return ["y", "yes", "1", "t", "true"].indexOf(flag.toLowerCase()) >= 0;
}

export function getLocaleWeekStart(): Exclude<DayOfWeek, "locale-default"> {
  const localeData = window.moment.localeData() as unknown as {
    _week: { dow: number };
  };
  const startOfWeek: number = localeData._week.dow;
  return daysOfWeek[startOfWeek];
}

export function generateMarkdownLink(
  app: App,
  subpath: string,
  alias?: string
): string {
  const useMarkdownLinks = (
    app.vault as unknown as { getConfig(key: string): boolean }
  ).getConfig("useMarkdownLinks");
  const path = normalizePath(subpath);

  if (useMarkdownLinks) {
    if (alias) {
      return `[${alias}](${path.replace(/ /g, "%20")})`;
    } else {
      return `[${subpath}](${path})`;
    }
  } else {
    if (alias) {
      return `[[${path}|${alias}]]`;
    } else {
      return `[[${path}]]`;
    }
  }
}

export function getDateLinkAlias(
  plugin: {
    settings: { defaultAlias: string };
    parseDate: (s: string) => { moment: moment.Moment };
  },
  dateInput: string,
  useSuggestionLabel: boolean
): string | undefined {
  if (useSuggestionLabel) {
    return dateInput;
  }
  if (plugin.settings.defaultAlias) {
    const parsed = plugin.parseDate(dateInput);
    return parsed.moment.isValid()
      ? parsed.moment.format(plugin.settings.defaultAlias)
      : undefined;
  }
  return undefined;
}

export async function getOrCreateDailyNote(
  date: moment.Moment
): Promise<TFile | null> {
  const desiredNote = getDailyNote(date, getAllDailyNotes());
  if (desiredNote) {
    return Promise.resolve(desiredNote);
  }
  return createDailyNote(date);
}

// ---- 中文序数词解析 ----
export function parseZhOrdinal(text: string): number | null {
  const match = text.match(/第([一二三四五六七八九十廿卅]+)/);
  if (match && ZH_ORDINALS[match[1]] !== undefined) {
    return ZH_ORDINALS[match[1]];
  }
  return null;
}
