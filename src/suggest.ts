/**
 * Adds checkbox variant suggestions.
 */

import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	MarkdownRenderer,
	Plugin,
} from "obsidian";

interface BracketSuggestOptions {
	/** The list of suggestions to show */
	suggestions: string[];
	/**
	 * Triggers the suggestion if the string from the start of the line
	 * to the current cursor matches this regex.
	 *
	 * There should be one matching group for the query.
	 */
	triggerRegex: RegExp;
	/**
	 * A class to add to each suggestion popup.
	 *
	 * The classes "markdown-rendered" and "markdown-preview-view" will already
	 * be added to the suggestion.
	 *
	 * There can only be one class: no whitespace is allowed.
	 */
	suggestionClass: string;
	/**
	 * The markdown string to be shown in the render. The callback provides
	 * what the suggestion is.
	 */
	renderMarkdown(suggestion: string): string;
}

class BracketSuggest extends EditorSuggest<string> {
	constructor(
		protected readonly app: App,
		protected readonly plugin: Plugin,
		protected readonly opts: BracketSuggestOptions
	) {
		super(app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const match = line.slice(0, cursor.ch).match(this.opts.triggerRegex);
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

	getSuggestions(
		context: EditorSuggestContext
	): string[] | Promise<string[]> {
		const suggestions = this.opts.suggestions;
		// no or invalid query: return symbol list
		if (context.query === "") return suggestions;

		// only starts with for now: fuzzy search in the future?
		const queriedSuggestionIndex = suggestions.findIndex((str) =>
			str.startsWith(context.query)
		);

		// no match
		if (queriedSuggestionIndex === -1) return suggestions;
		// match: show that suggestion first
		const newSuggestions = [suggestions[queriedSuggestionIndex]];
		newSuggestions.push(...suggestions.slice(0, queriedSuggestionIndex));
		newSuggestions.push(...suggestions.slice(queriedSuggestionIndex + 1));

		return newSuggestions;
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		const div = el.createDiv();
		div.classList.add(
			"markdown-rendered",
			"markdown-preview-view",
			this.opts.suggestionClass
		);

		MarkdownRenderer.render(
			this.app,
			this.opts.renderMarkdown(value),
			div,
			"",
			this.plugin
		);
	}

	selectSuggestion(value: string): void {
		if (!this.context) return;

		// cursor is at `- [|] `
		const context = this.context;
		const cursor = context.editor.getCursor();

		// insert `suggestion] ` and remove query if there is one.
		context.editor.replaceRange(value + "] ", context.start, context.end);

		// if there was a query, cursor is at `- [sug|] `
		// otherwise its at `- [|sug] `
		// move to `- [sug] |`
		const offsetAmount =
			getLine(context, cursor).indexOf("]") + 2 - cursor.ch;
		const newCursor = offsetCh(cursor, offsetAmount);

		context.editor.setCursor(newCursor);

		// remove extra `]` and ` ` to the right if there is any.
		// if selected an option while cursor is in `- [|]`: there is an extra ].
		const next2Char = context.editor.getRange(
			newCursor,
			offsetCh(newCursor, 2)
		);
		if (next2Char === "] ") {
			context.editor.replaceRange("", newCursor, offsetCh(newCursor, 2));
		} else if (next2Char[0] === "]") {
			context.editor.replaceRange("", newCursor, offsetCh(newCursor, 1));
		}
	}
}

export class CheckboxSuggest extends BracketSuggest {
	constructor(app: App, plugin: Plugin, characters: string) {
		super(app, plugin, {
			suggestions: characters.split(""),
			triggerRegex: /^\s*- \[(.?)$/,
			suggestionClass: "blockier-checkbox-suggestion",
			renderMarkdown: (suggestion) =>
				`- [${suggestion}] \`${suggestion}\``,
		});
	}
}

export class CalloutSuggest extends BracketSuggest {
	constructor(app: App, plugin: Plugin, csv: string) {
		super(app, plugin, {
			suggestions: csv.split(",").map((str) => str.trim()),
			triggerRegex: /^\s*> \[!(\w*)$/,
			suggestionClass: "blockier-callout-suggestion",
			renderMarkdown: (suggestion) => `> [!${suggestion}]`,
		});
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

/**
 * Gets the current line.
 */
function getLine(
	context: EditorSuggestContext,
	cursor: EditorPosition
): string {
	return context.editor.getLine(cursor.line);
}
