import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import {Item, Section} from '@react-stately/collections';
import {type ComboBoxStateOptions, useComboBoxState} from '@react-stately/combobox';
import omit from 'lodash/omit';

import {SelectFilterContext} from 'sentry/components/compactSelect/list';
import {ListBox} from 'sentry/components/compactSelect/listBox';
import {
  getDisabledOptions,
  getEscapedKey,
  getHiddenOptions,
  getItemsWithKeys,
} from 'sentry/components/compactSelect/utils';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';
import type {FormSize} from 'sentry/utils/theme';
import useOverlay from 'sentry/utils/useOverlay';

import {SelectContext} from '../compactSelect/control';

import type {
  ComboBoxOption,
  ComboBoxOptionOrSection,
  ComboBoxOptionOrSectionWithKey,
} from './types';

interface ComboBoxProps<Value extends string>
  extends ComboBoxStateOptions<ComboBoxOptionOrSection<Value>> {
  'aria-label': string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  size?: FormSize;
  sizeLimit?: number;
  sizeLimitMessage?: string;
}

function ComboBox<Value extends string>({
  size = 'md',
  className,
  placeholder,
  disabled,
  isLoading,
  sizeLimitMessage,
  menuTrigger = 'focus',
  ...props
}: ComboBoxProps<Value>) {
  const theme = useTheme();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sizingRef = useRef<HTMLDivElement>(null);

  const state = useComboBoxState({
    // Mapping our disabled prop to react-aria's isDisabled
    isDisabled: disabled,
    ...props,
  });
  const {inputProps, listBoxProps} = useComboBox(
    {listBoxRef, inputRef, popoverRef, isDisabled: disabled, ...props},
    state
  );

  // Sync input width with sizing div
  // TODO: think of making this configurable with a prop
  // TODO: extract into separate component
  useLayoutEffect(() => {
    if (sizingRef.current && inputRef.current) {
      const computedStyles = window.getComputedStyle(inputRef.current);

      const newTotalInputSize =
        sizingRef.current.offsetWidth +
        parseInt(computedStyles.paddingLeft, 10) +
        parseInt(computedStyles.paddingRight, 10) +
        parseInt(computedStyles.borderWidth, 10) * 2;

      inputRef.current.style.width = `${newTotalInputSize}px`;
    }
  }, [state.inputValue]);

  // Make popover width constant while it is open
  useEffect(() => {
    if (listBoxRef.current && state.isOpen) {
      const listBoxElement = listBoxRef.current;
      listBoxElement.style.width = `${listBoxElement.offsetWidth + 4}px`;
      return () => {
        listBoxElement.style.width = 'max-content';
      };
    }
    return () => {};
  }, [state.isOpen]);

  const selectContext = useContext(SelectContext);

  const {overlayProps, triggerProps} = useOverlay({
    type: 'listbox',
    isOpen: state.isOpen,
    position: 'bottom-start',
    offset: [0, 8],
    isDismissable: true,
    isKeyboardDismissDisabled: true,
    onInteractOutside: () => {
      state.close();
      inputRef.current?.blur();
    },
    shouldCloseOnBlur: true,
  });

  // The menu opens after selecting an item but the input stais focused
  // This ensures the user can open the menu again by clicking on the input
  const handleInputClick = useCallback(() => {
    if (!state.isOpen && menuTrigger === 'focus') {
      state.open();
    }
  }, [state, menuTrigger]);

  return (
    <SelectContext.Provider
      value={{
        ...selectContext,
        overlayIsOpen: state.isOpen,
      }}
    >
      <ControlWrapper className={className}>
        <StyledInput
          {...inputProps}
          onClick={handleInputClick}
          placeholder={placeholder}
          ref={mergeRefs([inputRef, triggerProps.ref])}
          size={size}
        />
        <SizingDiv aria-hidden ref={sizingRef} size={size}>
          {state.inputValue}
        </SizingDiv>
        <StyledPositionWrapper
          {...overlayProps}
          zIndex={theme.zIndex?.tooltip}
          visible={state.isOpen}
        >
          <StyledOverlay ref={popoverRef}>
            {isLoading && (
              <MenuHeader size={size}>
                <MenuTitle>{t('Loading...')}</MenuTitle>
                <MenuHeaderTrailingItems>
                  {isLoading && <StyledLoadingIndicator size={12} mini />}
                </MenuHeaderTrailingItems>
              </MenuHeader>
            )}
            {/* Listbox adds a separator if it is not the first item
            To avoid this, we wrap it into a div */}
            <div>
              <ListBox
                {...listBoxProps}
                ref={listBoxRef}
                listState={state}
                keyDownHandler={() => true}
                size={size}
                sizeLimitMessage={sizeLimitMessage}
              />
              <EmptyMessage>No items found</EmptyMessage>
            </div>
          </StyledOverlay>
        </StyledPositionWrapper>
      </ControlWrapper>
    </SelectContext.Provider>
  );
}

/**
 * Component that allows users to select an option from a dropdown list
 * by typing in a input field
 *
 * **WARNING: This component is still experimental and may change in the future.**
 */
