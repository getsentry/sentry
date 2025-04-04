import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Tag as Badge} from 'sentry/components/core/badge/tag';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {prettifyTagKey} from 'sentry/utils/discover/fields';
import {FieldKind, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import type {SchemaHintsPageParams} from 'sentry/views/explore/components/schemaHintsList';
import {addFilterToQuery} from 'sentry/views/explore/components/schemaHintsList';

type SchemaHintsDrawerProps = SchemaHintsPageParams & {
  hints: Tag[];
};

function SchemaHintsDrawer({
  hints,
  exploreQuery,
  setExploreQuery,
}: SchemaHintsDrawerProps) {
  const organization = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [currentQuery, setCurrentQuery] = useState(exploreQuery);

  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setCurrentQuery(newQuery);
      setExploreQuery(newQuery);
    },
    [setExploreQuery]
  );

  const selectedFilterKeys = useMemo(() => {
    const filterQuery = new MutableSearch(currentQuery);
    const allKeys = filterQuery.getFilterKeys();
    // When there is a filter with a negation, it stores the negation in the key.
    // To ensure all the keys are represented correctly in the drawer, we must
    // take these into account.
    const keysWithoutNegation = allKeys.map(key => key.replace('!', ''));
    return [...new Set(keysWithoutNegation)];
  }, [currentQuery]);

  const sortedSelectedHints = useMemo(() => {
    const sortedKeys = selectedFilterKeys.toSorted((a, b) => {
      return prettifyTagKey(a).localeCompare(prettifyTagKey(b));
    });
    return sortedKeys
      .map(key => hints.find(hint => hint.key === key))
      .filter(tag => !!tag);
  }, [hints, selectedFilterKeys]);

  const sortedHints = useMemo(() => {
    return [
      ...new Set([
        ...sortedSelectedHints,
        ...hints.toSorted((a, b) => {
          const aWithoutPrefix = prettifyTagKey(a.key).replace(/^_/, '');
          const bWithoutPrefix = prettifyTagKey(b.key).replace(/^_/, '');
          return aWithoutPrefix.localeCompare(bWithoutPrefix);
        }),
      ]),
    ];
  }, [hints, sortedSelectedHints]);

  const sortedAndFilteredHints = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedHints;
    }

    const searchFor = searchQuery.toLocaleLowerCase().trim();

    return sortedHints.filter(hint =>
      prettifyTagKey(hint.key).toLocaleLowerCase().trim().includes(searchFor)
    );
  }, [sortedHints, searchQuery]);

  const virtualizer = useVirtualizer({
    count: sortedAndFilteredHints.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const handleCheckboxChange = useCallback(
    (hint: Tag) => {
      const filterQuery = new MutableSearch(currentQuery);
      if (
        filterQuery
          .getFilterKeys()
          .some(key => key === hint.key || key === `!${hint.key}`)
      ) {
        // remove hint and/or negated hint if it exists
        filterQuery.removeFilter(hint.key);
        filterQuery.removeFilter(`!${hint.key}`);
      } else {
        const hintFieldDefinition = getFieldDefinition(hint.key, 'span', hint.kind);
        addFilterToQuery(
          filterQuery,
          hint,
          hintFieldDefinition?.valueType === FieldValueType.BOOLEAN
        );
      }
      handleQueryChange(filterQuery.formatString());
      trackAnalytics('trace.explorer.schema_hints_click', {
        hint_key: hint.key,
        source: 'drawer',
        organization,
      });
    },
    [currentQuery, handleQueryChange, organization]
  );

  const noAttributesMessage = (
    <NoAttributesMessage>
      <p>{t('No attributes found.')}</p>
    </NoAttributesMessage>
  );

  function HintItem({hint, index}: {hint: Tag; index: number}) {
    const hintFieldDefinition = getFieldDefinition(hint.key, 'span', hint.kind);

    const hintType =
      hintFieldDefinition?.valueType === FieldValueType.BOOLEAN ? (
        <Badge type="default">{t('boolean')}</Badge>
      ) : hint.kind === FieldKind.MEASUREMENT ? (
        <Badge type="success">{t('number')}</Badge>
      ) : (
        <Badge type="highlight">{t('string')}</Badge>
      );

    return (
      <div ref={virtualizer.measureElement} data-index={index}>
        <StyledMultipleCheckboxItem
          key={hint.key}
          value={hint.key}
          onChange={() => handleCheckboxChange(hint)}
        >
          <CheckboxLabelContainer>
            <Tooltip title={prettifyTagKey(hint.key)} showOnlyOnOverflow skipWrapper>
              <CheckboxLabel>{prettifyTagKey(hint.key)}</CheckboxLabel>
            </Tooltip>
            {hintType}
          </CheckboxLabelContainer>
        </StyledMultipleCheckboxItem>
      </div>
    );
  }

  return (
    <Fragment>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <HeaderContainer>
          <SchemaHintsHeader>{t('Filter Attributes')}</SchemaHintsHeader>
          <StyledInputGroup>
            <SearchInput
              size="sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label={t('Search attributes')}
            />
            <InputGroup.TrailingItems disablePointerEvents>
              <IconSearch size="md" />
            </InputGroup.TrailingItems>
          </StyledInputGroup>
        </HeaderContainer>
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
    </Fragment>
  );
}

export default SchemaHintsDrawer;

/**
 * Used to determine if the schema hints drawer should be rendered (only applicable on
 * large screens)
 */
export const useSchemaHintsOnLargeScreen = () => {
  const organization = useOrganization();
  const {isDrawerOpen: isSchemaHintsDrawerOpen} = useDrawer();
  const theme = useTheme();
  const isLargeScreen = useMedia(`(min-width: ${theme.breakpoints.xlarge})`);
  const isSchemaHintsDrawerOpenOnLargeScreen =
    isSchemaHintsDrawerOpen &&
    isLargeScreen &&
    organization.features.includes('traces-schema-hints');
  return isSchemaHintsDrawerOpenOnLargeScreen;
};

const SchemaHintsHeader = styled('h4')`
  margin: 0;
  flex-shrink: 0;
`;

const StyledDrawerBody = styled(DrawerBody)`
  height: 100%;
`;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(2)};
  gap: ${space(1.5)};
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
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: 0;
  ${p => p.theme.overflowEllipsis};
`;

const StyledMultipleCheckbox = styled(MultipleCheckbox)`
  display: block;
  height: 100%;
  overflow: auto;
`;

const StyledMultipleCheckboxItem = styled(MultipleCheckbox.Item)`
  width: 100%;
  padding: ${space(1)} ${space(0.5)};
  border-top: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:active {
    background-color: ${p => p.theme.gray100};
  }

  & > label {
    width: 100%;
    margin: 0;
    display: flex;
  }

  & > label > span {
    width: 100%;
    ${p => p.theme.overflowEllipsis};
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
  color: ${p => p.theme.subText};
`;

const StyledInputGroup = styled(InputGroup)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    max-width: 175px;
  }
`;
