import { Notice, SuggestModal, App } from "obsidian";
import { getOrCreateDailyNote } from "../utils";
import type NaturalLanguageDates from "../main";
import DateSuggest from "../suggest/date-suggest";

export class OpenDailyNoteModal extends SuggestModal<string> {
  plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.plugin = plugin;
    this.setPlaceholder("输入中文日期，如：今天、下周三、3天后");
  }

  getSuggestions(query: string): string[] {
    const tempSuggest = new DateSuggest(this.app, this.plugin);
    const suggestions = tempSuggest.getDateSuggestions(
      { query },
      ["今天", "昨天", "明天"]
    );
    return suggestions.map((s) => s.label).length
      ? suggestions.map((s) => s.label)
      : [query];
  }

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    el.createEl("div", { text: suggestion });
  }

  onChooseSuggestion(suggestion: string): void {
    const parsedDate = this.plugin.parseDate(suggestion);
    const date = parsedDate.moment;
    if (!parsedDate.date || !date.isValid()) {
      new Notice("无法解析该日期");
      return;
    }

    void getOrCreateDailyNote(date).then((note) => {
      if (note) {
        void this.app.workspace.getLeaf().openFile(note);
      }
    });
  }
}