function ControlledComboBox<Value extends string>({
  options,
  sizeLimit,
  value,
  ...props
}: Omit<ComboBoxProps<Value>, 'items' | 'defaultItems' | 'children'> & {
  options: ComboBoxOptionOrSection<Value>[];
  defaultValue?: Value;
  onChange?: (value: ComboBoxOption<Value>) => void;
  value?: Value;
}) {
  const [isFiltering, setIsFiltering] = useState(true);
  const [inputValue, setInputValue] = useState(() => {
    return (
      options
        .flatMap(item => ('options' in item ? item.options : [item]))
        .find(option => option.value === value)?.label ?? ''
    );
  });

  // Sync input value with value prop
  const previousValue = useRef(value);
  if (previousValue.current !== value) {
    const selectedLabel = options
      .flatMap(item => ('options' in item ? item.options : [item]))
      .find(option => option.value === value)?.label;
    if (selectedLabel) {
      setInputValue(selectedLabel);
    }
    previousValue.current = value;
  }

  const items = useMemo(() => {
    return getItemsWithKeys(options) as ComboBoxOptionOrSectionWithKey<Value>[];
  }, [options]);

  const hiddenOptions = useMemo(
    () => getHiddenOptions(items, isFiltering ? inputValue : '', sizeLimit),
    [items, isFiltering, inputValue, sizeLimit]
  );

  const disabledKeys = useMemo(
    () => [...getDisabledOptions(items), ...hiddenOptions].map(getEscapedKey),
    [hiddenOptions, items]
  );

  const handleChange = useCallback(
    (key: string | number) => {
      if (props.onSelectionChange) {
        props.onSelectionChange(key);
      }

      const flatItems = items.flatMap(item =>
        'options' in item ? item.options : [item]
      );
      const selectedOption = flatItems.find(item => item.key === key);
      if (selectedOption) {
        if (props.onChange) {
          props.onChange(omit(selectedOption, 'key'));
        }

        setInputValue(selectedOption.label);
      }
    },
    [items, props]
  );

  const handleInputChange = useCallback((newInputValue: string) => {
    setIsFiltering(true);
    setInputValue(newInputValue);
  }, []);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    // Disable filtering right after the dropdown is opened
    if (isOpen) {
      setIsFiltering(false);
    }
  }, []);

  return (
    // TODO: remove usage of SelectContext in ListBox
    <SelectContext.Provider
      value={{
        search: isFiltering ? inputValue : '',
        // Will be set by the inner ComboBox
        overlayIsOpen: false,
        // Not used in ComboBox
        registerListState: () => {},
        saveSelectedOptions: () => {},
      }}
    >
      <SelectFilterContext.Provider value={hiddenOptions}>
        <ComboBox
          disabledKeys={disabledKeys}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          selectedKey={value && getEscapedKey(value)}
          defaultSelectedKey={props.defaultValue && getEscapedKey(props.defaultValue)}
          onSelectionChange={handleChange}
          items={items}
          onOpenChange={handleOpenChange}
          {...props}
        >
          {items.map(item => {
            if ('options' in item) {
              return (
                <Section key={item.key} title={item.label}>
                  {item.options.map(option => (
                    <Item {...option} key={option.key} textValue={option.label}>
                      {item.label}
                    </Item>
                  ))}
                </Section>
              );
            }
            return (
              <Item {...item} key={item.key} textValue={item.label}>
                {item.label}
              </Item>
            );
          })}
        </ComboBox>
      </SelectFilterContext.Provider>
    </SelectContext.Provider>
  );
}

const ControlWrapper = styled('div')`
  position: relative;
  width: max-content;
  min-width: 150px;
  max-width: 100%;
`;

const StyledInput = styled(Input)`
  max-width: inherit;
  min-width: inherit;
`;

const SizingDiv = styled('div')<{size?: FormSize}>`
  opacity: 0;
  pointer-events: none;
  z-index: -1;
  position: absolute;
  white-space: pre;
  font-size: ${p => p.theme.form[p.size ?? 'md'].fontSize};
`;

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean}>`
  min-width: 100%;
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledOverlay = styled(Overlay)`
  /* Should be a flex container so that when maxHeight is set (to avoid page overflow),
  ListBoxWrap/GridListWrap will also shrink to fit */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 32rem;
  position: absolute;
  min-width: 100%;
`;

export const EmptyMessage = styled('p')`
  text-align: center;
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(1.5)} ${space(1)};
  margin: 0;

  /* Message should only be displayed when _all_ preceding lists are empty */
  display: block;
  ul:not(:empty) ~ & {
    display: none;
  }
`;

const headerVerticalPadding: Record<FormSize, string> = {
  xs: space(0.25),
  sm: space(0.5),
  md: space(0.75),
};
const MenuHeader = styled('div')<{size: FormSize}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => headerVerticalPadding[p.size]} ${space(1.5)};
  box-shadow: 0 1px 0 ${p => p.theme.translucentInnerBorder};

  line-height: ${p => p.theme.text.lineHeightBody};
  z-index: 2;

  font-size: ${p =>
    p.size !== 'xs' ? p.theme.fontSizeSmall : p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.headingColor};
`;

const MenuHeaderTrailingItems = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
`;

const MenuTitle = styled('span')`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: 600;
  white-space: nowrap;
  margin-right: ${space(2)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: 0 ${space(0.5)} 0 ${space(1)};
    height: 12px;
    width: 12px;
  }
`;
export {ControlledComboBox as ComboBox};
