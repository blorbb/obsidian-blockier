/**
 * Replaces a block's type with a new one by entering the new prefix at the
 * start of the line.
 */

import { Editor, EditorPosition } from "obsidian";
import { IS_OVERRIDING } from "regex";

/**
 * Tries to apply a block type override.
 *
 * Example: Changing a numbered list `1.` to a bullet `-` using `1. - `.
 */
export function tryReplace(editor: Editor): void {
	// the line will be in the state it was *before* the last character was added.
	const lineNum = editor.getCursor().line;
	const ch = editor.getCursor().ch;
	const line = editor.getLine(lineNum);

	// see if the line is trying to override the block prefix
	const match = line.match(IS_OVERRIDING);
	// check that the cursor is right after the override
	if (match?.[0].length !== ch) return;

	const groups = match.groups!;
	// don't override if the new prefix is the same as the old
	if (groups.new === groups.existing) return;

	// create a selection around the <existing> block prefix
	const leftPos: EditorPosition = {
		line: lineNum,
		ch: groups.whitespace.length,
	};
	const rightPos: EditorPosition = {
		line: lineNum,
		ch: match[0].length,
	};

	// replace with new block prefix
	editor.replaceRange(groups.new, leftPos, rightPos);
}