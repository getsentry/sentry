import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {debossedBackground} from 'sentry/components/core/chonk';
import type {StylesConfig as ReactSelectStylesConfig} from 'sentry/components/forms/controls/reactSelectWrapper';
import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FormSize, Theme} from 'sentry/utils/theme';

// We don't care about any options for the styles config
export type StylesConfig = ReactSelectStylesConfig<any, boolean>;

export const selectSpacing = {
  md: '8px',
  sm: '6px',
  xs: '4px',
} as const satisfies Record<FormSize, string>;

const multiValueSizeMapping = {
  md: {
    height: '20px',
    spacing: '4px',
  },
  sm: {
    height: '18px',
    spacing: '2px',
  },
  xs: {
    height: '16px',
    spacing: '2px',
  },
} satisfies Record<FormSize, {height: string; spacing: string}>;

export const getChonkStylesConfig = ({
  theme,
  size = 'md',
  maxMenuWidth,
  isInsideModal,
  isSearchable,
  isDisabled,
}: {
  isDisabled: boolean | undefined;
  isInsideModal: boolean | undefined;
  isSearchable: boolean | undefined;
  maxMenuWidth: string | number | undefined;
  size: FormSize | undefined;
  theme: Theme;
}) => {
  // TODO(epurkhiser): The loading indicator should probably also be our loading
  // indicator.

  // Unfortunately we cannot use emotions `css` helper here, since react-select
  // *requires* object styles, which the css helper cannot produce.
  const indicatorStyles: StylesConfig['clearIndicator'] &
    StylesConfig['loadingIndicator'] = (provided, state: any) => ({
    ...provided,
    padding: '0 4px 0 4px',
    alignItems: 'center',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    color: state.isDisabled ? theme.disabled : theme.tokens.content.primary,
    ':hover': {
      color: 'currentcolor',
    },
  });
  const boxShadow = `0px 1px 0px 0px ${theme.tokens.border.primary} inset`;

  return {
    control: (_, state) => ({
      display: 'flex',
      color: state.isDisabled ? theme.disabled : theme.tokens.content.primary,
      ...debossedBackground(theme),
      border: `1px solid ${theme.border}`,
      boxShadow,
      borderRadius: theme.form[size].borderRadius,
      transition: `border ${theme.motion.smooth.fast}, box-shadow ${theme.motion.smooth.fast}`,
      alignItems: 'center',
      ...(state.isFocused && theme.focusRing(boxShadow)),
      ...(state.isDisabled && {
        background: theme.tokens.background.primary,
        color: theme.disabled,
        cursor: 'not-allowed',
        opacity: '60%',
      }),
      minHeight: theme.form[size].minHeight,
      fontSize: theme.form[size].fontSize,
      lineHeight: theme.form[size].lineHeight,
      ...(state.isMulti && {
        maxHeight: '12em', // 10 lines (1.2em * 10) + padding
        overflow: 'hidden',
      }),
    }),

    menu: provided => ({
      ...provided,
      zIndex: theme.zIndex.dropdown,
      background: theme.tokens.background.primary,
      borderRadius: theme.radius.md,
      border: `1px solid ${theme.border}`,
      boxShadow: 'none',
      width: 'auto',
      minWidth: '100%',
      maxWidth: maxMenuWidth ?? 'auto',
    }),
    noOptionsMessage: provided => ({
      ...provided,
      color: theme.disabled,
    }),
    menuPortal: provided => ({
      ...provided,
      maxWidth: maxMenuWidth ?? '24rem',
      zIndex: isInsideModal ? theme.zIndex.modal + 1 : theme.zIndex.dropdown,
    }),

    option: provided => ({
      ...provided,
      color: theme.tokens.content.primary,
      background: 'transparent',
      padding: 0,
      ':active': {
        background: 'transparent',
      },
    }),
    container: (provided, state) => ({
      ...provided,
      ...(state.isDisabled && {
        pointerEvents: 'unset',
      }),
    }),
    valueContainer: (provided, state) => ({
      ...provided,
      cursor: isDisabled ? 'not-allowed' : isSearchable ? 'default' : 'pointer',
      alignItems: 'center',
      // flex alignItems makes sure we don't need paddings
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: theme.form[size].paddingLeft,
      paddingRight: selectSpacing[size],
      ...(state.isMulti && {
        maxHeight: 'inherit',
        overflowY: 'auto',
        scrollbarColor: `${theme.colors.blue200} ${theme.tokens.background.primary}`,
      }),
    }),
    input: provided => ({
      ...provided,
      color: theme.tokens.content.primary,
      margin: 0,
    }),
    singleValue: (provided, state) => ({
      ...provided,
      color: state.isDisabled ? theme.disabled : theme.tokens.content.primary,
      display: 'flex',
      alignItems: 'center',
      marginLeft: 0,
      marginRight: 0,
      width: `calc(100% - ${theme.form[size].paddingLeft}px - ${space(0.5)})`,
    }),
    placeholder: (provided, state) => ({
      ...provided,
      color: state.isDisabled ? theme.disabled : theme.subText,
    }),
    multiValue: provided => ({
      ...provided,
      backgroundColor: theme.tokens.background.primary,
      color: isDisabled ? theme.disabled : theme.tokens.content.primary,
      borderRadius: '4px',
      border: `1px solid ${theme.border}`,
      boxShadow: `0px 1px 0px 0px ${theme.tokens.border.primary}`,
      display: 'flex',
      margin: 0,
      marginTop: multiValueSizeMapping[size].spacing,
      marginBottom: multiValueSizeMapping[size].spacing,
      marginRight: multiValueSizeMapping[size].spacing,
    }),
    multiValueLabel: provided => ({
      ...provided,
      color: isDisabled ? theme.disabled : theme.tokens.content.primary,
      padding: multiValueSizeMapping[size].spacing,
      paddingLeft: multiValueSizeMapping[size].spacing,
      height: multiValueSizeMapping[size].height,
      display: 'flex',
      alignItems: 'center',
    }),
    multiValueRemove: () => ({
      alignItems: 'center',
      display: 'flex',
      margin: '4px 4px',

      ...(isDisabled
        ? {
            pointerEvents: 'none',
          }
        : {
            '&:hover': {
              cursor: 'pointer',
              background: theme.hover,
            },
          }),
    }),
    indicatorsContainer: () => ({
      display: 'grid',
      gridAutoFlow: 'column',
      marginRight: selectSpacing[size],
    }),
    clearIndicator: indicatorStyles,
    dropdownIndicator: indicatorStyles,
    loadingIndicator: indicatorStyles,
    groupHeading: provided => ({
      ...provided,
      lineHeight: '1.5',
      fontWeight: 600,
      color: theme.subText,
      marginBottom: 0,
      padding: `${space(0.5)} ${space(1.5)}`,
      ':empty': {
        display: 'none',
      },
    }),
    group: provided => ({
      ...provided,
      paddingTop: 0,
      ':last-of-type': {
        paddingBottom: 0,
      },
      ':not(:last-of-type)': {
        position: 'relative',
        marginBottom: space(1),
      },
      // Add divider between sections
      ':not(:last-of-type)::after': {
        content: '""',
        position: 'absolute',
        left: space(1.5),
        right: space(1.5),
        bottom: 0,
        borderBottom: `solid 1px ${theme.tokens.border.secondary}`,
      },
    }),
  } satisfies StylesConfig;
};

