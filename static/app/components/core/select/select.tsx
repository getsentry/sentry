import {useCallback, useImperativeHandle, useMemo, useRef} from 'react';
import Creatable from 'react-select/creatable';
import {useTheme} from '@emotion/react';
import type {CSSObject} from '@emotion/react';
import styled from '@emotion/styled';
import {useObjectRef} from '@react-aria/utils';
import {IconChevron} from '@sentry/icons/chevron';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {PanelProvider} from '@sentry/scraps/panelProvider';
import {Spinner} from '@sentry/scraps/spinner';
import type {FormSize, Theme} from '@sentry/scraps/theme';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {defined} from 'sentry/utils/defined';

import {createFilter} from './filter';
import {SelectOption} from './option';
import type {
  OptionsType,
  Props as ReactSelectProps,
  StylesConfig as ReactSelectStylesConfig,
  ValueType,
} from './reactSelectWrapper';
import {
  mergeStyles,
  ReactSelect,
  components as selectComponents,
} from './reactSelectWrapper';
import type {
  SelectHandle,
  SelectSelectionProps,
  SelectValue,
  StylesConfig,
} from './types';
import {VirtualizedMenuList} from './virtualizedMenuList';

// We don't care about any options for the styles config
type InternalStylesConfig = ReactSelectStylesConfig<any, boolean>;

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
  const indicatorStyles: InternalStylesConfig['clearIndicator'] &
    InternalStylesConfig['loadingIndicator'] = (
    provided,
    state: {isDisabled?: boolean}
  ) => ({
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
  const boxShadow = `0px 1px 0px 0px ${theme.tokens.interactive.chonky.debossed.neutral.chonk} inset`;

  return {
    control: (_, state) => ({
      display: 'flex',
      color: state.isDisabled
        ? theme.tokens.content.disabled
        : theme.tokens.content.primary,
      backgroundColor: theme.tokens.interactive.chonky.debossed.neutral.background,
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
      width: `calc(100% - ${theme.form[size].paddingLeft}px - ${theme.space.xs})`,
    }),
    placeholder: (provided, state) => ({
      ...provided,
      color: state.isDisabled
        ? theme.tokens.content.disabled
        : theme.tokens.content.secondary,
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
      color: theme.tokens.content.secondary,
      marginBottom: 0,
      padding: `${theme.space.xs} ${theme.space.lg}`,
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
        marginBottom: theme.space.md,
      },
      // Add divider between sections
      ':not(:last-of-type)::after': {
        content: '""',
        position: 'absolute',
        left: theme.space.lg,
        right: theme.space.lg,
        bottom: 0,
        borderBottom: `solid 1px ${theme.tokens.border.secondary}`,
      },
    }),
  } satisfies InternalStylesConfig;
};

type SelectContentProps<TValue, TOption extends SelectValue<TValue>> = Pick<
  BaseSelectProps<TValue, TOption>,
  | 'aria-describedby'
  | 'aria-invalid'
  | 'controlLeadingItems'
  | 'dropdownIndicator'
  | 'indicator'
  | 'inputRef'
  | 'menuFooter'
  | 'renderIndicators'
  | 'renderMultiValueLabel'
  | 'renderValue'
>;

function SelectInput<TValue, TOption extends SelectValue<TValue>>({
  selectProps,
  ...props
}: Omit<React.ComponentProps<typeof selectComponents.Input>, 'selectProps'> & {
  selectProps: SelectContentProps<TValue, TOption>;
}) {
  const {inputRef} = selectProps;
  const nativeInputRef = useObjectRef(inputRef);
  const ref = useCallback(
    (instance: {input: HTMLInputElement} | null) => {
      nativeInputRef.current = instance?.input ?? null;
    },
    [nativeInputRef]
  );
  return (
    <selectComponents.Input
      {...props}
      {...{ref}}
      aria-invalid={selectProps['aria-invalid']}
      aria-describedby={selectProps['aria-describedby']}
    />
  );
}

function SelectControl<TValue, TOption extends SelectValue<TValue>>({
  children,
  ...props
}: Omit<React.ComponentProps<typeof selectComponents.Control>, 'selectProps'> & {
  selectProps: SelectContentProps<TValue, TOption>;
}) {
  return (
    <selectComponents.Control {...props}>
      {props.selectProps.controlLeadingItems}
      {children}
    </selectComponents.Control>
  );
}

