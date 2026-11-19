import {type CSSObject, css} from '@emotion/react';
import styled from '@emotion/styled';

import type {FormSize, Theme} from '@sentry/scraps/theme';

export const CheckWrap = styled('div')<{
  isMultiple: boolean;
  isSelected: boolean;
  size: FormSize;
}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 1em;
  height: 1.4em;

  ${p =>
    p.isMultiple
      ? css`
          padding: 1px;
          border: solid 1px ${p.theme.tokens.border.primary};
          background: ${p.theme.tokens.background.primary};
          border-radius: 2px;
          height: 1em;
          margin-top: 2px;
          ${
            p.isSelected &&
            css`
              background: ${p.theme.tokens.background.accent.vibrant};
              border-color: ${p.theme.tokens.border.accent};
            `
          }
        `
      : css`
          ${
            p.isSelected &&
            css`
              color: ${p.theme.tokens.content.accent};
            `
          }
        `}
`;

export function getSelectStyles(
  theme: Theme,
  size: FormSize,
  {
    disabled,
    focused,
    multiple,
    searchable,
  }: {
    focused: boolean;
    multiple: boolean;
    searchable: boolean;
    disabled?: boolean;
  }
) {
  const border = theme.tokens.border.primary;
  const background = theme.tokens.interactive.chonky.debossed.neutral;
  const color = disabled ? theme.tokens.content.disabled : theme.tokens.content.primary;
  const insetShadow = `0 1px 0 0 ${background.chonk} inset`;
  const form = theme.form[size];
  return {
    container: {position: 'relative'},
    control: {
      display: 'flex',
      alignItems: 'center',
      color,
      background: disabled ? theme.tokens.background.primary : background.background,
      border: `1px solid ${border}`,
      borderRadius: form.borderRadius,
      boxShadow: insetShadow,
      ...(focused && theme.focusRing(insetShadow)),
      minHeight: form.minHeight,
      fontSize: form.fontSize,
      lineHeight: form.lineHeight,
      cursor: disabled ? 'not-allowed' : searchable ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : undefined,
    },
    values: {
      display: multiple ? 'flex' : 'grid',
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      flexWrap: multiple ? 'wrap' : undefined,
      maxHeight: multiple ? '12em' : undefined,
      overflowY: multiple ? 'auto' : undefined,
      paddingLeft: form.paddingLeft,
      gap: multiple ? theme.space.xs : undefined,
    },
    input: {
      gridArea: multiple ? undefined : '1 / 1',
      flex: multiple ? '1 1 1em' : undefined,
      minWidth: 0,
      width: multiple ? '1em' : '100%',
      border: 0,
      padding: 0,
      margin: 0,
      background: 'transparent',
      color,
      font: 'inherit',
      outline: 'none',
      cursor: 'inherit',
    },
    singleValue: {
      gridArea: '1 / 1',
      display: 'flex',
      alignItems: 'center',
      gap: theme.space.md,
      minWidth: 0,
      color,
    },
    valueLabel: {whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'},
    placeholder: {
      gridArea: multiple ? undefined : '1 / 1',
      color: disabled ? color : theme.tokens.content.secondary,
    },
    indicators: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.space.xs,
      marginInline: theme.space.sm,
    },
    chip: {
      display: 'flex',
      alignItems: 'center',
      borderRadius: 4,
      border: `1px solid ${border}`,
      background: theme.tokens.background.primary,
      boxShadow: `0 1px 0 0 ${border}`,
      marginBlock: 2,
    },
    chipLabel: {display: 'flex', alignItems: 'center', paddingInline: theme.space.xs},
    chipRemove: {
      display: 'flex',
      padding: 2,
      border: 0,
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      ':hover': {
        background: theme.tokens.interactive.transparent.neutral.background.hover,
      },
    },
    menu: {
      background: theme.tokens.background.primary,
      borderRadius: theme.radius.md,
      border: `1px solid ${border}`,
      minWidth: '100%',
      width: 'max-content',
      maxHeight: 'inherit',
      display: 'flex',
      flexDirection: 'column',
    },
    menuList: {listStyle: 'none', margin: 0, padding: '4px 0', overflowY: 'auto'},
    heading: {
      fontWeight: 600,
      lineHeight: 1.5,
      color: theme.tokens.content.secondary,
      padding: `${theme.space.xs} ${theme.space.lg}`,
      ':empty': {display: 'none'},
    },
    message: {padding: theme.space.md, color: theme.tokens.content.disabled},
  } satisfies Record<string, CSSObject>;
}
