import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {getFocusableTreeWalker} from '@react-aria/focus';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {getEscapedKey} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGridItem} from 'sentry/components/searchQueryBuilder/useQueryBuilderGridItem';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types';
import {toTitleCase} from 'sentry/utils';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

type SearchQueryBuilderInputProps = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES>;
};

type SearchQueryBuilderInputInternalProps = {
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

function getItemsBySection(allKeys: Tag[]) {
  const itemsBySection = allKeys.reduce<{
    [section: string]: Array<SelectOptionWithKey<string>>;
  }>((acc, tag) => {
    const fieldDefinition = getFieldDefinition(tag.key);

    const section = tag.kind ?? fieldDefinition?.kind ?? t('other');
    const item = {
      label: tag.key,
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
  token,
  tabIndex,
}: SearchQueryBuilderInputInternalProps) {
  const trimmedTokenValue = token.value.trim();
  const [inputValue, setInputValue] = useState(trimmedTokenValue);
  // TODO(malwilley): Use input ref to update cursor position on mount
  const [selectionIndex, setSelectionIndex] = useState(0);

  const resetInputValue = () => {
    setInputValue(trimmedTokenValue);
    // TODO(malwilley): Reset cursor position using ref
  };

  const filterValue = getWordAtCursorPosition(inputValue, selectionIndex);

  const {keys, dispatch} = useSearchQueryBuilder();

  const allKeys = useMemo(() => {
    return Object.values(keys).sort((a, b) => a.key.localeCompare(b.key));
  }, [keys]);
  const sections = useMemo(() => getItemsBySection(allKeys), [allKeys]);
  const items = useMemo(() => sections.flatMap(section => section.children), [sections]);

  // When token value changes, reset the input value
  const [prevValue, setPrevValue] = useState(inputValue);
  if (trimmedTokenValue !== prevValue) {
    setPrevValue(trimmedTokenValue);
    setInputValue(trimmedTokenValue);
  }

  return (
    <SearchQueryBuilderCombobox
      items={items}
      onOptionSelected={value => {
        dispatch({
          type: 'UPDATE_FREE_TEXT',
          token,
          text: replaceFocusedWordWithFilter(inputValue, selectionIndex, value),
        });
        resetInputValue();
      }}
      onCustomValueSelected={value => {
        dispatch({type: 'UPDATE_FREE_TEXT', token, text: value});
      }}
      onExit={() => {
        if (inputValue !== token.value.trim()) {
          dispatch({type: 'UPDATE_FREE_TEXT', token, text: inputValue});
        }
      }}
      inputValue={inputValue}
      filterValue={filterValue}
      token={token}
      inputLabel={t('Add a search term')}
      onInputChange={e => {
        if (e.target.value.includes(':')) {
          dispatch({type: 'UPDATE_FREE_TEXT', token, text: e.target.value});
          resetInputValue();
        } else {
          setInputValue(e.target.value);
          setSelectionIndex(e.target.selectionStart ?? 0);
        }
      }}
      tabIndex={tabIndex}
      maxOptions={100}
    >
      {sections.map(({title, children}) => (
        <Section title={title} key={title}>
          {children.map(item => (
            <Item {...item} key={item.key}>
              {item.label}
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

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement, Element>) => {
      // Ensure that the state is updated correctly
      state.selectionManager.setFocusedKey(item.key);

      // When this row gains focus, immediately shift focus to the input
      const walker = getFocusableTreeWalker(e.currentTarget);
      const nextNode = walker.nextNode();
      if (nextNode) {
        (nextNode as HTMLElement).focus();
      }
    },
    [item.key, state.selectionManager]
  );

  const isFocused = item.key === state.selectionManager.focusedKey;

  return (
    <Row {...mergeProps(rowProps, {onFocus})} ref={ref} tabIndex={-1}>
      <GridCell {...gridCellProps} onClick={e => e.stopPropagation()}>
        <SearchQueryBuilderInputInternal token={token} tabIndex={isFocused ? 0 : -1} />
      </GridCell>
    </Row>
  );
}

const Row = styled('div')`
  display: flex;
  align-items: stretch;
  height: 22px;
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
  gap: ${space(1.5)};
  margin: 0;
`;

const Term = styled('dt')`
  color: ${p => p.theme.subText};
  font-weight: normal;
`;

const Details = styled('dd')``;
