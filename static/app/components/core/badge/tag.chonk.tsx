import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {TagProps} from 'sentry/components/core/badge/tag';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {unreachable} from 'sentry/utils/unreachable';

type TagType = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'promotion';

interface ChonkTagProps extends Omit<TagProps, 'type'> {
  type?: TagType;
}

const LegacyMapping: Partial<Record<NonNullable<TagProps['type']>, TagType>> = {
  highlight: 'info',
  error: 'danger',
  white: 'default',
  black: 'default',
};

export function chonkTagPropMapping(props: TagProps): ChonkTagProps {
  return {
    ...props,
    type: props.type && LegacyMapping[props.type],
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
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.grayTransparent400,
      };

    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'info':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.blue400,
      };
    case 'success':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.green400,
      };
    case 'warning':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.yellow400,
      };
    case 'danger':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.red400,
      };
    case 'promotion':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.pink400,
      };
    default:
      unreachable(type);
      throw new TypeError(`Unsupported badge type: ${type}`);
  }
}
