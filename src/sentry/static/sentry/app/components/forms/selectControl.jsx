import React from 'react';
import ReactSelect, {components as selectComponents} from 'react-select';
import Async from 'react-select/async';
import Creatable from 'react-select/creatable';
import AsyncCreatable from 'react-select/async-creatable';

import theme from 'app/utils/theme';
import InlineSvg from 'app/components/inlineSvg';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';

import SelectControlLegacy from './selectControlLegacy';

const ClearIndicator = props => (
  <selectComponents.ClearIndicator {...props}>
    <InlineSvg src="icon-close" size="10px" />
  </selectComponents.ClearIndicator>
);

const DropdownIndicator = props => (
  <selectComponents.DropdownIndicator {...props}>
    <InlineSvg src="icon-chevron-down" size="14px" />
  </selectComponents.DropdownIndicator>
);

const MultiValueRemove = props => (
  <selectComponents.MultiValueRemove {...props}>
    <InlineSvg src="icon-close" size="8px" />
  </selectComponents.MultiValueRemove>
);

// TODO(epurkhiser): The loading indicator should probably also be our loading
// indicator.

// Unfortunately we cannot use emotions `css` helper here, since react-select
// *requires* object styles, which the css helper cannot produce.

const indicatorStyles = ({padding: _padding, ...provided}) => ({
  ...provided,
  padding: '4px',
  alignItems: 'center',
  cursor: 'pointer',
});

const defaultStyles = {
  control: (_, state) => ({
    height: '100%',
    fontSize: '15px',
    color: theme.gray5,
    display: 'flex',
    background: '#fff',
    border: `1px solid ${theme.borderDark}`,
    borderRadius: theme.borderRadius,
    boxShadow: `inset ${theme.dropShadowLight}`,
    transition: 'border 0.1s linear',
    alignItems: 'center',
    minHeight: '36px',
    '&:hover': {
      borderColor: theme.gray1,
    },
    ...(state.isFocused && {
      border: `1px solid ${theme.gray1}`,
      boxShadow: 'rgba(209, 202, 216, 0.5) 0 0 0 3px',
    }),
    ...(state.menuIsOpen && {
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      boxShadow: 'none',
    }),
    ...(state.isDisabled && {
      borderColor: theme.borderDark,
      background: theme.whiteDark,
      color: theme.gray2,
      cursor: 'not-allowed',
    }),
  }),

  menu: provided => ({
    ...provided,
    zIndex: theme.zIndex.dropdown,
    marginTop: '-1px',
    background: '#fff',
    border: `1px solid ${theme.borderDark}`,
    borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
    borderTop: `1px solid ${theme.borderLight}`,
    boxShadow: theme.dropShadowLight,
  }),
  option: (provided, state) => ({
    ...provided,
    lineHeight: '1.5',
    fontSize: theme.fontSizeMedium,
    color: state.isFocused
      ? theme.textColor
      : state.isSelected
      ? theme.white
      : theme.textColor,
    backgroundColor: state.isFocused
      ? theme.offWhiteLight
      : state.isSelected
      ? theme.purple
      : 'transparent',
    '&:active': {
      backgroundColor: theme.offWhiteLight,
    },
  }),
  valueContainer: provided => ({
    ...provided,
    alignItems: 'center',
  }),
  multiValue: () => ({
    color: '#007eff',
    backgroundColor: '#ebf5ff',
    borderRadius: '2px',
    border: '1px solid #c2e0ff',
    display: 'flex',
    marginRight: '4px',
  }),
  multiValueLabel: provided => ({
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
};

const SelectControl = props => {
  // TODO(epurkhiser): We should remove all SelectControls (and SelectFields,
  // SelectAsyncFields, etc) that are using this prop, before we can remove the
  // v1 react-select component.
  if (props.deprecatedSelectControl) {
    const {deprecatedSelectControl: _, ...legacyProps} = props;
    return <SelectControlLegacy {...legacyProps} />;
  }

  const {
    async,
    creatable,
    options,
    choices,
    clearable,
    components,
    styles,
    value,
    ...rest
  } = props;

  // Compatibility with old select2 API
  const choicesOrOptions =
    convertFromSelect2Choices(typeof choices === 'function' ? choices(props) : choices) ||
    options;

  // It's possible that `choicesOrOptions` does not exist (e.g. in the case of AsyncSelect)
  let mappedValue = value;

  if (choicesOrOptions) {
    // Value is expected to be object like the options list, we map it back from
    // the options list
    mappedValue =
      props.multiple && Array.isArray(value)
        ? value.map(val => choicesOrOptions.find(option => option.value === val))
        : choicesOrOptions.find(opt => opt.value === value) || value;
  }

  // Allow the provided `styles` prop to override default styles using the same
  // function interface provided by react-styled. This ensures the `provided`
  // styles include our overridden default styles
  const mappedStyles = Object.keys(styles || {}).reduce((computedStyles, key) => {
    const styleFunc = (provided, state) =>
      styles[key](
        computedStyles[key] === undefined
          ? provided
          : computedStyles[key](provided, state),
        state
      );
    return {...computedStyles, [key]: styleFunc};
  }, defaultStyles);

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
      clearable={clearable}
      backspaceRemovesValue={clearable}
      value={mappedValue}
      isMulti={props.multiple || props.multi}
      options={choicesOrOptions}
      {...rest}
    />
  );
};

SelectControl.propTypes = SelectControlLegacy.propTypes;

const SelectPicker = ({async, creatable, forwardedRef, ...props}) => {
  // Pick the right component to use
  let Component;
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
};

SelectPicker.propTypes = SelectControl.propTypes;

const forwardRef = (props, ref) => <SelectControl forwardedRef={ref} {...props} />;
forwardRef.displayName = 'RefForwardedSelectControl';

const RefForwardedSelectControl = React.forwardRef(forwardRef);

// TODO(ts): Needed because <SelectField> uses this
RefForwardedSelectControl.propTypes = SelectControl.propTypes;

export default RefForwardedSelectControl;
