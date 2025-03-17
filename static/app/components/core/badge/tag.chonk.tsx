import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {TagProps} from 'sentry/components/core/badge/tag';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {unreachable} from 'sentry/utils/unreachable';

type TagType = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'promotion';

interface ChonkTagProps extends Omit<TagProps, 'type'> {
  type?: TagType;
}

const legacyMapping: Partial<Record<NonNullable<TagProps['type']>, TagType>> = {
  highlight: 'info',
  error: 'danger',
  white: 'default',
  black: 'default',
};

export function chonkTagPropMapping(props: TagProps): ChonkTagProps {
  return {
    ...props,
    type: props.type && legacyMapping[props.type],
  };
}

export const TagPill = chonkStyled('div')<{
  type?: TagType;
}>`
  ${p => ({...makeTagPillTheme(p.type, p.theme)})};

  font-size: ${p => p.theme.fontSizeSmall};
  display: inline-flex;
  align-items: center;
  height: 20px;
  border-radius: 20px;
  padding: 0 ${space(1)};
  max-width: 166px;

  /* @TODO(jonasbadalic): We need to override button colors because they wrongly default to a blue color... */
  button,
  button:hover {
    color: currentColor;
  }
`;

function makeTagPillTheme(
  type: TagType | undefined,
  theme: DO_NOT_USE_ChonkTheme
): React.CSSProperties {
  switch (type) {
    case undefined:
    case 'default':
      return {
        color: theme.colors.gray500,
        background: theme.colors.gray100,
      };

    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'info':
      return {
        color: theme.colors.blue500,
        background: theme.colors.blue100,
      };
    case 'promotion':
      return {
        color: theme.colors.pink500,
        background: theme.colors.pink100,
      };
    case 'danger':
      return {
        color: theme.colors.red500,
        background: theme.colors.red100,
      };
    case 'warning':
      return {
        color: theme.colors.yellow500,
        background: theme.colors.yellow100,
      };
    case 'success':
      return {
        color: theme.colors.green500,
        background: theme.colors.green100,
      };
    default:
      unreachable(type);
      throw new TypeError(`Unsupported badge type: ${type}`);
  }
}
