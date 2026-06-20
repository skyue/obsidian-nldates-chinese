import { MarkdownView, ObsidianProtocolData, Plugin } from "obsidian";

import DatePickerModal from "./modals/date-picker";
import NLDParser, { NLDResult } from "./parser";
import { NLDSettingsTab, NLDSettings, DEFAULT_SETTINGS } from "./settings";
import DateSuggest from "./suggest/date-suggest";
import {
  getParseCommand,
  getCurrentDateCommand,
} from "./commands";
import { getFormattedDate, getOrCreateDailyNote, parseTruthy } from "./utils";
import { OpenDailyNoteModal } from "./modals/open-daily-note";

export default class NaturalLanguageDates extends Plugin {
  private parser: NLDParser;
  public settings: NLDSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "nlp-dates",
      name: "解析自然语言日期",
      callback: () => getParseCommand(this, "replace"),
    });

    this.addCommand({
      id: "nlp-dates-link",
      name: "解析自然语言日期（Markdown 链接）",
      callback: () => getParseCommand(this, "link"),
    });

    this.addCommand({
      id: "nlp-date-clean",
      name: "解析自然语言日期（纯文本）",
      callback: () => getParseCommand(this, "clean"),
    });

    this.addCommand({
      id: "nlp-today",
      name: "插入当前日期",
      callback: () => getCurrentDateCommand(this),
    });

    this.addCommand({
      id: "nlp-picker",
      name: "日期选择器",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        }
        new DatePickerModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "nlp-open-daily-note",
      name: "用自然语言打开日记",
      callback: () => {
        const modal = new OpenDailyNoteModal(this.app, this);
        modal.open();
      },
    });

    this.addSettingTab(new NLDSettingsTab(this.app, this));
    this.registerObsidianProtocolHandler(
      "nldates",
      (params) => void this.actionHandler(params)
    );
    this.registerEditorSuggest(new DateSuggest(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.parser = new NLDParser();
    });
  }

  onunload(): void {
    console.debug("卸载自然语言日期插件（中文）");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<NLDSettings>
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  parse(dateString: string, format: string): NLDResult {
    const date = this.parser.getParsedDate(
      dateString,
      this.settings.weekStart
    );
    const formattedString = getFormattedDate(date, format);
    if (formattedString === "Invalid date") {
      console.debug(`nldates 无法解析输入 "${dateString}"`);
    }

    return {
      formattedString,
      date,
      moment: window.moment(date),
    };
  }

  parseDate(dateString: string): NLDResult {
    return this.parse(dateString, this.settings.format);
  }

  async actionHandler(params: ObsidianProtocolData): Promise<void> {
    const { workspace } = this.app;

    const date = this.parseDate(params.day);
    const newPane = parseTruthy(params.newPane || "yes");

    if (date.moment.isValid()) {
      const dailyNote = await getOrCreateDailyNote(date.moment);
      if (dailyNote) {
        await workspace.getLeaf(newPane).openFile(dailyNote);
      }
    }
  }
}
