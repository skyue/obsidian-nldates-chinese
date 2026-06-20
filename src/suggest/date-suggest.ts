import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
} from "obsidian";
import type NaturalLanguageDates from "src/main";
import { generateMarkdownLink, getDateLinkAlias } from "src/utils";
import {
  ZH_WEEKDAYS_SHORT,
  ZH_WEEKDAYS_LONG,
} from "src/locale";

interface IDateCompletion {
  label: string;
}

export default class DateSuggest extends EditorSuggest<IDateCompletion> {
  app: App;
  private plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.app = app;
    this.plugin = plugin;

    this.scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
      (
        this as unknown as {
          suggestions: { useSelectedItem(evt: KeyboardEvent): void };
        }
      ).suggestions.useSelectedItem(evt);
      return false;
    });

    if (this.plugin.settings.autosuggestToggleLink) {
      this.setInstructions([
        { command: "Shift", purpose: "使用原始输入作为别名" },
      ]);
    }
  }

  getSuggestions(context: EditorSuggestContext): IDateCompletion[] {
    const suggestions = this.getDateSuggestions(context);
    if (suggestions.length) {
      return suggestions;
    }
    return [{ label: context.query }];
  }

  getDateSuggestions(
    context: EditorSuggestContext | { query: string },
    defaults: string[] = ["今天", "明天", "昨天", "后天"]
  ): IDateCompletion[] {
    const query = context.query.trim();

    // 上下文匹配：「下」→ 下周、下个月、下周一~周日
    if (/^下/.test(query)) {
      const suggestions = [
        "下周",
        "下个月",
        "下年",
        ...ZH_WEEKDAYS_SHORT.map((d) => `下${d}`),
        ...ZH_WEEKDAYS_LONG.map((d) => `下${d}`),
      ];
      return suggestions
        .map((label) => ({ label }))
        .filter((item) => item.label.startsWith(query));
    }

    // 「上」→ 上周、上个月、上周一~周日
    if (/^上/.test(query)) {
      const suggestions = [
        "上周",
        "上个月",
        "上年",
        ...ZH_WEEKDAYS_SHORT.map((d) => `上${d}`),
        ...ZH_WEEKDAYS_LONG.map((d) => `上${d}`),
      ];
      return suggestions
        .map((label) => ({ label }))
        .filter((item) => item.label.startsWith(query));
    }

    // 「这/本」→ 这周、这个月
    if (/^(这|本)/.test(query)) {
      const suggestions = ["这周", "这个月"];
      return suggestions
        .map((label) => ({ label }))
        .filter((item) => item.label.startsWith(query));
    }

    // 数字开头：N天后、N天前、N周后...
    const numMatch = query.match(/^(\d+)/);
    if (numMatch) {
      const n = numMatch[1];
      return [
        `${n}天后`,
        `${n}天前`,
        `${n}周后`,
        `${n}周前`,
        `${n}个月后`,
        `${n}个月前`,
      ]
        .map((label) => ({ label }))
        .filter((item) => item.label.startsWith(query));
    }

    // 中文数字开头：三天后、五天后...
    const zhNumMap: Record<string, string> = {
      "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
      "六": "6", "七": "7", "八": "8", "九": "9", "十": "10",
    };
    const zhNumMatch = query.match(/^([一二三四五六七八九十])/);
    if (zhNumMatch) {
      const n = zhNumMap[zhNumMatch[1]];
      if (n) {
        return [
          `${zhNumMatch[1]}天后`,
          `${zhNumMatch[1]}天前`,
          `${zhNumMatch[1]}周后`,
          `${zhNumMatch[1]}周前`,
          `${zhNumMatch[1]}个月后`,
          `${zhNumMatch[1]}个月前`,
        ]
          .map((label) => ({ label }))
          .filter((item) => item.label.startsWith(query));
      }
    }

    return defaults
      .map((label) => ({ label }))
      .filter((item) => item.label.startsWith(query));
  }

  renderSuggestion(suggestion: IDateCompletion, el: HTMLElement): void {
    el.setText(suggestion.label);
  }

  selectSuggestion(
    suggestion: IDateCompletion,
    event: KeyboardEvent | MouseEvent
  ): void {
    const context = this.context;
    if (!context) return;

    const { editor } = context;

    const includeAlias = event.shiftKey;
    let makeIntoLink = this.plugin.settings.autosuggestToggleLink;

    const parsedDate = this.plugin.parseDate(suggestion.label);
    let dateStr = parsedDate.formattedString;

    if (makeIntoLink) {
      const alias = includeAlias
        ? context.query || suggestion.label
        : getDateLinkAlias(this.plugin, suggestion.label, false) || suggestion.label;
      dateStr = generateMarkdownLink(this.app, dateStr, alias);
    }

    editor.replaceRange(dateStr, context.start, context.end);
    this.close();
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor
  ): EditorSuggestTriggerInfo | null {
    if (!this.plugin.settings.isAutosuggestEnabled) {
      return null;
    }

    const triggerPhrase = this.plugin.settings.autocompleteTriggerPhrase;
    const startPos = this.context?.start || {
      line: cursor.line,
      ch: cursor.ch - triggerPhrase.length,
    };

    if (!editor.getRange(startPos, cursor).startsWith(triggerPhrase)) {
      return null;
    }

    const precedingChar = editor.getRange(
      {
        line: startPos.line,
        ch: startPos.ch - 1,
      },
      startPos
    );

    // 避免在邮箱地址等场景误触发
    if (precedingChar && /[`a-zA-Z0-9]/.test(precedingChar)) {
      return null;
    }

    const query = editor
      .getRange(startPos, cursor)
      .substring(triggerPhrase.length);

    // 触发字符后紧跟空格则取消
    if (query === " ") {
      return null;
    }

    return {
      start: startPos,
      end: cursor,
      query,
    };
  }
}
