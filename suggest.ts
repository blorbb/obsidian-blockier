import BlockierPlugin from "main";
import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestTriggerInfo,
	MarkdownRenderer,
} from "obsidian";

const CHECKBOX_REGEX = /^\s*- \[(.?)/;

export class CheckboxSuggest extends EditorSuggest<string> {
	private app: App;
	private plugin: BlockierPlugin;

	constructor(app: App, plugin: BlockierPlugin) {
		super(app);
		this.app = app;
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.showCheckboxSuggestions) return null;

		const line = editor.getLine(cursor.line);
		const match = line.match(CHECKBOX_REGEX);
		if (match) {
			const query = match[1];
			return {
				start: cursor,
				end: {
					...cursor,
					ch: cursor.ch + query.length,
				},
				query,
			};
		}
		return null;
	}

	getSuggestions(): string[] | Promise<string[]> {
		if (!this.context) return [];
		// get symbols
		const symbols = this.plugin.settings.checkboxVariants.split("");

		// no or invalid query: return symbol list
		if (this.context.query === "") return symbols;
		if (!symbols.contains(this.context.query)) return symbols;

		// return a new suggestion list with the current query at the top
		const newSuggestions = [this.context.query];
		newSuggestions.push(
			...symbols.filter((v) => v !== this.context!.query)
		);

		return newSuggestions;
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		const div = el.createDiv();
		div.classList.add(
			"blockier-checkbox-suggestion",
			"markdown-rendered",
			"markdown-preview-view"
		);

		MarkdownRenderer.render(
			this.app,
			`- [${value}] \`${value}\``,
			div,
			"",
			this.plugin
		);
	}

	selectSuggestion(value: string): void {
		if (!this.context) return;

		// cursor is at `- [|] `
		const cursor = this.context.editor.getCursor();

		// insert `x] ` and remove query if there is one.
		this.context.editor.replaceRange(
			value + "] ",
			this.context.start,
			this.context.end
		);

		// if there was a query, cursor is at `- [x|] `
		// otherwise its at `- [|x] `
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch + (this.context.query ? 2 : 3), // move to `- [x] |`
		};

		this.context.editor.setCursor(newCursor);

		// remove extra `]` or ` ` to the right if there is any.
		const next2CharCursor = { ...newCursor, ch: newCursor.ch + 2 };
		const nextCharCursor = { ...newCursor, ch: newCursor.ch + 1 };

		if (this.context.editor.getRange(newCursor, next2CharCursor) === "] ") {
			this.context.editor.replaceRange("", newCursor, next2CharCursor);
		} else if (
			this.context.editor.getRange(newCursor, nextCharCursor) === " "
		) {
			this.context.editor.replaceRange("", newCursor, nextCharCursor);
		}
	}
}
