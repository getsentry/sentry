import {forwardRef, useCallback, useMemo} from 'react';
import ReactSelect, {
  components as selectComponents,
  GroupedOptionsType,
  mergeStyles,
  OptionsType,
  OptionTypeBase,
  Props as ReactSelectProps,
  StylesConfig as ReactSelectStylesConfig,
} from 'react-select';
import Async from 'react-select/async';
import AsyncCreatable from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';
import {CSSObject, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconClose} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Choices, SelectValue} from 'sentry/types';
import convertFromSelect2Choices from 'sentry/utils/convertFromSelect2Choices';
import PanelProvider from 'sentry/utils/panelProvider';
import {FormSize} from 'sentry/utils/theme';

import Option from './selectOption';

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

const SelectLoadingIndicator = () => (
  <LoadingIndicator mini size={20} style={{height: 20, width: 20}} />
);

const SingleValue = (
  props: React.ComponentProps<typeof selectComponents.SingleValue>
) => {
  const {leadingItems, label} = props.data;
  return (
    <selectComponents.SingleValue {...props}>
      <SingleValueWrap>
        {leadingItems}
        <SingleValueLabel>{label}</SingleValueLabel>
      </SingleValueWrap>
    </selectComponents.SingleValue>
  );
};

const SingleValueWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;

const SingleValueLabel = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const Menu = (props: React.ComponentProps<typeof selectComponents.Menu>) => {
  const {children, ...otherProps} = props;
  return (
    <selectComponents.Menu {...otherProps}>
      <PanelProvider>{children}</PanelProvider>
    </selectComponents.Menu>
  );
};

export type ControlProps<OptionType extends OptionTypeBase = GeneralSelectValue> = Omit<
  ReactSelectProps<OptionType>,
  'onChange' | 'value'
> & {
  /**
   * Backwards compatible shim to work with select2 style choice type.
   */
  choices?: Choices | ((props: ControlProps<OptionType>) => Choices);
  /**
   * Set to true to prefix selected values with content
   */
  inFieldLabel?: string;
  /**
   * Whether this is used inside compactSelect. See
   * components/compactSelect.tsx
   */
  isCompact?: boolean;
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
};

/**
 * Additional props provided by forwardRef
 */
