import React from 'react';
import ReactSelect, {
  components as selectComponents,
  GroupedOptionsType,
  mergeStyles,
  OptionsType,
  Props as ReactSelectProps,
  StylesConfig,
} from 'react-select';
import Async from 'react-select/async';
import AsyncCreatable from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';
import {withTheme} from '@emotion/react';

import {IconChevron, IconClose} from 'app/icons';
import space from 'app/styles/space';
import {Choices, SelectValue} from 'app/types';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';
import {Theme} from 'app/utils/theme';

function isGroupedOptions<OptionType>(
  maybe:
    | ReturnType<typeof convertFromSelect2Choices>
    | GroupedOptionsType<OptionType>
    | OptionType[]
    | OptionsType<OptionType>
): maybe is GroupedOptionsType<OptionType> {
  if (!maybe || maybe.length === 0) {
    return false;
  }
  return (maybe as GroupedOptionsType<OptionType>)[0].options !== undefined;
}

const ClearIndicator = (
  props: React.ComponentProps<typeof selectComponents.ClearIndicator>
) => (
  <selectComponents.ClearIndicator {...props}>
    <IconClose size="10px" />
  </selectComponents.ClearIndicator>
);

const DropdownIndicator = (
  props: React.ComponentProps<typeof selectComponents.DropdownIndicator>
) => (
  <selectComponents.DropdownIndicator {...props}>
    <IconChevron direction="down" size="14px" />
  </selectComponents.DropdownIndicator>
);

const MultiValueRemove = (
  props: React.ComponentProps<typeof selectComponents.MultiValueRemove>
) => (
  <selectComponents.MultiValueRemove {...props}>
    <IconClose size="8px" />
  </selectComponents.MultiValueRemove>
);

export type ControlProps<OptionType = GeneralSelectValue> = Omit<
  ReactSelectProps<OptionType>,
  'onChange' | 'value'
> & {
  /**
   * Set to true to prefix selected values with content
   */
  inFieldLabel?: string;
  /**
   * Backwards compatible shim to work with select2 style choice type.
   */
  choices?: Choices | ((props: ControlProps<OptionType>) => Choices);
  /**
   * Used by MultiSelectControl.
   */
  multiple?: boolean;
  /**
   * Handler for changes. Narrower than the types in react-select.
   */
  onChange?: (value?: OptionType | null) => void;
  /**
   * Unlike react-select which expects an OptionType as its value
   * we accept the option.value and resolve the option object.
   * Because this type is embedded in the OptionType generic we
   * can't have a good type here.
   */
  value?: any;
};

/**
 * Additional props provided by forwardRef and withTheme()
 */
type WrappedControlProps<OptionType> = ControlProps<OptionType> & {
  theme: Theme;
  /**
   * Ref forwarded into ReactSelect component.
   * The any is inherited from react-select.
   */
  forwardedRef: React.Ref<ReactSelect>;
};

// TODO(ts) The exported component uses forwardRef.
// This means we cannot fill the SelectValue generic
// at the call site. We use `any` here to avoid type errors with select
// controls that have custom option structures
export type GeneralSelectValue = SelectValue<any>;

