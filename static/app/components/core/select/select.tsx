import {useMemo} from 'react';
import Async from 'react-select/async';
import AsyncCreatable from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';
import {css, useTheme} from '@emotion/react';
import type {CSSObject} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {debossedBackground} from 'sentry/components/core/chonk';
import type {
  GroupedOptionsType,
  OptionsType,
  OptionTypeBase,
  Props as ReactSelectProps,
  StylesConfig as ReactSelectStylesConfig,
} from 'sentry/components/forms/controls/reactSelectWrapper';
import {
  createFilter,
  mergeStyles,
  ReactSelect,
  components as selectComponents,
} from 'sentry/components/forms/controls/reactSelectWrapper';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Choices, SelectValue} from 'sentry/types/core';
import convertFromSelect2Choices from 'sentry/utils/convertFromSelect2Choices';
import PanelProvider from 'sentry/utils/panelProvider';
import type {FormSize, Theme} from 'sentry/utils/theme';

import {SelectOption} from './option';

// We don't care about any options for the styles config
export type StylesConfig = ReactSelectStylesConfig<any, boolean>;

const selectSpacing = {
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

const getStylesConfig = ({
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
    color: state.isDisabled
      ? theme.tokens.content.disabled
      : theme.tokens.content.primary,
    ':hover': {
      color: 'currentcolor',
    },
  });
  const boxShadow = `0px 1px 0px 0px ${theme.tokens.border.primary} inset`;

  return {
    control: (_, state) => ({
      display: 'flex',
      color: state.isDisabled
        ? theme.tokens.content.disabled
        : theme.tokens.content.primary,
      ...debossedBackground(theme),
      border: `1px solid ${theme.tokens.border.primary}`,
      boxShadow,
      borderRadius: theme.form[size].borderRadius,
      transition: `border ${theme.motion.smooth.fast}, box-shadow ${theme.motion.smooth.fast}`,
      alignItems: 'center',
      ...(state.isFocused && theme.focusRing(boxShadow)),
      ...(state.isDisabled && {
        background: theme.tokens.background.primary,
        color: theme.tokens.content.disabled,
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
      border: `1px solid ${theme.tokens.border.primary}`,
      boxShadow: 'none',
      width: 'auto',
      minWidth: '100%',
      maxWidth: maxMenuWidth ?? 'auto',
    }),
    noOptionsMessage: provided => ({
      ...provided,
      color: theme.tokens.content.disabled,
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
        scrollbarColor: `${theme.tokens.graphics.accent.moderate} ${theme.tokens.background.primary}`,
      }),
    }),
    input: provided => ({
      ...provided,
      color: theme.tokens.content.primary,
      margin: 0,
    }),
    singleValue: (provided, state) => ({
      ...provided,
      color: state.isDisabled
        ? theme.tokens.content.disabled
        : theme.tokens.content.primary,
      display: 'flex',
      alignItems: 'center',
      marginLeft: 0,
      marginRight: 0,
      width: `calc(100% - ${theme.form[size].paddingLeft}px - ${space(0.5)})`,
    }),
    placeholder: (provided, state) => ({
      ...provided,
      color: state.isDisabled ? theme.tokens.content.disabled : theme.subText,
    }),
    multiValue: provided => ({
      ...provided,
      backgroundColor: theme.tokens.background.primary,
      color: isDisabled ? theme.tokens.content.disabled : theme.tokens.content.primary,
      borderRadius: '4px',
      border: `1px solid ${theme.tokens.border.primary}`,
      boxShadow: `0px 1px 0px 0px ${theme.tokens.border.primary}`,
      display: 'flex',
      margin: 0,
      marginTop: multiValueSizeMapping[size].spacing,
      marginBottom: multiValueSizeMapping[size].spacing,
      marginRight: multiValueSizeMapping[size].spacing,
    }),
    multiValueLabel: provided => ({
      ...provided,
      color: isDisabled ? theme.tokens.content.disabled : theme.tokens.content.primary,
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
              background: theme.tokens.interactive.transparent.neutral.background.hover,
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

function ClearIndicator(
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

function DropdownIndicator(
  props: React.ComponentProps<typeof selectComponents.DropdownIndicator>
) {
  return (
    <selectComponents.DropdownIndicator {...props}>
      <IconChevron direction="down" size="xs" />
    </selectComponents.DropdownIndicator>
  );
}

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
          ${p.isSelected &&
          css`
            background: ${p.theme.tokens.background.accent.vibrant};
            border-color: ${p.theme.tokens.background.accent.vibrant};
          `}
        `
      : css`
          ${p.isSelected &&
          css`
            color: ${p.theme.tokens.content.accent};
          `}
        `}
`;

function isGroupedOptions<OptionType extends OptionTypeBase>(
  maybe:
    | ReturnType<typeof convertFromSelect2Choices>
    | GroupedOptionsType<OptionType>
    | OptionType[]
    | OptionsType<OptionType>
): maybe is GroupedOptionsType<OptionType> {
  if (!maybe || maybe.length === 0) {
    return false;
  }
  return (maybe as GroupedOptionsType<OptionType>)[0]!.options !== undefined;
}

function MultiValueRemove(
  props: React.ComponentProps<typeof selectComponents.MultiValueRemove>
) {
  // XXX(epurkhiser): In react-selct 5 accessibility is greatly improved, for
  // now we manually add aria labels to these interactive elements to help with
  // testing
  return (
    <selectComponents.MultiValueRemove {...props}>
      <IconClose aria-label={t('Remove item')} legacySize="8px" />
    </selectComponents.MultiValueRemove>
  );
}

function SelectLoadingIndicator() {
  return <LoadingIndicator mini size={20} style={{height: 20, width: 20}} />;
}

function SingleValue(props: React.ComponentProps<typeof selectComponents.SingleValue>) {
  const {leadingItems, label} = props.data;
  return (
    <selectComponents.SingleValue {...props}>
      <SingleValueWrap>
        {leadingItems}
        <SingleValueLabel>{label}</SingleValueLabel>
      </SingleValueWrap>
    </selectComponents.SingleValue>
  );
}

const SingleValueWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;

const SingleValueLabel = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

function Menu(props: React.ComponentProps<typeof selectComponents.Menu>) {
  const {children, ...otherProps} = props;
  return (
    <selectComponents.Menu {...otherProps}>
      <PanelProvider>{children}</PanelProvider>
    </selectComponents.Menu>
  );
}

export interface ControlProps<OptionType extends OptionTypeBase = GeneralSelectValue>
  extends Omit<ReactSelectProps<OptionType>, 'onChange' | 'value' | 'menuPlacement'> {
  /**
   * Backwards compatible shim to work with select2 style choice type.
   */
  choices?: Choices | ((props: ControlProps<OptionType>) => Choices);
  /**
   * Set to true to prefix selected values with content
   */
  inFieldLabel?: string;
  /**
   * Whether this selector is being rendered inside a modal. If true, the menu will have a higher z-index.
   */
  isInsideModal?: boolean;
  /**
   * Maximum width of the menu component. Menu item labels that overflow the
   * menu's boundaries will automatically be truncated.
   */
  maxMenuWidth?: number | string;
  /**
   * Used by MultiSelectControl.
   */
  multiple?: boolean;
  /**
   * Handler for changes. Narrower than the types in react-select.
   */
  onChange?: (value?: OptionType | null) => void;
  ref?: React.Ref<typeof ReactSelect>;
  /**
   * Show line dividers between options
   */
  showDividers?: boolean;
  size?: FormSize;
  /**
   * Unlike react-select which expects an OptionType as its value
   * we accept the option.value and resolve the option object.
   * Because this type is embedded in the OptionType generic we
   * can't have a good type here.
   */
  value?: any;
}

// TODO(ts) The exported component uses forwardRef.
// This means we cannot fill the SelectValue generic
// at the call site. We use `any` here to avoid type errors with select
// controls that have custom option structures
export type GeneralSelectValue = SelectValue<any>;

function SelectControl<OptionType extends GeneralSelectValue = GeneralSelectValue>(
  props: ControlProps<OptionType>
) {
  const theme = useTheme();
  const {size, maxMenuWidth, isInsideModal} = props;

  const isSearchable = props.isSearchable || props.searchable;
  const isDisabled = props.isDisabled || props.disabled;

  const defaultStyles = useMemo(() => {
    return getStylesConfig({
      theme,
      size,
      maxMenuWidth,
      isInsideModal,
      isSearchable,
      isDisabled,
    });
  }, [theme, size, maxMenuWidth, isInsideModal, isSearchable, isDisabled]);

  const getFieldLabelStyle = (label?: string): CSSObject => ({
    ':before': {
      content: `"${label}"`,
      color: theme.colors.gray800,
      fontWeight: 600,
      marginRight: selectSpacing[size ?? 'md'],
    },
  });

  const {
    async,
    creatable,
    options,
    choices,
    clearable,
    components,
    styles,
    value,
    inFieldLabel,
    ...rest
  } = props;

  // Compatibility with old select2 API
  //
  // TODO(epurkhiser): We need better types on this coomponent to have higher
  // confidence to remove this. There's likely few places we still use the
  // select2 style choices.
  const choicesOrOptions =
    convertFromSelect2Choices(typeof choices === 'function' ? choices(props) : choices) ||
    options;

  // It's possible that `choicesOrOptions` does not exist (e.g. in the case of AsyncSelect)
  let mappedValue = value;

  if (choicesOrOptions) {
    /**
     * Value is expected to be object like the options list, we map it back from the options list.
     * Note that if the component doesn't have options or choices passed in
     * because the select component fetches the options finding the mappedValue will fail
     * and the component won't work
     */
    let flatOptions: any[] = [];
    if (isGroupedOptions<OptionType>(choicesOrOptions)) {
      flatOptions = choicesOrOptions.flatMap(option => option.options);
    } else {
      flatOptions = choicesOrOptions.flatMap((option: any) => option);
    }
    mappedValue =
      props.multiple && Array.isArray(value)
        ? value.map(val => flatOptions.find(option => option.value === val))
        : flatOptions.find(opt => opt.value === value) || value;
  }

  // Override the default style with in-field labels if they are provided
  const inFieldLabelStyles: StylesConfig = {
    singleValue: (base: CSSObject) => ({
      ...base,
      ...getFieldLabelStyle(inFieldLabel),
    }),
    placeholder: (base: CSSObject) => ({
      ...base,
      ...getFieldLabelStyle(inFieldLabel),
    }),
  };
  const labelOrDefaultStyles: StylesConfig = inFieldLabel
    ? mergeStyles(defaultStyles, inFieldLabelStyles)
    : defaultStyles;

  // Allow the provided `styles` prop to override default styles using the same
  // function interface provided by react-styled. This ensures the `provided`
  // styles include our overridden default styles
  const mappedStyles: StylesConfig = styles
    ? mergeStyles(labelOrDefaultStyles, styles)
    : labelOrDefaultStyles;

  const replacedComponents = {
    SingleValue,
    ClearIndicator,
    DropdownIndicator,
    MultiValueRemove,
    LoadingIndicator: SelectLoadingIndicator,
    IndicatorSeparator: null,
    Menu,
    Option: SelectOption,
    ...components,
  };

  const filterOptions = createFilter({
    // Use `textValue` if available
    stringify: option => option.data.textValue ?? `${option.label} ${option.value}`,
  });

  return (
    <SelectPicker<OptionType>
      filterOption={filterOptions}
      styles={mappedStyles}
      components={replacedComponents}
      async={async}
      creatable={creatable}
      isClearable={clearable}
      backspaceRemovesValue={clearable}
      value={mappedValue}
      isMulti={props.multiple || props.multi}
      isDisabled={props.isDisabled || props.disabled}
      isOptionDisabled={(opt: any) => !!opt.disabled}
      showDividers={props.showDividers}
      options={options || (choicesOrOptions as OptionsType<OptionType>)}
      openMenuOnFocus={props.openMenuOnFocus}
      blurInputOnSelect={!props.multiple && !props.multi}
      closeMenuOnSelect={!(props.multiple || props.multi)}
      hideSelectedOptions={false}
      tabSelectsValue={false}
      {...rest}
    />
  );
}

interface PickerProps<OptionType extends OptionTypeBase>
  extends ControlProps<OptionType> {
  /**
   * Enable async option loading.
   */
  async?: boolean;
  /**
   * Enable 'clearable' which allows values to be removed.
   */
  clearable?: boolean;
  /**
   * Enable 'create' mode which allows values to be created inline.
   */
  creatable?: boolean;
}

function SelectPicker<OptionType extends OptionTypeBase>({
  async,
  creatable,
  ref,
  ...props
}: PickerProps<OptionType>) {
  // Pick the right component to use
  // Using any here as react-select types also use any
  let Component: React.ComponentType<any> | undefined;
  if (async && creatable) {
    Component = AsyncCreatable;
  } else if (async && !creatable) {
    Component = Async;
  } else if (creatable) {
    Component = Creatable;
  } else {
    Component = ReactSelect;
  }

  return <Component ref={ref as any} {...props} menuPlacement="auto" />;
}

// XXX (tkdodo): this type assertion is a leftover from when we had forwardRef
// Omit on the ControlProps messes up the union type
// the fix is to remove this type assertion, export Select directly and fix the type issues
export const Select = SelectControl as (
  props: Omit<ControlProps, 'ref'> &
    React.RefAttributes<typeof ReactSelect<GeneralSelectValue>>
) => React.JSX.Element;
