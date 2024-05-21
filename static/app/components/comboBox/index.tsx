import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import {Item, Section} from '@react-stately/collections';
import {type ComboBoxStateOptions, useComboBoxState} from '@react-stately/combobox';
import omit from 'lodash/omit';

import {ListBox} from 'sentry/components/compactSelect/listBox';
import {
  getDisabledOptions,
  getEscapedKey,
  getHiddenOptions,
  getItemsWithKeys,
} from 'sentry/components/compactSelect/utils';
import {GrowingInput} from 'sentry/components/growingInput';
import Input from 'sentry/components/input';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';
import type {FormSize} from 'sentry/utils/theme';
import useOverlay from 'sentry/utils/useOverlay';

import type {
  ComboBoxOption,
  ComboBoxOptionOrSection,
  ComboBoxOptionOrSectionWithKey,
} from './types';

interface ComboBoxProps<Value extends string>
  extends Omit<
    ComboBoxStateOptions<ComboBoxOptionOrSection<Value>>,
    'allowsCustomValue'
  > {
  'aria-label': string;
  className?: string;
  disabled?: boolean;
  growingInput?: boolean;
  hasSearch?: boolean;
  hiddenOptions?: Set<string>;
  isLoading?: boolean;
  loadingMessage?: string;
  menuSize?: FormSize;
  menuWidth?: string;
  size?: FormSize;
  sizeLimit?: number;
  sizeLimitMessage?: string;
}

function ComboBox<Value extends string>({
  size = 'md',
  menuSize,
  className,
  placeholder,
  disabled,
  isLoading,
  loadingMessage,
  sizeLimitMessage,
  menuTrigger = 'focus',
  growingInput = false,
  onOpenChange,
  menuWidth,
  hiddenOptions,
  hasSearch,
  ...props
}: ComboBoxProps<Value>) {
  const theme = useTheme();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const state = useComboBoxState({
    // Mapping our disabled prop to react-aria's isDisabled
    isDisabled: disabled,
    onOpenChange: (isOpen, ...otherArgs) => {
      onOpenChange?.(isOpen, ...otherArgs);
      if (isOpen) {
        // Ensure the selected element is being focused
        state.selectionManager.setFocusedKey(state.selectedKey);
      }
    },
    ...props,
  });

  const {inputProps, listBoxProps} = useComboBox(
    {
      listBoxRef,
      inputRef,
      popoverRef,
      shouldFocusWrap: true,
      isDisabled: disabled,
      ...props,
    },
    state
  );

  // Make popover width constant while it is open
  useEffect(() => {
    if (!menuWidth && popoverRef.current && state.isOpen) {
      const popoverElement = popoverRef.current;
      popoverElement.style.width = `${popoverElement.offsetWidth + 4}px`;
      return () => {
        popoverElement.style.width = 'max-content';
      };
    }
    return () => {};
  }, [menuWidth, state.isOpen]);

  useEffect(() => {
    const popoverElement = popoverRef.current;
    // Reset scroll state on opening the popover
    if (popoverElement) {
      popoverElement.scrollTop = 0;
    }
  }, [state.isOpen]);

  const {overlayProps, triggerProps} = useOverlay({
    type: 'listbox',
    isOpen: state.isOpen,
    position: 'bottom-start',
    offset: [0, 8],
    isDismissable: true,
    onInteractOutside: () => {
      state.close();
      inputRef.current?.blur();
    },
    shouldCloseOnBlur: true,
  });

  // The menu opens after selecting an item but the input stays focused
  // This ensures the user can open the menu again by clicking on the input
  const handleInputClick = useCallback(() => {
    if (!state.isOpen && menuTrigger === 'focus') {
      state.open();
    }
  }, [state, menuTrigger]);

  const handleInputMouseUp = useCallback((event: React.MouseEvent<HTMLInputElement>) => {
    // Prevents the input from being selected when clicking on the trigger
    event.preventDefault();
  }, []);

  const handleInputFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      const onFocusProp = inputProps.onFocus;
      onFocusProp?.(event);
      if (menuTrigger === 'focus') {
        state.open();
      }
      // Need to setTimeout otherwise Chrome might reset the selection on padding click
      setTimeout(() => {
        event.target.select();
      }, 0);
    },
    [inputProps.onFocus, menuTrigger, state]
  );

  const InputComponent = growingInput ? StyledGrowingInput : StyledInput;

  return (
    <ControlWrapper className={className}>
      {!state.isFocused && <InteractionStateLayer />}
      <InputComponent
        {...inputProps}
        onClick={handleInputClick}
        placeholder={placeholder}
        onMouseUp={handleInputMouseUp}
        onFocus={handleInputFocus}
        ref={mergeRefs([inputRef, triggerProps.ref])}
        size={size}
      />
      <StyledPositionWrapper
        {...overlayProps}
        zIndex={theme.zIndex?.tooltip}
        visible={state.isOpen}
      >
        <StyledOverlay ref={popoverRef} width={menuWidth}>
          {isLoading && (
            <MenuHeader size={menuSize ?? size}>
              <MenuTitle>{loadingMessage ?? t('Loading...')}</MenuTitle>
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
              overlayIsOpen={state.isOpen}
              hiddenOptions={hiddenOptions}
              hasSearch={hasSearch}
              ref={listBoxRef}
              listState={state}
              keyDownHandler={() => true}
              size={menuSize ?? size}
              sizeLimitMessage={sizeLimitMessage}
            />
            <EmptyMessage>No items found</EmptyMessage>
          </div>
        </StyledOverlay>
      </StyledPositionWrapper>
    </ControlWrapper>
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
  onOpenChange,
  ...props
}: Omit<
  ComboBoxProps<Value>,
  'items' | 'defaultItems' | 'children' | 'hasSearch' | 'hiddenOptions'
> & {
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

  const valueRef = useRef(value);
  valueRef.current = value;

  const handleChange = useCallback(
    (key: string | number) => {
      // Prevent calling onChange on closing the menu without selecting a different value
      if (getEscapedKey(valueRef.current) === key) {
        return;
      }

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

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      // Disable filtering right after the dropdown is opened
      if (isOpen) {
        setIsFiltering(false);
      }
      onOpenChange?.(isOpen);
    },
    [onOpenChange]
  );

  return (
    <ComboBox
      disabledKeys={disabledKeys}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      selectedKey={value && getEscapedKey(value)}
      defaultSelectedKey={props.defaultValue && getEscapedKey(props.defaultValue)}
      onSelectionChange={handleChange}
      items={items}
      onOpenChange={handleOpenChange}
      hasSearch={isFiltering ? !!inputValue : false}
      hiddenOptions={hiddenOptions}
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
  );
}

const ControlWrapper = styled('div')`
  position: relative;
  width: max-content;
  min-width: 150px;
  max-width: 100%;
  cursor: pointer;
`;

const StyledInput = styled(Input)`
  max-width: inherit;
  min-width: inherit;
  &:not(:focus) {
    pointer-events: none;
  }
`;
const StyledGrowingInput = styled(GrowingInput)`
  max-width: inherit;
  min-width: inherit;
  &:not(:focus) {
    cursor: pointer;
  }
`;

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean}>`
  min-width: 100%;
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledOverlay = styled(Overlay)<{width?: string}>`
  /* Should be a flex container so that when maxHeight is set (to avoid page overflow),
  ListBoxWrap/GridListWrap will also shrink to fit */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: absolute;
  max-height: 32rem;
  min-width: 100%;
  overflow-y: auto;
  width: ${p => p.width ?? 'auto'};
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