function SelectControl<OptionType extends GeneralSelectValue = GeneralSelectValue>(
  props: WrappedControlProps<OptionType>
) {
  const {theme} = props;

  // TODO(epurkhiser): The loading indicator should probably also be our loading
  // indicator.

  // Unfortunately we cannot use emotions `css` helper here, since react-select
  // *requires* object styles, which the css helper cannot produce.
  const indicatorStyles = ({padding: _padding, ...provided}: React.CSSProperties) => ({
    ...provided,
    padding: '4px',
    alignItems: 'center',
    cursor: 'pointer',
    color: theme.subText,
  });

  const defaultStyles: StylesConfig = {
    control: (_, state: any) => ({
      height: '100%',
      fontSize: theme.fontSizeLarge,
      lineHeight: theme.text.lineHeightBody,
      display: 'flex',
      // @ts-ignore Ignore merge errors as only defining the property once
      // makes code harder to understand.
      ...{
        color: theme.formText,
        background: theme.background,
        border: `1px solid ${theme.border}`,
        boxShadow: `inset ${theme.dropShadowLight}`,
      },
      borderRadius: theme.borderRadius,
      transition: 'border 0.1s linear',
      alignItems: 'center',
      minHeight: '40px',
      '&:hover': {
        borderColor: theme.border,
      },
      ...(state.isFocused && {
        border: `1px solid ${theme.border}`,
        boxShadow: 'rgba(209, 202, 216, 0.5) 0 0 0 3px',
      }),
      ...(state.menuIsOpen && {
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0',
        boxShadow: 'none',
      }),
      ...(state.isDisabled && {
        borderColor: theme.border,
        background: theme.backgroundSecondary,
        color: theme.disabled,
        cursor: 'not-allowed',
      }),
      ...(!state.isSearchable && {
        cursor: 'pointer',
      }),
    }),

    menu: (provided: React.CSSProperties) => ({
      ...provided,
      zIndex: theme.zIndex.dropdown,
      marginTop: '-1px',
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
      borderTop: `1px solid ${theme.border}`,
      boxShadow: theme.dropShadowLight,
    }),
    option: (provided: React.CSSProperties, state: any) => ({
      ...provided,
      lineHeight: '1.5',
      fontSize: theme.fontSizeMedium,
      cursor: 'pointer',
      color: state.isFocused
        ? theme.textColor
        : state.isSelected
        ? theme.background
        : theme.textColor,
      backgroundColor: state.isFocused
        ? theme.focus
        : state.isSelected
        ? theme.active
        : 'transparent',
      '&:active': {
        backgroundColor: theme.active,
      },
    }),
    valueContainer: (provided: React.CSSProperties) => ({
      ...provided,
      alignItems: 'center',
    }),
    input: (provided: React.CSSProperties) => ({
      ...provided,
      color: theme.formText,
    }),
    singleValue: (provided: React.CSSProperties) => ({
      ...provided,
      color: theme.formText,
    }),
    placeholder: (provided: React.CSSProperties) => ({
      ...provided,
      color: theme.formPlaceholder,
    }),
    multiValue: (provided: React.CSSProperties) => ({
      ...provided,
      color: '#007eff',
      backgroundColor: '#ebf5ff',
      borderRadius: '2px',
      border: '1px solid #c2e0ff',
      display: 'flex',
    }),
    multiValueLabel: (provided: React.CSSProperties) => ({
      ...provided,
      color: '#007eff',
      padding: '0',
      paddingLeft: '6px',
      lineHeight: '1.8',
    }),
    multiValueRemove: () => ({
      cursor: 'pointer',
      alignItems: 'center',
      borderLeft: '1px solid #c2e0ff',
      borderRadius: '0 2px 2px 0',
      display: 'flex',
      padding: '0 4px',
      marginLeft: '4px',

      '&:hover': {
        color: '#6284b9',
        background: '#cce5ff',
      },
    }),
    indicatorsContainer: () => ({
      display: 'grid',
      gridAutoFlow: 'column',
      gridGap: '2px',
      marginRight: '6px',
    }),
    clearIndicator: indicatorStyles,
    dropdownIndicator: indicatorStyles,
    loadingIndicator: indicatorStyles,
    groupHeading: (provided: React.CSSProperties) => ({
      ...provided,
      lineHeight: '1.5',
      fontWeight: 600,
      backgroundColor: theme.backgroundSecondary,
      color: theme.textColor,
      marginBottom: 0,
      padding: `${space(1)} ${space(1.5)}`,
    }),
    group: (provided: React.CSSProperties) => ({
      ...provided,
      padding: 0,
    }),
  };

  const getFieldLabelStyle = (label?: string) => ({
    ':before': {
      content: `"${label}"`,
      color: theme.gray300,
      fontWeight: 600,
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
      // @ts-ignore The types used in react-select generics (OptionType) don't
      // line up well with our option type (SelectValue). We need to do more work
      // to get these types to align.
      flatOptions = choicesOrOptions.flatMap(option => option);
    }
    mappedValue =
      props.multiple && Array.isArray(value)
        ? value.map(val => flatOptions.find(option => option.value === val))
        : flatOptions.find(opt => opt.value === value) || value;
  }

  // Override the default style with in-field labels if they are provided
  const inFieldLabelStyles = {
    singleValue: (base: React.CSSProperties) => ({
      ...base,
      ...getFieldLabelStyle(inFieldLabel),
    }),
    placeholder: (base: React.CSSProperties) => ({
      ...base,
      ...getFieldLabelStyle(inFieldLabel),
    }),
  };
  const labelOrDefaultStyles = inFieldLabel
    ? mergeStyles(defaultStyles, inFieldLabelStyles)
    : defaultStyles;

  // Allow the provided `styles` prop to override default styles using the same
  // function interface provided by react-styled. This ensures the `provided`
  // styles include our overridden default styles
  const mappedStyles = styles
    ? mergeStyles(labelOrDefaultStyles, styles)
    : labelOrDefaultStyles;

  const replacedComponents = {
    ClearIndicator,
    DropdownIndicator,
    MultiValueRemove,
    IndicatorSeparator: null,
  };

  return (
    <SelectPicker<OptionType>
      styles={mappedStyles}
      components={{...replacedComponents, ...components}}
      async={async}
      creatable={creatable}
      isClearable={clearable}
      backspaceRemovesValue={clearable}
      value={mappedValue}
      isMulti={props.multiple || props.multi}
      isDisabled={props.isDisabled || props.disabled}
      options={options || (choicesOrOptions as OptionsType<OptionType>)}
      openMenuOnFocus={props.openMenuOnFocus === undefined ? true : props.openMenuOnFocus}
      {...rest}
    />
  );
}

const SelectControlWithTheme = withTheme(SelectControl);

type PickerProps<OptionType> = ControlProps<OptionType> & {
  /**
   * Enable async option loading.
   */
  async?: boolean;
  /**
   * Enable 'create' mode which allows values to be created inline.
   */
  creatable?: boolean;
  /**
   * Enable 'clearable' which allows values to be removed.
   */
  clearable?: boolean;
};

function SelectPicker<OptionType>({
  async,
  creatable,
  forwardedRef,
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

  return <Component ref={forwardedRef} {...props} />;
}

// The generics need to be filled here as forwardRef can't expose generics.
const RefForwardedSelectControl = React.forwardRef<
  ReactSelect<GeneralSelectValue>,
  ControlProps<GeneralSelectValue>
>(function RefForwardedSelectControl(props, ref) {
  return <SelectControlWithTheme forwardedRef={ref} {...props} />;
});

export default RefForwardedSelectControl;
