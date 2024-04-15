import {
  type MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useComboBox} from '@react-aria/combobox';
import {Item} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';

import {SelectContext} from 'sentry/components/compactSelect/control';
import {SelectFilterContext} from 'sentry/components/compactSelect/list';
import {ListBox} from 'sentry/components/compactSelect/listBox';
import type {SelectKey, SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {
  getDisabledOptions,
  getEscapedKey,
  getHiddenOptions,
  getItemsWithKeys,
} from 'sentry/components/compactSelect/utils';
import {GrowingInput} from 'sentry/components/growingInput';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/searchQueryBuilderContext';
import {focusIsWithinToken} from 'sentry/components/searchQueryBuilder/utils';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import type {SearchGroup} from 'sentry/components/smartSearchBar/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FieldKind, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import mergeRefs from 'sentry/utils/mergeRefs';
import {type QueryKey, useQuery} from 'sentry/utils/queryClient';
import useOverlay from 'sentry/utils/useOverlay';

type SearchQueryKeyBuilderProps = {placeholder: string; token: TokenResult<Token.FILTER>};

type SearchQueryValueBuilderProps = {
  token: TokenResult<Token.FILTER>;
};

type SearchQueryBuilderComboboxProps = {
  inputLabel: string;
  inputValue: string;
  items: SelectOptionWithKey<SelectKey>[];
  onChange: (key: string) => void;
  placeholder: string;
  setInputValue: (value: string) => void;
  token: TokenResult<Token.FILTER>;
};

function SearchQueryBuilderCombobox({
  items,
  inputValue,
  setInputValue,
  placeholder,
  onChange,
  token,
  inputLabel,
}: SearchQueryBuilderComboboxProps) {
  const theme = useTheme();
  const listBoxRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const {focus} = useSearchQueryBuilder();

  useEffect(() => {
    if (focusIsWithinToken(focus, token)) {
      inputRef.current?.focus();
    }
  }, [focus, token]);

  const {dispatch} = useSearchQueryBuilder();

  const hiddenOptions = useMemo(() => {
    return getHiddenOptions(items, inputValue, 10);
  }, [items, inputValue]);

  const disabledKeys = useMemo(
    () => [...getDisabledOptions(items), ...hiddenOptions].map(getEscapedKey),
    [hiddenOptions, items]
  );

  const children = useMemo(() => {
    return items.map(item => (
      <Item {...item} key={item.key}>
        {item.label}
      </Item>
    ));
  }, [items]);

  const handleChange = useCallback(
    (key: string | number) => {
      const selectedOption = items.find(item => item.key === key);
      if (selectedOption) {
        onChange(selectedOption.textValue ?? '');
      }
    },
    [items, onChange]
  );

  const state = useComboBoxState({
    children,
    items,
    disabledKeys,
    autoFocus: true,
    inputValue,
    onInputChange: setInputValue,
    onSelectionChange: handleChange,
    selectedKey: null,
    onFocus: () => {
      state.open();
    },
  });
  const {inputProps, listBoxProps} = useComboBox(
    {
      'aria-label': inputLabel,
      listBoxRef,
      inputRef,
      popoverRef,
      items,
      disabledKeys,
      allowsCustomValue: true,
      inputValue,
      onSelectionChange: handleChange,
      onInputChange: setInputValue,
      selectedKey: null,
      autoFocus: true,
      onFocus: () => {
        state.open();
      },
    },
    state
  );

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
  const handleInputClick: MouseEventHandler<HTMLInputElement> = useCallback(
    e => {
      inputProps.onClick?.(e);

      if (!state.isOpen) {
        state.open();
      }
    },
    [inputProps, state]
  );

  useEffect(() => {
    state.open();
  }, [state]);

  return (
    <SelectContext.Provider
      value={{
        search: inputValue,
        // Will be set by the inner ComboBox
        overlayIsOpen: state.isOpen,
        // Not used in ComboBox
        registerListState: () => {},
        saveSelectedOptions: () => {},
      }}
    >
      <SelectFilterContext.Provider value={hiddenOptions}>
        <Wrapper>
          <UnstyledInput
            {...inputProps}
            size="md"
            ref={mergeRefs([inputRef, triggerProps.ref])}
            type="text"
            placeholder={placeholder}
            onClick={handleInputClick}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            autoFocus
            onKeyDown={e => {
              inputProps.onKeyDown?.(e);

              switch (e.key) {
                case 'ArrowLeft':
                  dispatch({type: 'ARROW_LEFT'});
                  return;
                case 'ArrowRight':
                  dispatch({type: 'ARROW_RIGHT'});
                  return;
                case 'Enter':
                  if (!inputValue || state.selectionManager.focusedKey) {
                    return;
                  }
                  onChange(inputValue);
                  return;
                case 'Escape':
                  // TODO: Exit focus mode and complete token
                  return;
                default:
                  return;
              }
            }}
          />
          <StyledPositionWrapper
            {...overlayProps}
            zIndex={theme.zIndex?.tooltip}
            visible={state.isOpen}
          >
            <StyledOverlay ref={popoverRef}>
              {/* Listbox adds a separator if it is not the first item
            To avoid this, we wrap it into a div */}
              <div>
                <ListBox
                  {...listBoxProps}
                  ref={listBoxRef}
                  listState={state}
                  keyDownHandler={() => true}
                  size="md"
                  autoFocus="first"
                />
                <EmptyMessage>No items found</EmptyMessage>
              </div>
            </StyledOverlay>
          </StyledPositionWrapper>
        </Wrapper>
      </SelectFilterContext.Provider>
    </SelectContext.Provider>
  );
}

export function SearchQueryKeyBuilder({token, placeholder}: SearchQueryKeyBuilderProps) {
  const [inputValue, setInputValue] = useState('');

  const {tags, dispatch} = useSearchQueryBuilder();

  const allTags = useMemo(() => {
    return Object.values(tags);
  }, [tags]);

  const items = useMemo(() => {
    return getItemsWithKeys(
      allTags.map(tag => {
        const fieldDefinition = getFieldDefinition(tag.key);

        return {
          label: fieldDefinition?.kind === FieldKind.FIELD ? tag.name : tag.key,
          value: tag.key,
          textValue: tag.key,
          hideCheck: true,
        };
      })
    );
  }, [allTags]);

  return (
    <SearchQueryBuilderCombobox
      items={items}
      onChange={key => {
        dispatch({type: 'UPDATE_TOKEN_KEY', token: token.key, value: key});
      }}
      inputValue={inputValue}
      setInputValue={setInputValue}
      placeholder={placeholder}
      token={token}
      inputLabel={t('Token key')}
    />
  );
}

function isStringFilterValues(
  tagValues: string[] | SearchGroup[]
): tagValues is string[] {
  return typeof tagValues[0] === 'string';
}

function isSearchGroupFilterValues(
  tagValues: string[] | SearchGroup[]
): tagValues is SearchGroup[] {
  return typeof tagValues[0] !== 'string';
}

export function SearchQueryValueBuilder({token}: SearchQueryValueBuilderProps) {
  const [inputValue, setInputValue] = useState('');

  const {getTagValues, tags, dispatch} = useSearchQueryBuilder();

  // TODO: Display loading state
  const {data} = useQuery<string[]>({
    queryKey: ['search-query-builder', token.key, inputValue] as QueryKey,
    queryFn: (): Promise<string[]> => {
      const tag = tags[token.key.text];

      if (!tag) {
        return Promise.resolve([]);
      }

      const fieldDef = getFieldDefinition(tag.key);

      if (fieldDef?.valueType === FieldValueType.DURATION) {
        return Promise.resolve(['-1d', '-7d', '+14d']);
      }

      if (tag.predefined) {
        if (!tag.values) {
          return Promise.resolve([]);
        }

        if (isStringFilterValues(tag.values)) {
          return Promise.resolve(
            tag.values.filter(
              (value): value is string =>
                typeof value === 'string' &&
                value.toLowerCase().includes(inputValue.toLowerCase())
            )
          );
        }
        if (isSearchGroupFilterValues(tag.values)) {
          return Promise.resolve(
            tag.values
              .flatMap(group => group.children)
              .map(item => item.value ?? '')
              .filter(value => value?.toLowerCase().includes(inputValue.toLowerCase()))
          );
        }
      }

      return getTagValues(tag, inputValue);
    },
    keepPreviousData: true,
  });

  const items = useMemo(() => {
    if (!data) {
      return [];
    }

    return getItemsWithKeys(
      data.map(value => {
        return {
          label: value,
          value: value,
          textValue: value,
          hideCheck: true,
        };
      })
    );
  }, [data]);

  return (
    <SearchQueryBuilderCombobox
      items={items}
      onChange={value => {
        dispatch({type: 'UPDATE_TOKEN_VALUE', token: token.value, value});
      }}
      inputValue={inputValue}
      setInputValue={setInputValue}
      // TODO: Multiple values
      placeholder={token.value.text}
      token={token}
      inputLabel={t('Token value')}
    />
  );
}

const Wrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
`;

const UnstyledInput = styled(GrowingInput)`
  background: transparent;
  border: none;
  box-shadow: none;
  flex-grow: 1;
  padding: 0;
  height: auto;
  min-height: auto;
  resize: none;
  min-width: 20px;
  border-radius: 0;

  &:focus {
    outline: none;
    border: none;
    box-shadow: none;
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
