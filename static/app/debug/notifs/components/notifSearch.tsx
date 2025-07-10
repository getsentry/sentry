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
import {notificationCategories} from 'sentry/debug/notifs/data';
import type {NotificationSource} from 'sentry/debug/notifs/types';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useNavigate} from 'sentry/utils/useNavigate';

export function NotifSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const notifsSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => inputRef.current?.focus()}];
  }, []);
  useHotkeys(notifsSearchHotkeys);
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

function SearchInput(
  props: React.HTMLProps<HTMLInputElement> & React.RefAttributes<HTMLInputElement>
) {
  const {className: _0, style: _1, size: nativeSize, ...nativeProps} = props;

  return (
    <InputGroup style={{minHeight: 33, height: 33, width: 256}}>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch />
      </InputGroup.LeadingItems>
      <InputGroup.Input ref={props.ref} nativeSize={nativeSize} {...nativeProps} />
      <InputGroup.TrailingItems>
        <Badge type="internal">/</Badge>
      </InputGroup.TrailingItems>
    </InputGroup>
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

function filter(textValue: string, inputValue: string): boolean {
  const match = fzf(textValue, inputValue.toLowerCase(), false);
  return match.score > 0;
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
    <StorySearchContainer>
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
    </StorySearchContainer>
  );
}

const StorySearchContainer = styled('div')`
  position: relative;
  width: 320px;
  flex-grow: 1;
  z-index: calc(infinity);
  padding: ${space(1)};
  padding-right: 0;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const StyledOverlay = styled(Overlay)`
  position: fixed;
  top: 48px;
  left: 272px;
  width: 320px;
  max-height: calc(100dvh - 128px);
  overflow-y: auto;
`;
