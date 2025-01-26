/**
 * Helper regexes
 */

// note that when adding multiple of these together, the order sometimes matters.
// most specific should come before less specific (just CHECKBOX before BULLET)
export const BLOCKS = {
	CHECKBOX: /- \[.]/.source,
	BULLET: /-|\*|\+/.source,
	NUMBER: /[0-9]+[.)]/.source,
	HEADING: /#{1,6}/.source,
	QUOTE: />/.source,
	CODEBLOCK: /```/.source,
} as const;

/**
 * Matches a block prefix without any leading/trailing spaces.
 *
 * Excludes codeblock.
 */
export const ANY_BLOCK = new RegExp(
	`(?:${BLOCKS.CHECKBOX}|${BLOCKS.BULLET}|${BLOCKS.NUMBER}|${BLOCKS.HEADING}|${BLOCKS.QUOTE})`
);

/**
 * Matches a block prefix at the start of a line. Can be indented.
 *
 * Includes ending space except for code blocks. Code blocks are only matched
 * if there is a language specifier.
 *
 * A matching group named `prefix0` or `prefix1` will be present if matched,
 * containing the string prefix that should not be selected (can't have the
 * same name as it is a syntax error - only one will be present).
 */
export const LINE_START_BLOCK = new RegExp(
	`(?<prefix0>^\\s*${ANY_BLOCK.source} )|(?:(?<prefix1>^${BLOCKS.CODEBLOCK}).+)`
);

/**
 * Matches block prefixes that can be overridden.
 */
export const OVERRIDABLE_BLOCK = new RegExp(`${BLOCKS.CHECKBOX}|${BLOCKS.BULLET}|${BLOCKS.NUMBER}`);
/**
 * Matches block prefixes that can override other blocks.
 *
 * Doesn't include checkbox because it already appends onto the bullet.
 */
export const OVERRIDING_BLOCK = new RegExp(`${BLOCKS.BULLET}|${BLOCKS.NUMBER}`);

/**
 * Matches whether the line is trying to override <existing> with <new>.
 *
 * Does not include ending space.
 */
export const IS_OVERRIDING = new RegExp(
	`^(?<whitespace>\\s*)(?<existing>${OVERRIDABLE_BLOCK.source}) (?<new>${OVERRIDING_BLOCK.source})`
);

/**
 * Whether the cursor is currently editing a checkbox.
 *
 * Matches a group if there is also an existing token.
 */
export const EDITING_CHECKBOX = /^\s*- \[(.?)$/;
