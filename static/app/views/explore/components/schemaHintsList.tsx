import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/core/button';
import {getHasTag} from 'sentry/components/events/searchBar';
import useDrawer from 'sentry/components/globalDrawer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {prettifyTagKey} from 'sentry/utils/discover/fields';
import {
  type AggregationKey,
  FieldKind,
  FieldValueType,
  getFieldDefinition,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SchemaHintsDrawer from 'sentry/views/explore/components/schemaHintsDrawer';
import {
  getSchemaHintsListOrder,
  removeHiddenKeys,
  SchemaHintsSources,
  USER_IDENTIFIER_KEY,
} from 'sentry/views/explore/components/schemaHintsUtils/schemaHintsListOrder';
import type {LogPageParamsUpdate} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {WritablePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {LOGS_FILTER_KEY_SECTIONS} from 'sentry/views/explore/logs/constants';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';
import {SpanIndexedField} from 'sentry/views/insights/types';

export const SCHEMA_HINTS_DRAWER_WIDTH = '350px';

interface SchemaHintsListProps extends SchemaHintsPageParams {
  numberTags: TagCollection;
  stringTags: TagCollection;
  supportedAggregates: AggregationKey[];
  isLoading?: boolean;
  source?: SchemaHintsSources;
}

export interface SchemaHintsPageParams {
  exploreQuery: string;
  setPageParams: (pageParams: WritablePageParams | LogPageParamsUpdate) => void;
  tableColumns: string[];
}

const seeFullListTag: Tag = {
  key: 'seeFullList',
  name: t('See full list'),
  kind: undefined,
};

function getTagsFromKeys(keys: string[], tags: TagCollection): Tag[] {
  return keys
    .map(key => {
      if (key === USER_IDENTIFIER_KEY) {
        return (
          tags[SpanIndexedField.USER_EMAIL] ||
          tags[SpanIndexedField.USER_USERNAME] ||
          tags[SpanIndexedField.USER_ID]
        );
      }
      return tags[key];
    })
    .filter(tag => !!tag);
}

export function addFilterToQuery(
  filterQuery: MutableSearch,
  tag: Tag,
  isBoolean: boolean
) {
  filterQuery.addFilterValue(
    tag.key,
    isBoolean ? 'True' : tag.kind === FieldKind.MEASUREMENT ? '>0' : ''
  );
}

const FILTER_KEY_SECTIONS: Record<SchemaHintsSources, FilterKeySection[]> = {
  [SchemaHintsSources.EXPLORE]: SPANS_FILTER_KEY_SECTIONS,
  [SchemaHintsSources.LOGS]: LOGS_FILTER_KEY_SECTIONS,
};

function getFilterKeySections(source: SchemaHintsSources) {
  return FILTER_KEY_SECTIONS[source];
}

function SchemaHintsList({
  supportedAggregates,
  numberTags,
  stringTags,
  isLoading,
  tableColumns,
  setPageParams,
  source = SchemaHintsSources.EXPLORE,
}: SchemaHintsListProps) {
  const schemaHintsContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen} = useDrawer();
  const {dispatch, query} = useSearchQueryBuilder();

  const functionTags = useMemo(() => {
    return getFunctionTags(supportedAggregates);
  }, [supportedAggregates]);

  // sort tags by the order they show up in the query builder
  const filterTagsSorted = useMemo(() => {
    const filterTags = removeHiddenKeys({
      ...functionTags,
      ...numberTags,
      ...stringTags,
    });
    filterTags.has = getHasTag({...stringTags});

    const schemaHintsListOrder = getSchemaHintsListOrder(source);
    const filterKeySections = getFilterKeySections(source);

    const schemaHintsPresetTags = getTagsFromKeys(schemaHintsListOrder, filterTags);

    const sectionKeys = filterKeySections
      .flatMap(section => section.children)
      .filter(key => !schemaHintsListOrder.includes(key));
    const sectionSortedTags = getTagsFromKeys(sectionKeys, filterTags);

    const otherKeys = Object.keys(filterTags).filter(
      key => !sectionKeys.includes(key) && !schemaHintsListOrder.includes(key)
    );
    const otherTags = getTagsFromKeys(otherKeys, filterTags);

    return [...schemaHintsPresetTags, ...sectionSortedTags, ...otherTags];
  }, [functionTags, numberTags, stringTags, source]);

  const [visibleHints, setVisibleHints] = useState([seeFullListTag]);
  const [tagListState, setTagListState] = useState<{
    containerRect: DOMRect;
    tagsRect: DOMRect[];
  } | null>(null);

  useEffect(() => {
    // debounce calculation to prevent 'flickering' when resizing
    const calculateVisibleHints = debounce(() => {
      if (!schemaHintsContainerRef.current) {
        return;
      }

      const container = schemaHintsContainerRef.current;
      const containerRect = container.getBoundingClientRect();

      let lastVisibleIndex;

      // don't use the tagListState if the full list hasn't loaded yet
      if (tagListState && !isLoading) {
        // last element of allTags is the see full list tag
        lastVisibleIndex =
          tagListState.tagsRect.findIndex(
            tagRect =>
              tagRect.right >
              // Note: containerRect.right does not correctly correspond to the right of the tags elements
              // which is why we are using the width of the container
              tagListState.containerRect.left +
                containerRect.width -
                (tagListState.tagsRect[tagListState.tagsRect.length - 1]?.width ?? 0)
          ) - 1;
      } else {
        // Create a temporary div to measure items without rendering them
        const measureDiv = document.createElement('div');
        measureDiv.style.visibility = 'hidden';
        document.body.appendChild(measureDiv);

        // Clone the container styles
        const styles = window.getComputedStyle(container);
        measureDiv.style.display = styles.display;
        measureDiv.style.gap = styles.gap;
        measureDiv.style.width = styles.width;

        const measureDivRect = measureDiv.getBoundingClientRect();
        // Render items in hidden div to measure
        [...filterTagsSorted, seeFullListTag].forEach(hint => {
          const el = container.children[0]?.cloneNode(true) as HTMLElement;
          el.innerHTML = getHintText(hint);
          measureDiv.appendChild(el);
        });

        // Get all rendered items
        const items = Array.from(measureDiv.children) as HTMLElement[];

        const seeFullListTagRect = Array.from(measureDiv.children)[
          Array.from(measureDiv.children).length - 1
        ]?.getBoundingClientRect();

        const itemsRects = items.map(item => item.getBoundingClientRect());
        // Find the last item that fits within the container
        lastVisibleIndex =
          itemsRects.findIndex(itemRect => {
            return (
              itemRect.right > measureDivRect.right - (seeFullListTagRect?.width ?? 0)
            );
          }) - 1;

        // save the states of the tag list and container to be used for future calculations
        // preventing renders of the hidden tag list on resize
        setTagListState({containerRect: measureDivRect, tagsRect: itemsRects});

        // Remove the temporary div
        document.body.removeChild(measureDiv);
      }

      // If all items fit, show them all
      if (lastVisibleIndex < 0) {
        lastVisibleIndex = filterTagsSorted.length;
      }

      setVisibleHints([...filterTagsSorted.slice(0, lastVisibleIndex), seeFullListTag]);
    }, 30);

    // initial calculation
    calculateVisibleHints();

    const resizeObserver = new ResizeObserver(calculateVisibleHints);
    if (schemaHintsContainerRef.current) {
      resizeObserver.observe(schemaHintsContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [filterTagsSorted, isDrawerOpen, isLoading, tagListState]);

  const onHintClick = useCallback(
    (hint: Tag) => {
      if (hint.key === seeFullListTag.key) {
        if (!isDrawerOpen) {
          openDrawer(
            () => (
              <SchemaHintsDrawer
                hints={filterTagsSorted}
                exploreQuery={query}
                tableColumns={tableColumns}
                setPageParams={setPageParams}
                searchBarDispatch={dispatch}
              />
            ),
            {
              ariaLabel: t('Schema Hints Drawer'),
              drawerWidth: SCHEMA_HINTS_DRAWER_WIDTH,
              drawerKey: 'schema-hints-drawer',
              resizable: true,
              drawerCss: css`
                height: calc(100% - ${space(4)});
              `,
              shouldCloseOnLocationChange: newLocation => {
                return (
                  location.pathname !== newLocation.pathname ||
                  // will close if anything but the filter query has changed
                  !isEqual(
                    omit(location.query, ['query', 'field', 'search', 'logsQuery']),
                    omit(newLocation.query, ['query', 'field', 'search', 'logsQuery'])
                  )
                );
              },
              onOpen: () => {
                trackAnalytics('trace.explorer.schema_hints_drawer', {
                  drawer_open: true,
                  organization,
                });
              },

              onClose: () => {
                trackAnalytics('trace.explorer.schema_hints_drawer', {
                  drawer_open: false,
                  organization,
                });
              },
            }
          );
        }
        return;
      }

      const newSearchQuery = new MutableSearch(query);
      const isBoolean =
        getFieldDefinition(hint.key, 'span', hint.kind)?.valueType ===
        FieldValueType.BOOLEAN;
      addFilterToQuery(newSearchQuery, hint, isBoolean);

      const newTableColumns = tableColumns.includes(hint.key)
        ? tableColumns
        : [...tableColumns, hint.key];
      const newQuery = newSearchQuery.formatString();

      setPageParams({
        fields: newTableColumns,
      });

      dispatch({
        type: 'UPDATE_QUERY',
        query: newQuery,
        focusOverride: {
          itemKey: `filter:${newSearchQuery.getFilterKeys().indexOf(hint.key)}`,
          part: 'value',
        },
      });

      trackAnalytics('trace.explorer.schema_hints_click', {
        hint_key: hint.key,
        source: 'list',
        organization,
      });
    },
    [
      query,
      tableColumns,
      setPageParams,
      dispatch,
      organization,
      isDrawerOpen,
      openDrawer,
      filterTagsSorted,
      location.pathname,
      location.query,
    ]
  );

  const getHintText = (hint: Tag) => {
    if (hint.key === seeFullListTag.key) {
      return hint.name;
    }

    return `${prettifyTagKey(hint.name)} ${hint.kind === FieldKind.MEASUREMENT ? '>' : 'is'} ...`;
  };

  const getHintElement = (hint: Tag) => {
    if (hint.key === seeFullListTag.key) {
      return hint.name;
    }

    return (
      <HintTextContainer>
        <HintName>{prettifyTagKey(hint.name)}</HintName>
        <HintOperator>{hint.kind === FieldKind.MEASUREMENT ? '>' : 'is'}</HintOperator>
        <HintValue>...</HintValue>
      </HintTextContainer>
    );
  };

  if (isLoading) {
    return (
      <SchemaHintsLoadingContainer>
        <LoadingIndicator mini />
      </SchemaHintsLoadingContainer>
    );
  }

  return (
    <SchemaHintsContainer
      ref={schemaHintsContainerRef}
      aria-label={t('Schema Hints List')}
    >
      {visibleHints.map(hint => (
        <SchemaHintOption
          size="xs"
          key={hint.key}
          data-type={hint.key}
          onClick={() => onHintClick(hint)}
        >
          {getHintElement(hint)}
        </SchemaHintOption>
      ))}
    </SchemaHintsContainer>
  );
}

export default SchemaHintsList;

const SchemaHintsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex-wrap: nowrap;

  > * {
    flex-shrink: 0;
  }
`;

const SchemaHintsLoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 24px;
`;

const SchemaHintOption = styled(Button)`
  /* Ensures that filters do not grow outside of the container */
  min-width: fit-content;
`;

export const SchemaHintsSection = styled('div')`
  display: grid;
  /* This is to ensure the hints section spans all the columns */
  grid-column: 1/-1;
  margin-bottom: ${space(2)};
  margin-top: -4px;
  height: fit-content;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr;
    margin-bottom: 0;
    margin-top: 0;
  }
`;

const HintTextContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
`;

const HintName = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
`;

const HintOperator = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
`;

const HintValue = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.purple400};
`;
