import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {getEscapedKey} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/useQueryBuilderGridItem';
import {replaceTokenWithPadding} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import {
  getKeyLabel,
  useShiftFocusToChild,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  type ParseResultToken,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

type SearchQueryBuilderInputProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
};

type SearchQueryBuilderInputInternalProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  tabIndex: number;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
};

const PROMOTED_SECTIONS = [FieldKind.FIELD];

function getWordAtCursorPosition(value: string, cursorPosition: number) {
  const words = value.split(' ');

  let characterCount = 0;
  for (const word of words) {
    characterCount += word.length + 1;
    if (characterCount >= cursorPosition) {
      return word;
    }
  }

  return value;
}

/**
 * Replaces the focused word (at cursorPosition) with the selected filter key.
 *
 * Example:
 * replaceFocusedWordWithFilter('before brow after', 9, 'browser.name') => 'before browser.name: after'
 */
function replaceFocusedWordWithFilter(
  value: string,
  cursorPosition: number,
  key: string
) {
  const words = value.split(' ');

  let characterCount = 0;
  for (const word of words) {
    characterCount += word.length + 1;
    if (characterCount >= cursorPosition) {
      return (
        value.slice(0, characterCount - word.length - 1).trim() +
        ` ${key}: ` +
        value.slice(characterCount).trim()
      ).trim();
    }
  }

  return value;
}

/**
 * Takes a string that contains a filter value `<key>:` and replaces with any aliases that may exist.
 *
 * Example:
 * replaceAliasedFilterKeys('foo issue: bar', {'status': 'is'}) => 'foo is: bar'
 */
function replaceAliasedFilterKeys(value: string, aliasToKeyMap: Record<string, string>) {
  const key = value.match(/(\w+):/);
  const matchedKey = key?.[1];
  if (matchedKey && aliasToKeyMap[matchedKey]) {
    const actualKey = aliasToKeyMap[matchedKey];
    const replacedValue = value.replace(`${matchedKey}:`, `${actualKey}:`);
    return replacedValue;
  }

  return value;
}

function getItemsBySection(allKeys: Tag[]) {
  const itemsBySection = allKeys.reduce<{
    [section: string]: Array<SelectOptionWithKey<string>>;
  }>((acc, tag) => {
    const fieldDefinition = getFieldDefinition(tag.key);

    const section = tag.kind ?? fieldDefinition?.kind ?? t('other');
    const item = {
      label: getKeyLabel(tag),
      key: getEscapedKey(tag.key),
      value: tag.key,
      textValue: tag.key,
      hideCheck: true,
      showDetailsInOverlay: true,
      details: fieldDefinition?.desc ? <KeyDescription tag={tag} /> : null,
    };

    if (acc[section]) {
      acc[section].push(item);
    } else {
      acc[section] = [item];
    }

    return acc;
  }, {});

  return [
    ...PROMOTED_SECTIONS.filter(section => section in itemsBySection).map(section => {
      return {
        title: section,
        children: itemsBySection[section],
      };
    }),
    ...Object.entries(itemsBySection)
      .filter(([section]) => !PROMOTED_SECTIONS.includes(section as FieldKind))
      .map(([section, children]) => {
        return {title: section, children};
      }),
  ];
}

