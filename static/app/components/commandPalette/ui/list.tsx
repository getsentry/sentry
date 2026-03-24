import {Fragment, useLayoutEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import type {TreeProps} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';

import errorIllustration from 'sentry-images/spot/computer-missing.svg';

import {Button} from '@sentry/scraps/button';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Image} from '@sentry/scraps/image';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {InnerWrap} from '@sentry/scraps/menuListItem';
import {Text} from '@sentry/scraps/text';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {IconArrow, IconSearch} from 'sentry/icons';
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
    return t('Search for commands…');
  }, [selectedAction]);

  return (
    <Fragment>
      <Flex direction="column" align="start" gap="md">
        <Flex position="relative" direction="row" align="center" gap="xs" width="100%">
          {p => {
            return (
              <InputGroup {...p}>
                <InputGroup.LeadingItems>
                  {selectedAction ? (
                    <Button
                      size="xs"
                      priority="transparent"
                      icon={<IconArrow direction="left" />}
                      onClick={() => {
                        clearSelection();
                        inputRef.current?.focus();
                      }}
                      aria-label={t('Return to all options')}
                    />
                  ) : (
                    <IconSearch size="sm" variant="muted" />
                  )}
                </InputGroup.LeadingItems>
                <InputGroup.Input
                  ref={inputRef}
                  value={query}
                  placeholder={placeholder}
                  autoFocus
                  {...inputProps}
                />
              </InputGroup>
            );
          }}
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
          <Image src={errorIllustration} alt={t('No results')} width="400px" />
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
          overlayIsOpen
          listState={treeState}
          size="md"
          selectionMode="none"
          keyDownHandler={() => true}
          aria-label={t('Search results')}
          onAction={key => onActionKey?.(key)}
          shouldUseVirtualFocus
        />
      </ResultsList>
    </Fragment>
  );
}

const ResultsList = styled(Flex)`
  ul,
  li {
    scroll-margin: ${p => p.theme.space['3xl']} 0;
  }

  li ${InnerWrap} {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  li[data-focused] > ${InnerWrap} {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;
