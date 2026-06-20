import { App, MarkdownView, Modal, Setting } from "obsidian";
import { generateMarkdownLink, getDateLinkAlias } from "src/utils";
import type NaturalLanguageDates from "../main";

export default class DatePickerModal extends Modal {
  plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    let previewEl: HTMLElement;

    let dateInput = "";
    let momentFormat = this.plugin.settings.modalMomentFormat;
    let insertAsLink = this.plugin.settings.modalToggleLink;

    const getDateStr = () => {
      let cleanDateInput = dateInput;
      let shouldIncludeAlias = false;

      if (dateInput.endsWith("|")) {
        shouldIncludeAlias = true;
        cleanDateInput = dateInput.slice(0, -1);
      }

      const parsedDate = this.plugin.parseDate(cleanDateInput || "今天");
      let parsedDateString = parsedDate.moment.isValid()
        ? parsedDate.moment.format(momentFormat)
        : "";

      if (insertAsLink) {
        const alias = getDateLinkAlias(
          this.plugin,
          cleanDateInput,
          shouldIncludeAlias
        );
        parsedDateString = generateMarkdownLink(
          this.app,
          parsedDateString,
          alias
        );
      }

      return parsedDateString;
    };

    this.contentEl.createEl("form", {}, (formEl) => {
      const dateInputEl = new Setting(formEl)
        .setName("日期")
        .setDesc(getDateStr())
        .addText((textEl) => {
          textEl.setPlaceholder("今天");

          textEl.onChange((value) => {
            dateInput = value;
            previewEl.setText(getDateStr());
          });

          window.setTimeout(() => textEl.inputEl.focus(), 10);
        });
      previewEl = dateInputEl.descEl;

      new Setting(formEl)
        .setName("日期格式")
        .setDesc("Moment.js 格式字符串")
        .addMomentFormat((momentEl) => {
          momentEl.setPlaceholder("输入格式");
          momentEl.setValue(momentFormat);
          momentEl.onChange((value) => {
            momentFormat = value.trim() || "YYYY-MM-DD HH:mm";
            this.plugin.settings.modalMomentFormat = momentFormat;
            void this.plugin.saveSettings();
            previewEl.setText(getDateStr());
          });
        });

      new Setting(formEl)
        .setName("插入为链接？")
        .addToggle((toggleEl) => {
          toggleEl
            .setValue(this.plugin.settings.modalToggleLink)
            .onChange((value) => {
              insertAsLink = value;
              this.plugin.settings.modalToggleLink = insertAsLink;
              void this.plugin.saveSettings();
              previewEl.setText(getDateStr());
            });
        });

      formEl.createDiv("modal-button-container", (buttonContainerEl) => {
        buttonContainerEl
          .createEl("button", {
            attr: { type: "button" },
            text: "取消",
          })
          .addEventListener("click", () => this.close());
        buttonContainerEl.createEl("button", {
          attr: { type: "submit" },
          cls: "mod-cta",
          text: "插入日期",
        });
      });

      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        const activeEditor = activeView.editor;
        formEl.addEventListener("submit", (e: Event) => {
          e.preventDefault();
          this.close();
          activeEditor.replaceSelection(getDateStr());
        });
      }
    });
  }
}