function countPreviousItemsOfType({
  state,
  type,
}: {
  state: ListState<ParseResultToken>;
  type: Token;
}) {
  const itemKeys = [...state.collection.getKeys()];
  const currentIndex = itemKeys.indexOf(state.selectionManager.focusedKey);

  return itemKeys.slice(0, currentIndex).reduce<number>((count, next) => {
    if (next.toString().includes(type)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function calculateNextFocusForFilter(state: ListState<ParseResultToken>): FocusOverride {
  const numPreviousFilterItems = countPreviousItemsOfType({state, type: Token.FILTER});

  return {
    itemKey: `${Token.FILTER}:${numPreviousFilterItems}`,
    part: 'value',
  };
}

function calculateNextFocusForParen(item: Node<ParseResultToken>): FocusOverride {
  const [, tokenTypeIndexStr] = item.key.toString().split(':');

  const tokenTypeIndex = parseInt(tokenTypeIndexStr, 10);

  return {
    itemKey: `${Token.FREE_TEXT}:${tokenTypeIndex + 1}`,
  };
}

function KeyDescription({tag}: {tag: Tag}) {
  const fieldDefinition = getFieldDefinition(tag.key);

  if (!fieldDefinition || !fieldDefinition.desc) {
    return null;
  }

  return (
    <DescriptionWrapper>
      <div>{fieldDefinition.desc}</div>
      <Separator />
      <DescriptionList>
        {tag.alias ? (
          <Fragment>
            <Term>{t('Alias')}</Term>
            <Details>{tag.key}</Details>
          </Fragment>
        ) : null}
        {fieldDefinition.valueType ? (
          <Fragment>
            <Term>{t('Type')}</Term>
            <Details>{toTitleCase(fieldDefinition.valueType)}</Details>
          </Fragment>
        ) : null}
      </DescriptionList>
    </DescriptionWrapper>
  );
}

function SearchQueryBuilderInputInternal({
  item,
  token,
  tabIndex,
  state,
}: SearchQueryBuilderInputInternalProps) {
  const trimmedTokenValue = token.text.trim();
  const [inputValue, setInputValue] = useState(trimmedTokenValue);
  // TODO(malwilley): Use input ref to update cursor position on mount
  const [selectionIndex, setSelectionIndex] = useState(0);

  const resetInputValue = useCallback(() => {
    setInputValue(trimmedTokenValue);
    // TODO(malwilley): Reset cursor position using ref
  }, [trimmedTokenValue]);

  const filterValue = getWordAtCursorPosition(inputValue, selectionIndex);

  const {query, keys, dispatch, onSearch} = useSearchQueryBuilder();
  const aliasToKeyMap = useMemo(() => {
    return Object.fromEntries(Object.values(keys).map(key => [key.alias, key.key]));
  }, [keys]);
  const allKeys = useMemo(() => {
    return Object.values(keys).sort((a, b) =>
      getKeyLabel(a).localeCompare(getKeyLabel(b))
    );
  }, [keys]);
  const sections = useMemo(() => getItemsBySection(allKeys), [allKeys]);
  const items = useMemo(() => sections.flatMap(section => section.children), [sections]);

  // When token value changes, reset the input value
  const [prevValue, setPrevValue] = useState(inputValue);
  if (trimmedTokenValue !== prevValue) {
    setPrevValue(trimmedTokenValue);
    setInputValue(trimmedTokenValue);
  }

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // At start and pressing backspace, focus the previous full token
      if (
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 0 &&
        e.key === 'Backspace'
      ) {
        if (state.collection.getKeyBefore(item.key)) {
          state.selectionManager.setFocusedKey(state.collection.getKeyBefore(item.key));
        }
      }

      // At end and pressing delete, focus the next full token
      if (
        e.currentTarget.selectionStart === e.currentTarget.value.length &&
        e.currentTarget.selectionEnd === e.currentTarget.value.length &&
        e.key === 'Delete'
      ) {
        if (state.collection.getKeyAfter(item.key)) {
          state.selectionManager.setFocusedKey(state.collection.getKeyAfter(item.key));
        }
      }
    },
    [item.key, state.collection, state.selectionManager]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const text = e.clipboardData.getData('text/plain').replace('\n', '').trim();

      dispatch({
        type: 'PASTE_FREE_TEXT',
        token,
        text: replaceAliasedFilterKeys(text, aliasToKeyMap),
      });
      resetInputValue();
    },
    [aliasToKeyMap, dispatch, resetInputValue, token]
  );

  return (
    <SearchQueryBuilderCombobox
      items={items}
      onOptionSelected={value => {
        dispatch({
          type: 'UPDATE_FREE_TEXT',
          token,
          text: replaceFocusedWordWithFilter(inputValue, selectionIndex, value),
          focusOverride: calculateNextFocusForFilter(state),
        });
        resetInputValue();
      }}
      onCustomValueBlurred={value => {
        dispatch({type: 'UPDATE_FREE_TEXT', token, text: value});
        resetInputValue();
      }}
      onCustomValueCommitted={value => {
        dispatch({type: 'UPDATE_FREE_TEXT', token, text: value});
        resetInputValue();

        // Because the query does not change until a subsequent render,
        // we need to do the replacement that is does in the ruducer here
        onSearch?.(replaceTokenWithPadding(query, token, value));
      }}
      onExit={() => {
        if (inputValue !== token.value.trim()) {
          dispatch({type: 'UPDATE_FREE_TEXT', token, text: inputValue});
          resetInputValue();
        }
      }}
      inputValue={inputValue}
      filterValue={filterValue}
      token={token}
      inputLabel={t('Add a search term')}
      onInputChange={e => {
        if (e.target.value.includes('(') || e.target.value.includes(')')) {
          dispatch({
            type: 'UPDATE_FREE_TEXT',
            token,
            text: e.target.value,
            focusOverride: calculateNextFocusForParen(item),
          });
          resetInputValue();
          return;
        }

        if (e.target.value.includes(':')) {
          dispatch({
            type: 'UPDATE_FREE_TEXT',
            token,
            text: replaceAliasedFilterKeys(e.target.value, aliasToKeyMap),
            focusOverride: calculateNextFocusForFilter(state),
          });
          resetInputValue();
          return;
        }

        setInputValue(e.target.value);
        setSelectionIndex(e.target.selectionStart ?? 0);
      }}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      maxOptions={50}
      onPaste={onPaste}
    >
      {sections.map(({title, children}) => (
        <Section title={title} key={title}>
          {children.map(child => (
            <Item {...child} key={child.key}>
              {child.label}
            </Item>
          ))}
        </Section>
      ))}
    </SearchQueryBuilderCombobox>
  );
}

export function SearchQueryBuilderInput({
  token,
  state,
  item,
}: SearchQueryBuilderInputProps) {
  const ref = useRef<HTMLDivElement>(null);

  const {rowProps, gridCellProps} = useQueryBuilderGridItem(item, state, ref);
  const {shiftFocusProps} = useShiftFocusToChild(item, state);

  const isFocused = item.key === state.selectionManager.focusedKey;

  return (
    <Row {...mergeProps(rowProps, shiftFocusProps)} ref={ref} tabIndex={-1}>
      <GridCell {...gridCellProps} onClick={e => e.stopPropagation()}>
        <SearchQueryBuilderInputInternal
          item={item}
          state={state}
          token={token}
          tabIndex={isFocused ? 0 : -1}
        />
      </GridCell>
    </Row>
  );
}

const Row = styled('div')`
  display: flex;
  align-items: stretch;
  height: 24px;
`;

const GridCell = styled('div')`
  display: flex;
  align-items: stretch;
  height: 100%;

  input {
    padding: 0 ${space(0.5)};
    min-width: 9px;
  }
`;

const DescriptionWrapper = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  max-width: 220px;
`;

const Separator = styled('hr')`
  border-top: 1px solid ${p => p.theme.border};
  margin: ${space(1)} 0;
`;

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)};
  margin: 0;
`;

const Term = styled('dt')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const Details = styled('dd')``;
