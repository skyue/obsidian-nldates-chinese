import { App, PluginSettingTab, Setting } from "obsidian";
import type NaturalLanguageDates from "./main";
import { getLocaleWeekStart } from "./utils";

export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "locale-default";

export interface NLDSettings {
  autosuggestToggleLink: boolean;
  autocompleteTriggerPhrase: string;
  isAutosuggestEnabled: boolean;

  format: string;
  defaultAlias: string;
  weekStart: DayOfWeek;

  modalToggleLink: boolean;
  modalMomentFormat: string;
}

export const DEFAULT_SETTINGS: NLDSettings = {
  autosuggestToggleLink: true,
  autocompleteTriggerPhrase: "@",
  isAutosuggestEnabled: true,

  format: "YYYY-MM-DD",
  defaultAlias: "",
  weekStart: "locale-default",

  modalToggleLink: false,
  modalMomentFormat: "YYYY-MM-DD",
};

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export class NLDSettingsTab extends PluginSettingTab {
  plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const localizedWeekdays = window.moment.weekdays();
    const localeWeekStart = getLocaleWeekStart();

    containerEl.empty();

    new Setting(containerEl).setName("格式").setHeading();

    new Setting(containerEl)
      .setName("日期格式")
      .setDesc("日期的显示格式，使用 Moment.js 格式字符串")
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("YYYY-MM-DD")
          .setValue(this.plugin.settings.format)
          .onChange(async (value) => {
            this.plugin.settings.format = value || "YYYY-MM-DD";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("一周从周几开始")
      .setDesc("选择一周的起始日")
      .addDropdown((dropdown) => {
        dropdown.addOption(
          "locale-default",
          `系统默认（${String(localeWeekStart)}）`
        );
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.settings.weekStart.toLowerCase());
        dropdown.onChange(async (value: DayOfWeek) => {
          this.plugin.settings.weekStart = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName("自动建议").setHeading();

    new Setting(containerEl)
      .setName("启用日期自动建议")
      .setDesc(
        `开启后，输入 ${this.plugin.settings.autocompleteTriggerPhrase} 会触发日期建议菜单`
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isAutosuggestEnabled)
          .onChange(async (value) => {
            this.plugin.settings.isAutosuggestEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("触发字符")
      .setDesc("输入此字符触发自动建议")
      .addText((text) =>
        text
          .setPlaceholder("@")
          .setValue(this.plugin.settings.autocompleteTriggerPhrase || "@")
          .onChange(async (value) => {
            this.plugin.settings.autocompleteTriggerPhrase = value.trim() || "@";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("日期包裹为链接")
      .setDesc("开启后，自动建议的日期会包裹在 [[wikilink]] 中")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autosuggestToggleLink)
          .onChange(async (value) => {
            this.plugin.settings.autosuggestToggleLink = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("链接默认别名格式")
      .setDesc("创建 wiki 链接时的默认别名格式（Moment.js 格式），留空则无别名")
      .addText((text) =>
        text
          .setPlaceholder("例如：MM月DD日")
          .setValue(this.plugin.settings.defaultAlias)
          .onChange(async (value) => {
            this.plugin.settings.defaultAlias = value || "";
            await this.plugin.saveSettings();
          })
      );

  }
}
