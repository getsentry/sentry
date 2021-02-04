import React from 'react';
import ReactSelect, {
  components as selectComponents,
  mergeStyles,
  OptionTypeBase,
  StylesConfig,
} from 'react-select';
import Async from 'react-select/async';
import AsyncCreatable from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';
import {withTheme} from 'emotion-theming';

import {IconChevron, IconClose} from 'app/icons';
import space from 'app/styles/space';
import {Choices} from 'app/types';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';
import {Theme} from 'app/utils/theme';

import SelectControlLegacy from './selectControlLegacy';

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

type ControlProps = React.ComponentProps<typeof ReactSelect> & {
  theme: Theme;
  /**
   * Ref forwarded into ReactSelect component.
   * The any is inherited from react-select.
   */
  forwardedRef: React.Ref<ReactSelect>;
  /**
   * Set to true to prefix selected values with content
   */
  inFieldLabel?: string;
  /**
   * Backwards compatible shim to work with select2 style choice type.
   */
  choices?: Choices | ((props: ControlProps) => Choices);
  /**
   * Use react-select v2. Deprecated, don't make more of this.
   */
  deprecatedSelectControl?: boolean;
};

type LegacyProps = React.ComponentProps<typeof SelectControlLegacy>;

function SelectControl(props: ControlProps) {
  // TODO(epurkhiser): We should remove all SelectControls (and SelectFields,
  // SelectAsyncFields, etc) that are using this prop, before we can remove the
  // v1 react-select component.
  if (props.deprecatedSelectControl) {
    const {deprecatedSelectControl: _, ...legacyProps} = props;
    return <SelectControlLegacy {...((legacyProps as unknown) as LegacyProps)} />;
  }

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
  });

  const defaultStyles: StylesConfig = {
    control: (_, state: any) => ({
      height: '100%',
      fontSize: '15px',
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
    multiValue: () => ({
      color: '#007eff',
      backgroundColor: '#ebf5ff',
      borderRadius: '2px',
      border: '1px solid #c2e0ff',
      display: 'flex',
      marginRight: '4px',
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
    const flatOptions = choicesOrOptions.flatMap(option => option.options || option);
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
    ? mergeStyles(inFieldLabelStyles, defaultStyles)
    : defaultStyles;

  // Allow the provided `styles` prop to override default styles using the same
  // function interface provided by react-styled. This ensures the `provided`
  // styles include our overridden default styles
  const mappedStyles = styles
    ? mergeStyles(styles, labelOrDefaultStyles)
    : labelOrDefaultStyles;

  const replacedComponents = {
    ClearIndicator,
    DropdownIndicator,
    MultiValueRemove,
    IndicatorSeparator: null,
  };

  return (
    <SelectPicker
      styles={mappedStyles}
      components={{...replacedComponents, ...components}}
      async={async}
      creatable={creatable}
      isClearable={clearable}
      backspaceRemovesValue={clearable}
      value={mappedValue}
      isMulti={props.multiple || props.multi}
      isDisabled={props.isDisabled || props.disabled}
      options={choicesOrOptions}
      openMenuOnFocus={props.openMenuOnFocus === undefined ? true : props.openMenuOnFocus}
      {...rest}
    />
  );
}
SelectControl.propTypes = SelectControlLegacy.propTypes;

const SelectControlWithTheme = withTheme(SelectControl);

type PickerProps = ControlProps & {
  /**
   * Enable async option loading.
   */
  async?: boolean;
  /**
   * Enable 'create' mode which allows values to be created inline
   */
  creatable?: boolean;
  /**
   * Enable 'clearable' which allows values to be removed.
   */
  clearable?: boolean;
};

function SelectPicker({async, creatable, forwardedRef, ...props}: PickerProps) {
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

SelectPicker.propTypes = SelectControl.propTypes;

const RefForwardedSelectControl = React.forwardRef(function RefForwardedSelectControl(
  props: ControlProps,
  ref: React.Ref<ReactSelect>
) {
  return <SelectControlWithTheme forwardedRef={ref} {...props} />;
});

// TODO(ts): Needed because <SelectField> uses this
RefForwardedSelectControl.propTypes = SelectControl.propTypes;

export default RefForwardedSelectControl;
