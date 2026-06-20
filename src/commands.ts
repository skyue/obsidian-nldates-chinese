import { MarkdownView } from "obsidian";
import { adjustCursor, getSelectedText, getDateLinkAlias } from "./utils";
import type NaturalLanguageDates from "./main";

export function getParseCommand(
  plugin: NaturalLanguageDates,
  mode: string
): void {
  const { workspace } = plugin.app;
  const activeView = workspace.getActiveViewOfType(MarkdownView);

  if (!activeView) {
    return;
  }

  const editor = activeView.editor;
  const cursor = editor.getCursor();
  const selectedText = getSelectedText(editor);

  const date = plugin.parseDate(selectedText);

  if (!date.moment.isValid()) {
    editor.setCursor({
      line: cursor.line,
      ch: cursor.ch,
    });
    return;
  }

  let newStr: string;

  if (mode === "replace") {
    const alias = getDateLinkAlias(plugin, selectedText, false);
    newStr = alias
      ? `[[${date.formattedString}|${alias}]]`
      : `[[${date.formattedString}]]`;
  } else if (mode === "link") {
    newStr = `[${selectedText}](${date.formattedString})`;
  } else if (mode === "clean") {
    newStr = date.formattedString;
  }

  editor.replaceSelection(newStr!);
  adjustCursor(editor, cursor, newStr!, selectedText);
  editor.focus();
}