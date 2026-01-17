import type {Key} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {Item} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren} from '@react-types/shared';

import {Badge} from 'sentry/components/core/badge';
import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Overlay} from 'sentry/components/overlay';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {useRegistry} from 'sentry/debug/notifications/hooks/useRegistry';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useNavigate} from 'sentry/utils/useNavigate';

export function DebugNotificationsSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchKeys = useMemo(() => {
    return [{match: '/', callback: () => inputRef.current?.focus()}];
  }, []);
  useHotkeys(searchKeys);
  const {data: registry = {}} = useRegistry();
  const sourceData = Object.values(registry)
    .flat()
    .map(registration => ({
      source: registration.source,
      category: registration.category,
    }));
  return (
    <SearchComboBox
      label={t('Search notifications')}
      menuTrigger="focus"
      inputRef={inputRef}
      defaultItems={sourceData}
    >
      {item => {
        const sourceLabel = `${item.category} > ${item.source}`;
        return (
          <Item
            key={item.source}
            textValue={sourceLabel}
            {...({label: sourceLabel, hideCheck: true} as any)}
          />
        );
      }}
    </SearchComboBox>
  );
}

interface SearchItem {
  category: string;
  source: string;
}

interface SearchComboBoxProps<T extends SearchItem>
  extends Omit<AriaComboBoxProps<T>, 'children'> {
  children: CollectionChildren<T>;
  defaultItems: T[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  description?: string | null;
  label?: string;
}

function SearchComboBox<T extends SearchItem>(props: SearchComboBoxProps<T>) {
  const [inputValue, setInputValue] = useState('');
  const {inputRef} = props;
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key) {
        navigate({query: {source: key}}, {replace: true});
      }
    },
    [navigate]
  );
  const filter = useCallback((text: string, input: string) => {
    const match = fzf(text, input.toLowerCase(), false);
    return match.score > 0;
  }, []);

  const state = useComboBoxState({
    ...props,
    inputValue,
    onInputChange: setInputValue,
    defaultFilter: filter,
    onSelectionChange: handleSelectionChange,
  });

  const {inputProps, listBoxProps, labelProps} = useSearchTokenCombobox<T>(
    {
      ...props,
      inputRef,
      listBoxRef,
      popoverRef,
    },
    state
  );

  const {className: _0, style: _1, size: nativeSize, ...nativeProps} = inputProps;
  return (
    <SearchContainer>
      <label {...labelProps} className="sr-only">
        {props.label}
      </label>
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input ref={inputRef} nativeSize={nativeSize} {...nativeProps} />
        <InputGroup.TrailingItems>
          <Badge variant="internal">/</Badge>
        </InputGroup.TrailingItems>
      </InputGroup>
      {state.isOpen && (
        <SearchOverlay placement="bottom-start" ref={popoverRef}>
          <ListBox
            listState={state}
            hasSearch={!!state.inputValue}
            hiddenOptions={new Set([])}
            overlayIsOpen={state.isOpen}
            size="sm"
            {...listBoxProps}
          >
            {props.children}
          </ListBox>
        </SearchOverlay>
      )}
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  position: relative;
  width: 320px;
  flex-grow: 1;
  padding: ${p => p.theme.space.md};
  padding-right: 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  input:is(input) {
    height: 32px;
    min-height: 32px;
  }
`;

const SearchOverlay = styled(Overlay)`
  position: fixed;
  top: 48px;
  width: 320px;
  max-height: calc(100dvh - 128px);
  overflow-y: auto;
`;
