import {useMemo} from 'react';
import Async from 'react-select/async';
import AsyncCreatable from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';
import type {CSSObject} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {
  ChonkClearIndicator,
  ChonkDropdownIndicator,
  getChonkStylesConfig,
  selectSpacing,
  type StylesConfig,
} from '@sentry/scraps/select/select.chonk';

import type {
  GroupedOptionsType,
  OptionsType,
  OptionTypeBase,
  Props as ReactSelectProps,
} from 'sentry/components/forms/controls/reactSelectWrapper';
import {
  createFilter,
  mergeStyles,
  ReactSelect,
  components as selectComponents,
} from 'sentry/components/forms/controls/reactSelectWrapper';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Choices, SelectValue} from 'sentry/types/core';
import convertFromSelect2Choices from 'sentry/utils/convertFromSelect2Choices';
import PanelProvider from 'sentry/utils/panelProvider';
import type {FormSize} from 'sentry/utils/theme';

import {SelectOption} from './option';

export type {StylesConfig};

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
    return getChonkStylesConfig({
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
    ClearIndicator: ChonkClearIndicator,
    DropdownIndicator: ChonkDropdownIndicator,
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