type WrappedControlProps<OptionType extends OptionTypeBase> = ControlProps<OptionType> & {
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

// We don't care about any options for the styles config
export type StylesConfig = ReactSelectStylesConfig<any, boolean>;

function SelectControl<OptionType extends GeneralSelectValue = GeneralSelectValue>(
  props: WrappedControlProps<OptionType>
) {
  const theme = useTheme();
  const {size, isCompact, isSearchable, maxMenuWidth, menuHeight} = props;

  // TODO(epurkhiser): The loading indicator should probably also be our loading
  // indicator.

  // Unfortunately we cannot use emotions `css` helper here, since react-select
  // *requires* object styles, which the css helper cannot produce.
  const indicatorStyles = useCallback(
    ({padding: _padding, ...provided}: CSSObject) => ({
      ...provided,
      padding: '4px',
      alignItems: 'center',
      cursor: 'pointer',
      color: theme.subText,
    }),
    [theme]
  );

  const defaultStyles = useMemo<StylesConfig>(
    () => ({
      control: (_, state: any) => ({
        display: 'flex',
        // @ts-ignore Ignore merge errors as only defining the property once
        // makes code harder to understand.
        ...{
          color: theme.formText,
          background: theme.background,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.dropShadowLight,
        },
        borderRadius: theme.borderRadius,
        transition: 'border 0.1s, box-shadow 0.1s',
        alignItems: 'center',
        ...(state.isFocused && {
          borderColor: theme.focusBorder,
          boxShadow: `${theme.focusBorder} 0 0 0 1px`,
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
        ...(isCompact
          ? {
              padding: `${space(0.5)} ${space(0.5)}`,
              borderRadius: 0,
              border: 'none',
              boxShadow: 'none',
              cursor: 'initial',
              minHeight: 'none',
              ...(isSearchable
                ? {marginTop: 1}
                : {
                    height: 0,
                    padding: 0,
                    overflow: 'hidden',
                  }),
            }
          : omit(theme.form[size ?? 'md'], 'height')),
      }),

      menu: provided => ({
        ...provided,
        zIndex: theme.zIndex.dropdown,
        background: theme.backgroundElevated,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.borderRadius,
        boxShadow: theme.dropShadowHeavy,
        width: 'auto',
        minWidth: '100%',
        maxWidth: maxMenuWidth ?? 'auto',
        ...(isCompact && {
          position: 'relative',
          margin: 0,
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
          zIndex: 'initial',
          ...(isSearchable && {paddingTop: 0}),
        }),
      }),

      menuList: provided => ({
        ...provided,
        ...(isCompact && {
          ...(menuHeight && {
            maxHeight: menuHeight,
          }),
          ...(isSearchable && {
            paddingTop: 0,
          }),
        }),
      }),

      menuPortal: () => ({
        maxWidth: maxMenuWidth ?? '24rem',
        zIndex: theme.zIndex.dropdown,
        width: '90%',
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        background: theme.backgroundElevated,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.borderRadius,
        boxShadow: theme.dropShadowHeavy,
        overflow: 'hidden',
      }),

      option: provided => ({
        ...provided,
        cursor: 'pointer',
        color: theme.textColor,
        background: 'transparent',
        padding: 0,
        ':active': {
          background: 'transparent',
        },
      }),
      valueContainer: provided => ({
        ...provided,
        alignItems: 'center',
        ...(isCompact
          ? {
              padding: `${space(0.5)} ${space(1)}`,
              border: `1px solid ${theme.innerBorder}`,
              borderRadius: theme.borderRadius,
              cursor: 'text',
              background: theme.backgroundSecondary,
            }
          : {
              paddingLeft: theme.formPadding[size ?? 'md'].paddingLeft,
              paddingRight: space(0.5),
            }),
      }),
      input: provided => ({
        ...provided,
        color: theme.formText,
        margin: 0,
        ...(isCompact && {
          padding: 0,
        }),
      }),
      singleValue: provided => ({
        ...provided,
        color: theme.formText,
        display: 'flex',
        alignItems: 'center',
        marginLeft: 0,
        marginRight: 0,
        width: `calc(100% - ${theme.formPadding[size ?? 'md'].paddingLeft}px - ${space(
          0.5
        )})`,
      }),
      placeholder: provided => ({
        ...provided,
        color: theme.formPlaceholder,
        ...(isCompact && {
          padding: 0,
          margin: 0,
        }),
      }),
      multiValue: provided => ({
        ...provided,
        color: '#007eff',
        backgroundColor: '#ebf5ff',
        borderRadius: '2px',
        border: '1px solid #c2e0ff',
        display: 'flex',
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
        ...(isCompact && {display: 'none'}),
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
    }),
    [theme, size, maxMenuWidth, menuHeight, indicatorStyles, isSearchable, isCompact]
  );

  const getFieldLabelStyle = (label?: string) => ({
    ':before': {
      content: `"${label}"`,
      color: theme.gray300,
      fontWeight: 600,
      marginRight: space(1),
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
    singleValue: (base: CSSObject) => ({
      ...base,
      ...getFieldLabelStyle(inFieldLabel),
    }),
    placeholder: (base: CSSObject) => ({
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
    SingleValue,
    ClearIndicator,
    DropdownIndicator,
    MultiValueRemove,
    LoadingIndicator: SelectLoadingIndicator,
    IndicatorSeparator: null,
    Menu,
    Option,
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
      isOptionDisabled={opt => !!opt.disabled}
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

type PickerProps<OptionType extends OptionTypeBase> = ControlProps<OptionType> & {
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
};

function SelectPicker<OptionType extends OptionTypeBase>({
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
const RefForwardedSelectControl = forwardRef<
  ReactSelect<GeneralSelectValue>,
  ControlProps
>(function RefForwardedSelectControl(props, ref) {
  return <SelectControl forwardedRef={ref as any} {...props} />;
});

export default RefForwardedSelectControl;
