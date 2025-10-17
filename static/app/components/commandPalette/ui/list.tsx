import {Fragment, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import type {TreeProps} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';

import error from 'sentry-images/spot/command-palette-error.svg';

import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {Button} from 'sentry/components/core/button';
import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

type CommandPaletteSection = {
  actions: CommandPaletteAction[];
  key: string;
  label: string;
  'aria-label'?: string;
};

interface CommandPaletteListProps extends TreeProps<CommandPaletteSection> {
  clearSelection: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onActionKey: (selectionKey: React.Key | null | undefined) => void;
  query: string;
  selectedAction: CommandPaletteAction | null;
  setQuery: (query: string) => void;
}

export function CommandPaletteList({
  clearSelection,
  selectedAction,
  onActionKey,
  inputRef,
  query,
  setQuery,
  ...treeProps
}: CommandPaletteListProps) {
  const treeState = useTreeState(treeProps);

  const firstFocusableKey = useMemo(() => {
    const firstItem = treeState.collection.at(0);
    return firstItem?.type === 'section' ? [...firstItem.childNodes][0] : firstItem;
  }, [treeState.collection]);

  useLayoutEffect(() => {
    if (treeState.selectionManager.focusedKey !== null) {
      return;
    }

    if (firstFocusableKey) {
      treeState.selectionManager.setFocusedKey(firstFocusableKey.key);
    } else {
      treeState.selectionManager.setFocusedKey(treeState.collection.getFirstKey());
    }
  }, [treeState.collection, treeState.selectionManager, firstFocusableKey]);

  // This helps handle keyboard events on the input
  const {collectionProps} = useSelectableCollection({
    selectionManager: treeState.selectionManager,
    keyboardDelegate: new ListKeyboardDelegate({
      collection: treeState.collection,
      disabledKeys: treeState.selectionManager.disabledKeys,
      ref: inputRef,
    }),
    shouldFocusWrap: true,
    ref: inputRef,
  });

  const inputProps = mergeProps(collectionProps, {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      // We want to reset the focused key when the user types.
      // The useLayoutEffect above will ensure that we set it correctly when it becomes null
      treeState.selectionManager.setFocusedKey(null);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && query === '') {
        clearSelection();
        e.preventDefault();
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        onActionKey(treeState.selectionManager.focusedKey);
      }
    },
  });

  const placeholder = useMemo(() => {
    if (selectedAction) {
      return selectedAction.label;
    }
    return t('Type for actions…');
  }, [selectedAction]);

  return (
    <Fragment>
      <InputHeader>
        <SearchInputContainer>
          {selectedAction && (
            <Button
              borderless
              size="sm"
              icon={<IconArrow direction="left" />}
              onClick={() => {
                clearSelection();
                inputRef.current?.focus();
              }}
              aria-label={t('Return to all options')}
            />
          )}
          <CommandInput
            ref={inputRef}
            value={query}
            aria-label={t('Search commands')}
            placeholder={placeholder}
            autoFocus
            {...inputProps}
          />
        </SearchInputContainer>
      </InputHeader>
      {treeState.collection.size === 0 ? (
        <EmptyWrap>
          <img src={error} alt="No results" />
          <p>Whoops… we couldn't find any results matching your search.</p>
          <p>Try rephrasing your query maybe?</p>
        </EmptyWrap>
      ) : null}
      <ResultsList>
        <ListBox
          listState={treeState}
          keyDownHandler={() => true}
          overlayIsOpen
          size="md"
          aria-label="Search results"
          selectionMode="none"
          onAction={key => onActionKey?.(key)}
          shouldUseVirtualFocus
        />
      </ResultsList>
    </Fragment>
  );
}

const InputHeader = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: start;
  box-shadow: 0 1px 0 0 ${p => p.theme.translucentInnerBorder};
  z-index: 2;
`;

const SearchInputContainer = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.md};
  width: 100%;
`;

const CommandInput = styled('input')`
  width: 100%;
  background: transparent;
  padding: ${p => p.theme.space.md};
  border: none;
  flex: 1;
  font-size: ${p => p.theme.fontSize.lg};
  line-height: 2;

  &:focus {
    outline: none;
  }
`;

const ResultsList = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(calc(100vh - 128px - 4rem), 400px);
  overflow: auto;
  padding: 0;
  margin: 0;

  ul,
  li {
    scroll-margin: ${p => p.theme.space['3xl']} 0;
  }
`;

const EmptyWrap = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  text-align: center;
  padding: 24px 12px;
  height: 400px;

  img {
    width: 100%;
    max-width: 400px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
  }
`;
