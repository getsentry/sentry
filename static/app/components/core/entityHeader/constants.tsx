import type {EntityHeaderTextStyles} from './items/entityHeaderText';

export const TITLE_HEIGHT = '22px';
export const STAT_VALUE_HEIGHT = '19px';
export const METADATA_TEXT_HEIGHT = '20px';
/**
 * Tall enough for "+N more", so a list that collapses, expands or loads
 * keeps the row's line height.
 */
export const METADATA_ROW_HEIGHT = '24px';

export const ROW_HEIGHT = '32px';

export const METADATA_TEXT_STYLES = {
  size: 'md',
  density: 'comfortable',
  wrap: 'nowrap',
} as const satisfies EntityHeaderTextStyles;
