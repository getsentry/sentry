import {Fragment, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import type {TreeProps} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';

import error from 'sentry-images/spot/computer-missing.svg';

import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {Button} from 'sentry/components/core/button';
import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

type CommandPaletteSection = {
  actions: CommandPaletteActionWithKey[];
  label: string;
  'aria-label'?: string;
};

interface CommandPaletteListProps extends TreeProps<CommandPaletteSection> {
  clearSelection: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onActionKey: (selectionKey: React.Key | null | undefined) => void;
  query: string;
  selectedAction: CommandPaletteActionWithKey | null;
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

  const delegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: treeState.collection,
        disabledKeys: treeState.selectionManager.disabledKeys,
        ref: inputRef,
      }),
    [treeState.collection, treeState.selectionManager.disabledKeys, inputRef]
  );

  // This helps handle keyboard events on the input
  const {collectionProps} = useSelectableCollection({
    selectionManager: treeState.selectionManager,
    keyboardDelegate: delegate,
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
      return selectedAction.display.label;
    }
    return t('Type for actions…');
  }, [selectedAction]);

  return (
    <Fragment>
      <Flex direction="column" align="start" gap="md" borderBottom="muted">
        <Flex
          position="relative"
          direction="row"
          align="center"
          gap="xs"
          padding="0 md"
          width="100%"
        >
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
        </Flex>
      </Flex>
      {treeState.collection.size === 0 ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          gap="lg"
          padding="xl lg"
          height="400px"
        >
          <Image src={error} alt="No results" width="400px" />
          <Stack align="center" gap="md">
            <Text size="md" align="center">
              {t("Whoops… we couldn't find any results matching your search.")}
            </Text>
            <Text size="md" align="center">
              {t('Try rephrasing your query maybe?')}
            </Text>
          </Stack>
        </Flex>
      ) : null}
      <ResultsList
        direction="column"
        width="100%"
        maxHeight="min(calc(100vh - 128px - 4rem), 400px)"
        overflow="auto"
      >
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

const CommandInput = styled('input')`
  width: 100%;
  background: transparent;
  padding: ${p => p.theme.space.md};
  border: none;
  flex: 1;
  font-size: ${p => p.theme.font.size.lg};
  line-height: 2;

  &:focus {
    outline: none;
  }
`;

const ResultsList = styled(Flex)`
  ul,
  li {
    scroll-margin: ${p => p.theme.space['3xl']} 0;
  }
`;
