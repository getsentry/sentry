import styled from '@emotion/styled';

import type {TagProps} from 'sentry/components/core/badge/tag';
import {space} from 'sentry/styles/space';
import type {Theme} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';

type TagType = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'promotion';

interface ChonkTagProps extends Omit<TagProps, 'type'> {
  type?: TagType;
}

const legacyMapping: Partial<Record<NonNullable<TagProps['type']>, TagType>> = {
  highlight: 'info',
  error: 'danger',
};

export function chonkTagPropMapping(props: TagProps): ChonkTagProps {
  return {
    ...props,
    type: (props.type && legacyMapping[props.type]) ?? (props.type as TagType),
  };
}

export const TagPill = styled('div')<{
  type?: TagType;
}>`
  ${p => ({...makeTagPillTheme(p.type, p.theme)})};

  height: 20px;
  font-size: ${p => p.theme.font.size.sm};
  display: inline-flex;
  align-items: center;
  border-radius: ${p => p.theme.radius.xs};
  padding: 0 ${space(1)};

  /* @TODO(jonasbadalic): We need to override button colors because they wrongly default to a blue color... */
  button,
  button:hover {
    color: currentColor;
  }
`;

function makeTagPillTheme(type: TagType | undefined, theme: Theme): React.CSSProperties {
  switch (type) {
    case undefined:
    case 'default':
      return {
        color: theme.tokens.content.muted,
        background: theme.colors.gray100,
      };

    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'info':
      return {
        color: theme.tokens.content.accent,
        background: theme.colors.blue100,
      };
    case 'promotion':
      return {
        color: theme.tokens.content.promotion,
        background: theme.colors.pink100,
      };
    case 'danger':
      return {
        color: theme.tokens.content.danger,
        background: theme.colors.red100,
      };
    case 'warning':
      return {
        color: theme.tokens.content.warning,
        background: theme.colors.yellow100,
      };
    case 'success':
      return {
        color: theme.tokens.content.success,
        background: theme.colors.green100,
      };
    default:
      unreachable(type);
      throw new TypeError(`Unsupported badge type: ${type}`);
  }
}