export function ChonkClearIndicator(
  props: React.ComponentProps<typeof selectComponents.ClearIndicator>
) {
  // XXX(epurkhiser): In react-selct 5 accessibility is greatly improved, for
  // now we manually add aria labels to these interactive elements to help with
  // testing
  return (
    <selectComponents.ClearIndicator {...props}>
      <Button
        borderless
        icon={<IconClose legacySize="10px" />}
        size="zero"
        aria-label={t('Clear choices')}
        onClick={props.clearValue}
      />
    </selectComponents.ClearIndicator>
  );
}

export function ChonkDropdownIndicator(
  props: React.ComponentProps<typeof selectComponents.DropdownIndicator>
) {
  return (
    <selectComponents.DropdownIndicator {...props}>
      <IconChevron direction="down" size="xs" />
    </selectComponents.DropdownIndicator>
  );
}

export const ChonkCheckWrap = styled('div')<{
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
          border: solid 1px ${p.theme.border};
          background: ${p.theme.tokens.background.primary};
          border-radius: 2px;
          height: 1em;
          margin-top: 2px;
          ${p.isSelected &&
          css`
            background: ${p.theme.colors.blue400};
            border-color: ${p.theme.colors.blue400};
          `}
        `
      : css`
          ${p.isSelected &&
          css`
            color: ${p.theme.tokens.content.accent};
          `}
        `}
`;
