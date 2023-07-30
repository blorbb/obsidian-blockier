import {
	Editor,
	EditorPosition,
	EditorSelection,
	MarkdownView,
	Plugin,
} from "obsidian";

const BLOCK_PREFIX = /- \[.]|-|\*|\+|>|#{1,6}|[0-9]+\./;
const LINE_START_BLOCK_PREFIX = new RegExp(`^\\s*${BLOCK_PREFIX.source} `);
// exclude headings and quotes (only bullets, numbers, or checkboxes)
const OVERRIDABLE_BLOCK_PREFIX = /- \[.]|-|\*|\+|[0-9]+\./;
const OVERRIDING_BLOCK = /-|\*|\+|[0-9]+\./;
const LINE_START_OVERRIDABLE_BLOCK = new RegExp(
	`^(?<whitespace>\\s*)(?<existing>${OVERRIDABLE_BLOCK_PREFIX.source}) `
);
const IS_OVERRIDING = new RegExp(
	`${LINE_START_OVERRIDABLE_BLOCK.source}(?<new>${OVERRIDING_BLOCK.source})`
);

export default class BlockierPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: "select-block",
			name: "Select block",
			hotkeys: [{ modifiers: ["Meta"], key: "a" }],
			editorCallback(editor: Editor) {
				const selections = editor.listSelections();

				const newSelections = selections.map((sel) =>
					selectLine(editor, sel)
				);

				editor.setSelections(newSelections);
			},
		});

		this.registerDomEvent(document, "keydown", (ev) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view && ev.key === " ") {
				console.log("pressed space");
				tryReplace(view.editor);
			}
		});
	}
}

function tryReplace(editor: Editor) {
	// the line will be in the state it was *before* the last character was added.
	const lineNum = editor.getCursor().line;
	const line = editor.getLine(lineNum);
	const ch = editor.getCursor().ch;
	const canReplace = OVERRIDABLE_BLOCK_PREFIX.test(line);
	if (!canReplace) return;

	const match = line.match(IS_OVERRIDING);
	if (!match) return;
	const isCausedBySpace = (match[0].length ?? 0) === ch;
	if (!isCausedBySpace) return;

	const groups = match.groups!;
	if (groups.new === groups.existing) return;

	const leftPos: EditorPosition = {
		line: lineNum,
		ch: groups.whitespace.length,
	};
	const rightPos: EditorPosition = {
		line: lineNum,
		ch: match[0].length,
	};

	editor.replaceRange(groups.new, leftPos, rightPos);
}

/**
 * Modifies a selection to cover the whole line.
 *
 * If the selection is on one line, it will select the whole paragraph,
 * excluding block prefixes. These include:
 * - Unordered lists `-`, `+` and `*`
 * - Numbered lists `1.`, `2.`, ...
 * - Headings `#`, `##`, ...
 * - Checkboxes `- [ ]`, `- [x]`, ...
 * - Quotes `>`
 */
function selectLine(
	editor: Editor,
	selection: EditorSelection
): EditorSelection {
	// set selection start and end (not anchor and head)
	const [start, end] = orderPositions(selection.anchor, selection.head);

	if (start.line !== end.line) {
		// selection spans multiple lines: select everything in those lines,
		// including bullets and other stuff that is usually left out.

		return {
			anchor: {
				ch: 0,
				line: start.line,
			},
			head: {
				ch: editor.getLine(end.line).length,
				line: end.line,
			},
		};
	} else {
		// selection spans one line: don't select parts at the start (if one exists)
		// TODO: detect if the selection is currently in a
		// code block. If so, just select the whole line

		const lineNum = start.line;
		const line = editor.getLine(lineNum);
		const paragraphStart =
			line.match(LINE_START_BLOCK_PREFIX)?.[0].length ?? 0;
		return {
			anchor: {
				ch: paragraphStart,
				line: lineNum,
			},
			head: {
				ch: line.length,
				line: lineNum,
			},
		};
	}
}

function orderPositions(
	anchor: EditorPosition,
	head: EditorPosition
): [EditorPosition, EditorPosition] {
	if (anchor.line < head.line) {
		return [anchor, head];
	} else if (anchor.line > head.line) {
		return [head, anchor];
		// below are if selection anchor and head are on the same line
	} else if (anchor.ch < head.ch) {
		return [anchor, head];
	} else {
		return [head, anchor];
	}
}
