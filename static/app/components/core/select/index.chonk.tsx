import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/core/button';
import type {StylesConfig as ReactSelectStylesConfig} from 'sentry/components/forms/controls/reactSelectWrapper';
import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FormSize} from 'sentry/utils/theme';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

// We don't care about any options for the styles config
export type StylesConfig = ReactSelectStylesConfig<any, boolean>;

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
  theme: DO_NOT_USE_ChonkTheme;
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
    color: state.isDisabled ? theme.disabled : theme.textColor,
    ':hover': {
      color: 'currentcolor',
    },
  });

  return {
    control: (_, state) => ({
      display: 'flex',
      color: state.isDisabled ? theme.disabled : theme.textColor,
      background: theme.background,
      border: `1px solid ${theme.border}`,
      boxShadow: 'none',
      borderRadius: theme.formRadius[size].borderRadius,
      transition: 'border 0.1s, box-shadow 0.1s',
      alignItems: 'center',
      ...(state.isFocused && theme.focusRing),
      ...(state.isDisabled && {
        background: theme.background,
        color: theme.disabled,
        cursor: 'not-allowed',
        opacity: '60%',
      }),
      ...omit(theme.form[size], 'height'),
      ...(state.isMulti && {
        maxHeight: '12em', // 10 lines (1.2em * 10) + padding
        overflow: 'hidden',
      }),
    }),

    menu: provided => ({
      ...provided,
      zIndex: theme.zIndex.dropdown,
      background: theme.backgroundElevated,
      borderRadius: theme.borderRadius,
      border: `1px solid ${theme.border}`,
      boxShadow: 'none',
      width: 'auto',
      minWidth: '100%',
      maxWidth: maxMenuWidth ?? 'auto',
      top: '100%',
      marginTop: '8px',
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
      color: theme.textColor,
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
      paddingLeft: theme.formPadding[size].paddingLeft,
      paddingRight: theme.formSpacing[size],
      ...(state.isMulti && {
        maxHeight: 'inherit',
        overflowY: 'auto',
        scrollbarColor: `${theme.purple200} ${theme.background}`,
      }),
    }),
    input: provided => ({
      ...provided,
      color: theme.textColor,
      margin: 0,
    }),
    singleValue: (provided, state) => ({
      ...provided,
      color: state.isDisabled ? theme.disabled : theme.textColor,
      display: 'flex',
      alignItems: 'center',
      marginLeft: 0,
      marginRight: 0,
      width: `calc(100% - ${theme.formPadding[size].paddingLeft}px - ${space(0.5)})`,
    }),
    placeholder: (provided, state) => ({
      ...provided,
      color: state.isDisabled ? theme.disabled : theme.subText,
    }),
    multiValue: provided => ({
      ...provided,
      color: isDisabled ? theme.disabled : theme.textColor,
      backgroundColor: theme.background,
      borderRadius: '4px',
      border: `1px solid ${theme.border}`,
      display: 'flex',
      margin: 0,
      marginTop: multiValueSizeMapping[size].spacing,
      marginBottom: multiValueSizeMapping[size].spacing,
      marginRight: multiValueSizeMapping[size].spacing,
    }),
    multiValueLabel: provided => ({
      ...provided,
      color: isDisabled ? theme.disabled : theme.textColor,
      padding: multiValueSizeMapping[size].spacing,
      paddingLeft: multiValueSizeMapping[size].spacing,
      height: multiValueSizeMapping[size].height,
      display: 'flex',
      alignItems: 'center',
    }),
    multiValueRemove: () => ({
      alignItems: 'center',
      display: 'flex',
      padding: '0 4px',

      ...(isDisabled
        ? {
            pointerEvents: 'none',
          }
        : {
            '&:hover': {
              background: theme.hover,
            },
          }),
    }),
    indicatorsContainer: () => ({
      display: 'grid',
      gridAutoFlow: 'column',
      marginRight: theme.formSpacing[size],
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
        borderBottom: `solid 1px ${theme.innerBorder}`,
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

export const ChonkCheckWrap = chonkStyled('div')<{
  isMultiple: boolean;
  isSelected: boolean;
  size: FormSize;
}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 1em;
  height: 1.2em;

  ${p =>
    p.isMultiple
      ? `
      padding: 1px;
      border: solid 1px ${p.theme.border};
      background: ${p.theme.backgroundElevated};;
      border-radius: 2px;
      height: 1em;
      margin-top: 2px;
      ${
        p.isSelected &&
        `
        background: ${p.theme.purple300};
        border-color: ${p.theme.purple300};
       `
      }
    `
      : `
      ${
        p.isSelected &&
        `
        color: ${p.theme.colors.content.accent};
       `
      }
    `}
`;
