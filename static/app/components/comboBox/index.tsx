import {type Key, useMemo, useRef} from 'react';
import {usePopper} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useComboBox} from '@react-aria/combobox';
import {Item, Section} from '@react-stately/collections';
import {type ComboBoxStateOptions, useComboBoxState} from '@react-stately/combobox';

import {Button} from 'sentry/components/button';
import type {SelectOption, SelectOptionOrSection} from 'sentry/components/compactSelect';
import {ListBox} from 'sentry/components/compactSelect/listBox';
import {getEscapedKey, getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import Input from 'sentry/components/input';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconChevron} from 'sentry/icons';
import type {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../compactSelect/control';

interface ComboBoxProps<Value extends string>
  extends ComboBoxStateOptions<SelectOptionOrSection<Value>> {
  size?: FormSize;
  sizeLimit?: number;
}

/**
 * Flexible select component with a customizable trigger button
 */
function ComboBox<Value extends string>({size, ...props}: ComboBoxProps<Value>) {
  const theme = useTheme();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const popper = usePopper(inputRef.current, popoverRef.current, {
    placement: 'bottom-start',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 8],
        },
      },
    ],
  });

  const state = useComboBoxState({
    ...props,

    defaultFilter: (textValue, inputValue) => {
      return textValue.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase());
    },
  });

  const {
    buttonProps: comboBoxButtonProps,
    inputProps,
    listBoxProps,
  } = useComboBox({listBoxRef, buttonRef, inputRef, popoverRef}, state);

  const {buttonProps} = useButton(comboBoxButtonProps, buttonRef);

  return (
    // @ts-expect-error
    <SelectContext.Provider value={{overlayIsOpen: state.isOpen, search: ''}}>
      <ControlWrap>
        <FlexWrapper>
          <Input {...inputProps} ref={inputRef} size={size} />
          <Button
            {...buttonProps}
            size={size}
            ref={buttonRef}
            icon={<IconChevron direction={state.isOpen ? 'up' : 'down'} />}
            aria-label="Open options"
          />
        </FlexWrapper>

        {state.isOpen && (
          <PositionWrapper
            ref={popoverRef}
            style={popper.styles}
            zIndex={theme.zIndex?.tooltip}
          >
            <StyledOverlay>
              <ListBox
                {...listBoxProps}
                listState={state}
                keyDownHandler={() => true}
                size={size}
              />
            </StyledOverlay>
          </PositionWrapper>
        )}
      </ControlWrap>
    </SelectContext.Provider>
  );
}

const getOptionTextValue = (option: SelectOption<string>) => {
  if (option.textValue) {
    return option.textValue;
  }
  if (typeof option.label === 'string') {
    return option.label;
  }
  return '';
};

function WrappedComboBox<Value extends string>({
  options,
  ...props
}: Omit<ComboBoxProps<Value>, 'items' | 'defaultItems' | 'children'> & {
  options: SelectOptionOrSection<Value>[];
  defaultValue?: Value;
  onChange?: (value: SelectOption<Value>) => void;
  value?: Value;
}) {
  const items = useMemo(() => getItemsWithKeys(options), [options]);

  const handleChange = (key: Key) => {
    if (props.onSelectionChange) {
      props.onSelectionChange(key);
    }

    if (props.onChange) {
      const flatItems = items.flatMap(item =>
        'options' in item ? item.options : [item]
      );
      const selectedOption = flatItems.find(item => item.key === key);
      if (selectedOption) {
        props.onChange(selectedOption);
      }
    }
  };

  return (
    <ComboBox
      selectedKey={props.value && getEscapedKey(props.value)}
      defaultSelectedKey={props.defaultValue && getEscapedKey(props.defaultValue)}
      onSelectionChange={handleChange}
      defaultItems={items}
      {...props}
    >
      {items.map(item => {
        if ('options' in item) {
          return (
            <Section key={item.key} title={item.label}>
              {item.options.map(option => (
                <Item {...option} key={option.key} textValue={getOptionTextValue(option)}>
                  {item.label}
                </Item>
              ))}
            </Section>
          );
        }
        return (
          <Item {...item} key={item.key} textValue={getOptionTextValue(item)}>
            {item.label}
          </Item>
        );
      })}
    </ComboBox>
  );
}

const FlexWrapper = styled('div')`
  display: flex;
  align-items: center;
  border-radius: ${p => p.theme.borderRadius};

  & > input {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;

    /* Remove focus border from input */
    box-shadow: none;
    &:focus {
      box-shadow: none;
    }
  }

  & > button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
  }

  &:focus-within {
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;

    /* Add focus border to button */
    & > button {
      border-color: ${p => p.theme.focusBorder};
    }
    /* Add focus border to input */
    & > input {
      border-color: ${p => p.theme.focusBorder};
    }
  }
`;

const ControlWrap = styled('div')`
  position: relative;
  width: max-content;
`;

const StyledOverlay = styled(Overlay)`
  /* Should be a flex container so that when maxHeight is set (to avoid page overflow),
  ListBoxWrap/GridListWrap will also shrink to fit */
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export {WrappedComboBox as ComboBox};
