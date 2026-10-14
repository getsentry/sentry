export const TITLE_HEIGHT = '22px';
export const STAT_VALUE_HEIGHT = '19px';
export const METADATA_TEXT_HEIGHT = '20px';
/**
 * Ceiling for a metadata value, so one long value — a branch name, a release
 * — cannot crowd the rest of the row out. Values are truncated, not wrapped:
 * the row is one line of facts, and the full text stays in the DOM for
 * assistive technology.
 */
export const METADATA_VALUE_MAX_WIDTH = '280px';

export const ROW_HEIGHT = '32px';
