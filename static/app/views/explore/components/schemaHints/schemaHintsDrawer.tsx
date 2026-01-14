import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Stack} from '@sentry/scraps/layout';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Tooltip} from 'sentry/components/core/tooltip';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import type {QueryBuilderActions} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseFunction} from 'sentry/utils/discover/fields';
import {FieldKind, getFieldDefinition, prettifyTagKey} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {SchemaHintsPageParams} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {
  addFilterToQuery,
  formatHintName,
  parseTagKey,
} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

type SchemaHintsDrawerProps = SchemaHintsPageParams & {
  hints: Tag[];
  queryRef: React.RefObject<string>;
  searchBarDispatch: React.Dispatch<QueryBuilderActions>;
};

function SchemaHintsDrawer({hints, searchBarDispatch, queryRef}: SchemaHintsDrawerProps) {
  const organization = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [currentQuery, setCurrentQuery] = useState(queryRef.current);

  const handleQueryChange = useCallback((newQuery: MutableSearch) => {
    setCurrentQuery(newQuery.formatString());
  }, []);

  const selectedFilterKeys = useMemo(() => {
    const filterQuery = new MutableSearch(currentQuery);
    const allKeys = filterQuery
      .getFilterKeys()
      .map(parseTagKey)
      .filter(Boolean) as string[];
    // When there is a filter with a negation, it stores the negation in the key.
    // To ensure all the keys are represented correctly in the drawer, we must
    // take these into account.
    const keysWithoutNegation = allKeys.map(key => key.replace('!', ''));
    return [...new Set(keysWithoutNegation)];
  }, [currentQuery]);

  const sortedAndFilteredHints = useMemo(() => {
    const sortedSelectedHints = selectedFilterKeys
      .toSorted((a, b) => {
        return prettifyTagKey(a).localeCompare(prettifyTagKey(b));
      })
      .map(key => hints.find(hint => hint.key === key))
      .filter(tag => !!tag);

    const sortedHints = [
      ...new Set([
        ...sortedSelectedHints,
        ...hints.toSorted((a, b) => {
          const aWithoutPrefix = prettifyTagKey(a.key).replace(/^_/, '');
          const bWithoutPrefix = prettifyTagKey(b.key).replace(/^_/, '');
          return aWithoutPrefix.localeCompare(bWithoutPrefix);
        }),
      ]),
    ];

    if (!searchQuery.trim()) {
      return sortedHints;
    }

    const searchFor = searchQuery.toLocaleLowerCase().trim();

    return sortedHints.filter(hint =>
      prettifyTagKey(hint.key).toLocaleLowerCase().trim().includes(searchFor)
    );
  }, [selectedFilterKeys, hints, searchQuery]);

  const virtualizer = useVirtualizer({
    count: sortedAndFilteredHints.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const handleCheckboxChange = useCallback(
    (hint: Tag) => {
      const filterQuery = new MutableSearch(queryRef.current);
      if (
        filterQuery
          .getFilterKeys()
          .map(parseTagKey)
          .some(key => key === hint.key || key === `!${hint.key}`)
      ) {
        const keyToRemove =
          hint.kind === FieldKind.FUNCTION
            ? (filterQuery
                .getFilterKeys()
                .find(key => parseFunction(key)?.name === hint.key) ?? '')
            : hint.key;
        // remove hint and/or negated hint if it exists
        filterQuery.removeFilter(keyToRemove);
        filterQuery.removeFilter(`!${keyToRemove}`);
      } else {
        const hintFieldDefinition = getFieldDefinition(hint.key, 'span', hint.kind);
        addFilterToQuery(filterQuery, hint, hintFieldDefinition);
      }

      handleQueryChange(filterQuery);
      searchBarDispatch({
        type: 'UPDATE_QUERY',
        query: filterQuery.formatString(),
        focusOverride: {
          itemKey: `filter:${filterQuery
            .getTokenKeys()
            .filter(key => key !== undefined)
            .map(parseTagKey)
            .lastIndexOf(hint.key)}`,
          part: 'value',
        },
        shouldCommitQuery: false,
      });
      trackAnalytics('trace.explorer.schema_hints_click', {
        hint_key: hint.key,
        source: 'drawer',
        organization,
      });
    },
    [handleQueryChange, organization, queryRef, searchBarDispatch]
  );

  const noAttributesMessage = (
    <NoAttributesMessage>
      <p>{t('No attributes found.')}</p>
    </NoAttributesMessage>
  );

  function HintItem({hint, index}: {hint: Tag; index: number}) {
    const hintFieldDefinition = getFieldDefinition(hint.key, 'span', hint.kind);

    return (
      <div ref={virtualizer.measureElement} data-index={index}>
        <StyledMultipleCheckboxItem
          key={hint.key}
          value={hint.key}
          onChange={() => handleCheckboxChange(hint)}
        >
          <CheckboxLabelContainer>
            <Tooltip title={formatHintName(hint)} showOnlyOnOverflow skipWrapper>
              <CheckboxLabel>{formatHintName(hint)}</CheckboxLabel>
            </Tooltip>
            <TypeBadge
              kind={hint.kind}
              valueType={hintFieldDefinition?.valueType ?? undefined}
            />
          </CheckboxLabelContainer>
        </StyledMultipleCheckboxItem>
      </div>
    );
  }

  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <Stack marginBottom="xl" gap="md">
          <SchemaHintsHeader>{t('Filter Attributes')}</SchemaHintsHeader>
          <StyledInputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch size="sm" />
            </InputGroup.LeadingItems>
            <SearchInput
              size="sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label={t('Search attributes')}
              placeholder={t('Search')}
              autoFocus
            />
          </StyledInputGroup>
        </Stack>
        <StyledMultipleCheckbox name={t('Filter keys')} value={selectedFilterKeys}>
          <ScrollContainer ref={scrollContainerRef}>
            <AllItemsContainer height={virtualizer.getTotalSize()}>
              {sortedAndFilteredHints.length === 0
                ? noAttributesMessage
                : virtualItems.map(item => (
                    <VirtualOffset offset={item.start} key={item.key}>
                      <HintItem
                        key={item.key}
                        hint={sortedAndFilteredHints[item.index]!}
                        index={item.index}
                      />
                    </VirtualOffset>
                  ))}
            </AllItemsContainer>
          </ScrollContainer>
        </StyledMultipleCheckbox>
      </StyledDrawerBody>
    </DrawerContainer>
  );
}

export default SchemaHintsDrawer;

const SchemaHintsHeader = styled('h4')`
  margin: 0;
  flex-shrink: 0;
`;

const StyledDrawerBody = styled(DrawerBody)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const CheckboxLabelContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: ${space(1)};
  cursor: pointer;
  padding-right: ${space(0.25)};
`;

const CheckboxLabel = styled('span')`
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledMultipleCheckbox = styled(MultipleCheckbox)`
  display: block;
  height: 100%;
  overflow: auto;
`;

const StyledMultipleCheckboxItem = styled(MultipleCheckbox.Item)`
  width: 100%;
  padding: ${space(1)} ${space(0.5)};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 100%;
  }

  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  & > label {
    width: 100%;
    margin: 0;
    display: flex;
  }

  & > label > span {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ScrollContainer = styled('div')`
  height: 100%;
  overflow: auto;
`;

const AllItemsContainer = styled('div')<{height: number}>`
  position: relative;
  width: 100%;
  height: ${p => p.height}px;
`;

const VirtualOffset = styled('div')<{offset: number}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transform: translateY(${p => p.offset}px);
`;

const SearchInput = styled(InputGroup.Input)`
  box-shadow: unset;
  color: inherit;
`;

const NoAttributesMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: ${space(4)};
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledInputGroup = styled(InputGroup)`
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    max-width: 175px;
  }
`;

const DrawerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;

  > header {
    flex-shrink: 0;
  }
`;
