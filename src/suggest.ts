/**
 * Adds checkbox variant suggestions.
 */

import BlockierPlugin from "main";
import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestTriggerInfo,
	MarkdownRenderer,
} from "obsidian";
import { EDITING_CHECKBOX } from "regex";


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
		const line = editor.getLine(cursor.line);
		const match = line.slice(0, cursor.ch).match(EDITING_CHECKBOX);
		if (match) {
			const query = match[1];
			return {
				start: offsetCh(cursor, -query.length),
				end: cursor,
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
		// move to `- [x] |`
		const newCursor = offsetCh(cursor, this.context.query ? 2 : 3);

		this.context.editor.setCursor(newCursor);

		// remove extra `]` to the right if there is any.
		// if selected an option while cursor is in `- [|]`: there is an extra ].
		const nextChar = this.context.editor.getRange(
			newCursor,
			offsetCh(newCursor, 1)
		);
		if (nextChar === "]") {
			this.context.editor.replaceRange(
				"",
				newCursor,
				offsetCh(newCursor, 1)
			);
		}
	}
}

/**
 * Offsets an `EditorPosition` by `chs` number of characters.
 */
function offsetCh(position: EditorPosition, chs: number): EditorPosition {
	return {
		...position,
		ch: position.ch + chs,
	};
}