function IndicatorsContainer<TValue, TOption extends SelectValue<TValue>>({
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof selectComponents.IndicatorsContainer>,
  'selectProps'
> & {selectProps: SelectContentProps<TValue, TOption>}) {
  return props.selectProps.renderIndicators ? (
    props.selectProps.renderIndicators(children)
  ) : (
    <selectComponents.IndicatorsContainer {...props}>
      {props.selectProps.indicator}
      {children}
    </selectComponents.IndicatorsContainer>
  );
}

function MultiValueLabel<TValue, TOption extends SelectValue<TValue>>({
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof selectComponents.MultiValueLabel>,
  'selectProps' | 'data'
> & {data: TOption; selectProps: SelectContentProps<TValue, TOption>}) {
  return (
    <selectComponents.MultiValueLabel {...props}>
      {props.selectProps.renderMultiValueLabel
        ? props.selectProps.renderMultiValueLabel(props.data, children)
        : children}
    </selectComponents.MultiValueLabel>
  );
}

function ClearIndicator(
  props: React.ComponentProps<typeof selectComponents.ClearIndicator>
) {
  const {t} = useTranslation();

  // XXX(epurkhiser): In react-selct 5 accessibility is greatly improved, for
  // now we manually add aria labels to these interactive elements to help with
  // testing
  return (
    <selectComponents.ClearIndicator {...props}>
      <Button
        variant="transparent"
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
      {props.selectProps.dropdownIndicator ?? <IconChevron direction="down" size="xs" />}
    </selectComponents.DropdownIndicator>
  );
}

function MultiValueRemove(
  props: React.ComponentProps<typeof selectComponents.MultiValueRemove>
) {
  const {t} = useTranslation();

  // XXX(epurkhiser): In react-selct 5 accessibility is greatly improved, for
  // now we manually add aria labels to these interactive elements to help with
  // testing
  return (
    <selectComponents.MultiValueRemove {...props}>
      <IconClose aria-label={t('Remove item')} legacySize="8px" />
    </selectComponents.MultiValueRemove>
  );
}

function SelectSpinner() {
  return <Spinner mini size={14} style={{height: 14, width: 14}} />;
}

function SingleValue<TValue, TOption extends SelectValue<TValue>>(
  props: Omit<
    React.ComponentProps<typeof selectComponents.SingleValue>,
    'selectProps' | 'data'
  > & {data: TOption; selectProps: SelectContentProps<TValue, TOption>}
) {
  const {leadingItems, label} = props.data;
  const renderedLeadingItems =
    typeof leadingItems === 'function'
      ? leadingItems({disabled: props.isDisabled, isFocused: false, isSelected: true})
      : leadingItems;
  return (
    <selectComponents.SingleValue {...props}>
      {props.selectProps.renderValue ? (
        props.selectProps.renderValue(props.data)
      ) : (
        <SingleValueWrap>
          {renderedLeadingItems}
          <SingleValueLabel>{label}</SingleValueLabel>
        </SingleValueWrap>
      )}
    </selectComponents.SingleValue>
  );
}

const SingleValueWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const SingleValueLabel = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

function Menu(props: React.ComponentProps<typeof selectComponents.Menu>) {
  const {children, ...otherProps} = props;
  return (
    <selectComponents.Menu {...otherProps}>
      <PanelProvider>
        {children}
        {props.selectProps.menuFooter}
      </PanelProvider>
    </selectComponents.Menu>
  );
}

// Standalone selects can be uncontrolled or read-only. Keep each union member's
// value and callback types when making these props optional.
type OptionalSelectionProps<Props extends {onChange: unknown; value: unknown}> =
  Props extends unknown
    ? Omit<Props, 'value' | 'onChange'> & {
        defaultValue?: Props['value'];
        onChange?: Props['onChange'];
        value?: Props['value'];
      }
    : never;

/** Props shared by form fields and standalone selects. Implementation components stay private. */
export interface BaseSelectProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
> {
  // Include TValue here so options infer the value type without a selected value.
  options: ReadonlyArray<
    | (TOption & SelectValue<TValue>)
    | {options: ReadonlyArray<TOption & SelectValue<TValue>>; label?: React.ReactNode}
  >;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  autoFocus?: boolean;
  /** Blur after selection. Defaults to true for single selects, false for multiple. */
  blurInputOnSelect?: boolean;
  className?: string;
  /** Content inside the control, before the selected value and input. */
  controlLeadingItems?: React.ReactNode;
  /** Allow values that are not in `options`. */
  creatable?: boolean;
  disabled?: boolean;
  /** Set to null to hide the dropdown indicator. */
  dropdownIndicator?: React.ReactNode;
  /** Disabled row that describes an empty selection, for legacy form fields. */
  emptyOptionLabel?: React.ReactNode;
  filterOption?: ((option: TOption, input: string) => boolean) | null;
  formatCreateLabel?: (input: string) => React.ReactNode;
  /** ID of the native input, for association with a label. */
  id?: string;
  inFieldLabel?: string;
  indicator?: React.ReactNode;
  /** Ref to the native search input. */
  inputRef?: React.Ref<HTMLInputElement>;
  inputValue?: string;
  isInsideModal?: boolean;
  isLoading?: boolean;
  /** Controlled menu state. */
  isOpen?: boolean;
  /** Compare object values. Values are compared with === by default. */
  isValueEqual?: (a: TValue, b: TValue) => boolean;
  loadingMessage?: () => React.ReactNode;
  maxMenuHeight?: number;
  maxMenuWidth?: number | string;
  /** Content after the options, outside the scroll container. */
  menuFooter?: React.ReactNode;
  menuPortalTarget?: HTMLElement | null;
  minMenuHeight?: number;
  name?: string;
  noOptionsMessage?: (state: {inputValue: string}) => React.ReactNode;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onCreateOption?: (input: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Search text changes, including resets after selection, blur, or menu close. */
  onInputChange?: (input: string, reason: 'input' | 'reset') => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onOpenChange?: (isOpen: boolean) => void;
  openMenuOnClick?: boolean;
  openMenuOnFocus?: boolean;
  optionHeight?: number;
  placeholder?: React.ReactNode;
  ref?: React.Ref<SelectHandle>;
  renderIndicators?: (indicators: React.ReactNode) => React.ReactNode;
  renderMultiValueLabel?: (option: TOption, label: React.ReactNode) => React.ReactNode;
  renderOptionLabel?: (option: TOption) => React.ReactNode;
  renderValue?: (option: TOption) => React.ReactNode;
  searchable?: boolean;
  showCreateOptionIcon?: boolean;
  showDividers?: boolean;
  size?: FormSize;
  styles?: StylesConfig<NoInfer<TValue>, NoInfer<TOption>>;
  tabIndex?: number;
  /** Virtualize large lists, including lists with sections. */
  virtualized?: boolean;
}

export type ControlProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
> = OptionalSelectionProps<SelectSelectionProps<TValue, TOption>> &
  BaseSelectProps<TValue, TOption>;

export function Select<TValue, TOption extends SelectValue<TValue> = SelectValue<TValue>>(
  props: ControlProps<TValue, TOption>
) {
  const theme = useTheme();
  const {size, maxMenuWidth, isInsideModal} = props;

  const isSearchable = props.searchable;
  const isDisabled = props.disabled;

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
      marginRight: selectSpacing[props.size ?? 'md'],
    },
  });

  const {
    creatable,
    options,
    clearable,
    styles,
    value,
    defaultValue,
    emptyOptionLabel,
    onInputChange,
    filterOption,
    inFieldLabel,
    ref,
    inputRef,
    id,
    isOpen,
    onOpenChange,
    renderValue,
    renderMultiValueLabel,
    renderOptionLabel,
    renderIndicators,
    indicator,
    optionHeight,
    controlLeadingItems,
    dropdownIndicator,
    menuFooter,
    loadingMessage,
    virtualized,
    ...rest
  } = props;

  const flatOptions = options.flatMap(option =>
    'options' in option ? option.options : [option]
  );

  const mapValue = (rawValue: typeof value) => {
    let mappedValue: ValueType<TOption, boolean> | undefined;
    if (rawValue === undefined) {
      mappedValue = undefined;
    } else if (props.multiple) {
      mappedValue = [];
    } else {
      mappedValue = null;
    }

    const compare = (a: TValue | null | undefined, b: TValue | null | undefined) => {
      if (props.isValueEqual && defined(a) && defined(b)) {
        return props.isValueEqual(a, b);
      }
      return a === b;
    };

    const toOption = (val: TValue | null | undefined) =>
      creatable && defined(val)
        ? ({value: val, label: String(val)} as TOption)
        : undefined;

    if (Array.isArray(rawValue)) {
      mappedValue = rawValue
        .map(
          val => flatOptions.find(option => compare(option.value, val)) ?? toOption(val)
        )
        .filter(defined);
    } else {
      mappedValue =
        flatOptions.find(option => compare(option.value, rawValue)) ??
        toOption(rawValue) ??
        mappedValue;
    }

    return mappedValue;
  };
  const mappedValue = mapValue(value);
  const mappedDefaultValue = mapValue(defaultValue);
  const showEmptyOption =
    !props.multiple && !defined(value) && emptyOptionLabel !== undefined;
  const emptyOption = {value: null, label: emptyOptionLabel, disabled: true};
  const displayOptions = showEmptyOption ? [emptyOption, ...options] : options;

  // Override the default style with in-field labels if they are provided
  const inFieldLabelStyles: InternalStylesConfig = {
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

  const selectRef = useRef<{blur: () => void; focus: () => void}>(null);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => selectRef.current?.focus(),
      blur: () => selectRef.current?.blur(),
    }),
    []
  );

  const replacedComponents = {
    SingleValue: SingleValue<TValue, TOption>,
    ClearIndicator,
    DropdownIndicator,
    MultiValueRemove,
    LoadingIndicator: SelectSpinner,
    IndicatorSeparator: null,
    Menu,
    Input: SelectInput<TValue, TOption>,
    Control: SelectControl<TValue, TOption>,
    IndicatorsContainer: IndicatorsContainer<TValue, TOption>,
    MultiValueLabel: MultiValueLabel<TValue, TOption>,
    Option: SelectOption<TValue, TOption>,
    ...(dropdownIndicator === null && {DropdownIndicator: null}),
    ...(virtualized && {MenuList: VirtualizedMenuList}),
    ...(loadingMessage && {LoadingMessage: () => loadingMessage()}),
  };

  const filterOptions = createFilter<TValue, TOption>();

  return (
    <SelectPicker<TValue, TOption>
      filterOption={
        filterOption === null
          ? null
          : (candidate: {data: TOption}, input) =>
              (filterOption ?? filterOptions)(candidate.data, input)
      }
      styles={mappedStyles}
      components={replacedComponents as never}
      creatable={creatable}
      isClearable={clearable}
      backspaceRemovesValue={clearable}
      value={mappedValue}
      defaultValue={mappedDefaultValue}
      isMulti={props.multiple}
      isDisabled={isDisabled}
      isSearchable={isSearchable ?? true}
      isOptionDisabled={(option: TOption) => !!option.disabled}
      isOptionSelected={showEmptyOption ? option => option === emptyOption : undefined}
      controlShouldRenderValue={!showEmptyOption}
      showDividers={props.showDividers}
      options={displayOptions as OptionsType<TOption>}
      blurInputOnSelect={!props.multiple}
      closeMenuOnSelect={!props.multiple}
      hideSelectedOptions={false}
      tabSelectsValue={false}
      {...rest}
      ref={selectRef}
      inputRef={inputRef}
      inputId={id}
      onInputChange={(input, {action}) => {
        onInputChange?.(input, action === 'input-change' ? 'input' : 'reset');
      }}
      menuIsOpen={isOpen}
      onMenuOpen={() => onOpenChange?.(true)}
      onMenuClose={() => onOpenChange?.(false)}
      renderValue={renderValue}
      renderMultiValueLabel={renderMultiValueLabel}
      renderOptionLabel={renderOptionLabel}
      renderIndicators={renderIndicators}
      indicator={indicator}
      optionHeight={optionHeight}
      controlLeadingItems={controlLeadingItems}
      dropdownIndicator={dropdownIndicator}
      menuFooter={menuFooter}
    />
  );
}

