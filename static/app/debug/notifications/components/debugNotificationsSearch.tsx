import type {Key} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {Item} from '@react-stately/collections';
import {useComboBoxState} from '@react-stately/combobox';
import type {CollectionChildren} from '@react-types/shared';

import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import {useSearchTokenCombobox} from 'sentry/components/searchQueryBuilder/tokens/useSearchTokenCombobox';
import {notificationCategories} from 'sentry/debug/notifications/data';
import type {NotificationSource} from 'sentry/debug/notifications/types';
import {t} from 'sentry/locale';
import {
  filter,
  SearchInput,
  StorySearchContainer as SearchContainer,
  StyledOverlay,
} from 'sentry/stories/view/storySearch';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useNavigate} from 'sentry/utils/useNavigate';

export function DebugNotificationsSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchKeys = useMemo(() => {
    return [{match: '/', callback: () => inputRef.current?.focus()}];
  }, []);
  useHotkeys(searchKeys);
  const notificationSources = notificationCategories.flatMap(
    category => category.sources
  );
  return (
    <SearchComboBox
      label={t('Search notifications')}
      menuTrigger="focus"
      inputRef={inputRef}
      defaultItems={notificationSources}
    >
      {source => {
        const sourceLabel = `${source.category.label} > ${source.label}`;
        return (
          <Item
            key={source.value}
            textValue={sourceLabel}
            {...({label: sourceLabel, hideCheck: true} as any)}
          />
        );
      }}
    </SearchComboBox>
  );
}

interface SearchComboBoxProps<T extends NotificationSource>
  extends Omit<AriaComboBoxProps<T>, 'children'> {
  children: CollectionChildren<T>;
  defaultItems: T[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  description?: string | null;
  label?: string;
}

function SearchComboBox<T extends NotificationSource>(props: SearchComboBoxProps<T>) {
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

  const state = useComboBoxState({
    ...props,
    inputValue,
    onInputChange: setInputValue,
    defaultFilter: filter,
    shouldCloseOnBlur: false,
    allowsEmptyCollection: false,
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

  return (
    <SearchContainer>
      <label {...labelProps} className="sr-only">
        {props.label}
      </label>
      <SearchInput ref={inputRef} placeholder={props.label} {...inputProps} />
      {state.isOpen && (
        <StyledOverlay placement="bottom-start" ref={popoverRef}>
          <ListBox
            listState={state}
            hasSearch={!!state.inputValue}
            hiddenOptions={new Set([])}
            keyDownHandler={() => false}
            overlayIsOpen={state.isOpen}
            size="sm"
            {...listBoxProps}
          >
            {props.children}
          </ListBox>
        </StyledOverlay>
      )}
    </SearchContainer>
  );
}
