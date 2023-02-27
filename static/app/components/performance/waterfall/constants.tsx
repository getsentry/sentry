import {Theme} from '@emotion/react';

export const ROW_HEIGHT = 24;
export const ROW_PADDING = 4;

export enum SpanBarType {
  GAP = 'gap',
  AFFECTED = 'affected',
  AUTOGROUPED = 'autogrouped',
  AUTOGROUPED_AND_AFFECTED = 'autogrouped_and_affected',
}

type SpanBarColours = {
  alternate: string;
  insetTextColour: string;
  primary: string;
};

// TODO: Need to eventually add dark mode colours as well
export function getSpanBarColours(
  spanBarType: SpanBarType | undefined,
  theme: Theme
): SpanBarColours {
  switch (spanBarType) {
    case SpanBarType.GAP:
      return {primary: '#dedae3', alternate: '#f4f2f7', insetTextColour: theme.gray300};
    case SpanBarType.AFFECTED:
      return {primary: '#f55459', alternate: '#faa9ac', insetTextColour: theme.white};
    case SpanBarType.AUTOGROUPED:
      return {
        primary: theme.blue300,
        alternate: '#d1dff9',
        insetTextColour: theme.gray300,
      };
    case SpanBarType.AUTOGROUPED_AND_AFFECTED:
      return {
        primary: '#f55459',
        alternate: '#faa9ac',
        insetTextColour: theme.white,
      };
    default:
      return {primary: '', alternate: '', insetTextColour: theme.white};
  }
}
