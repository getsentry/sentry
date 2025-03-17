import type {Theme} from '@emotion/react';

export const ROW_HEIGHT = 24;
export const ROW_PADDING = 4;

export enum SpanBarType {
  GAP = 'gap',
  AFFECTED = 'affected',
  AUTOGROUPED = 'autogrouped',
  AUTOGROUPED_AND_AFFECTED = 'autogrouped_and_affected',
}

type SpanBarColors = {
  alternate: string;
  insetTextColor: string;
  primary: string;
};

// TODO: Need to eventually add dark mode colors as well
export function getSpanBarColors(
  spanBarType: SpanBarType | undefined,
  theme: Theme
): SpanBarColors {
  switch (spanBarType) {
    case SpanBarType.GAP:
      return {primary: '#dedae3', alternate: '#f4f2f7', insetTextColor: theme.gray300};
    case SpanBarType.AFFECTED:
      return {primary: '#f55459', alternate: '#faa9ac', insetTextColor: theme.white};
    case SpanBarType.AUTOGROUPED:
      return {
        primary: theme.blue300,
        alternate: '#d1dff9',
        insetTextColor: theme.gray300,
      };
    case SpanBarType.AUTOGROUPED_AND_AFFECTED:
      return {
        primary: '#f55459',
        alternate: '#faa9ac',
        insetTextColor: theme.white,
      };
    default:
      return {primary: '', alternate: '', insetTextColor: theme.white};
  }
}