type SelectPickerProps<TValue, TOption extends SelectValue<TValue>> = Omit<
  ControlProps<TValue, TOption>,
  'value' | 'styles' | 'defaultValue' | 'filterOption' | 'onInputChange'
> &
  Pick<
    ReactSelectProps<TOption, boolean>,
    | 'styles'
    | 'defaultValue'
    | 'filterOption'
    | 'backspaceRemovesValue'
    | 'blurInputOnSelect'
    | 'closeMenuOnSelect'
    | 'controlShouldRenderValue'
    | 'inputId'
    | 'isDisabled'
    | 'isClearable'
    | 'isSearchable'
    | 'isOptionDisabled'
    | 'isOptionSelected'
    | 'onInputChange'
    | 'components'
    | 'isMulti'
    | 'hideSelectedOptions'
    | 'tabSelectsValue'
    | 'menuIsOpen'
    | 'onMenuOpen'
    | 'onMenuClose'
  > & {value?: ValueType<TOption, boolean>};

function SelectPicker<TValue, TOption extends SelectValue<TValue>>({
  creatable,
  ref,
  ...props
}: SelectPickerProps<TValue, TOption>) {
  const Component: React.ComponentType<any> = creatable ? Creatable : ReactSelect;
  return <Component ref={ref as any} {...props} menuPlacement="auto" />;
}
