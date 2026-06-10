import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
import {Placeholder} from 'sentry/components/placeholder';
import {
  useSearchQueryBuilderLayout,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isAggregateField, parseFunction} from 'sentry/utils/discover/fields';
import {
  type AggregationKey,
  type FieldDefinition,
  FieldKind,
  FieldValueType,
  getFieldDefinition,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SchemaHintsDrawer} from 'sentry/views/explore/components/schemaHints/schemaHintsDrawer';
import {
  CONVERSATIONS_INCLUDES_KEYS,
  getSchemaHintsListOrder,
  onlyShowSchemaHintsKeys,
  removeHiddenSchemaHintsKeys,
  SchemaHintsSources,
  USER_IDENTIFIER_KEY,
} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_FILTER_KEY_SECTIONS} from 'sentry/views/explore/logs/constants';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';
import {SpanFields} from 'sentry/views/insights/types';

const SCHEMA_HINTS_DRAWER_WIDTH = '350px';

const PLACEHOLDER_WIDTHS = [
  '8%',
  '10%',
  '9%',
  '11%',
  '8%',
  '10%',
  '9%',
  '8%',
  '11%',
  '9%',
  '8%',
  '10%',
  '9%',
  '8%',
];

interface SchemaHintsListProps extends SchemaHintsPageParams {
  numberTags: TagCollection;
  stringTags: TagCollection;
  supportedAggregates: AggregationKey[];
  booleanTags?: TagCollection;
  isLoading?: boolean;
  /**
   * The width of all elements to the right of the search bar.
   * This is used to ensure that the search bar is the correct width when the drawer is open.
   */
  searchBarWidthOffset?: number;
  /**
   * The are of the product that the schema hints are being rendered in
   */
  source?: SchemaHintsSources;
}

export interface SchemaHintsPageParams {
  exploreQuery: string;
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
          tags[SpanFields.USER_EMAIL] ||
          tags[SpanFields.USER_USERNAME] ||
          tags[SpanFields.USER_ID]
        );
      }
      return tags[key];
    })
    .filter(tag => !!tag);
}

export function addFilterToQuery(
  filterQuery: MutableSearch,
  tag: Tag,
  fieldDefinition: FieldDefinition | null
) {
  if (tag.kind === FieldKind.FUNCTION) {
    const defaultFunctionParam = fieldDefinition?.parameters?.[0]?.defaultValue ?? '';
    filterQuery.addFilterValue(`${tag.key}(${defaultFunctionParam})`, '>0');
  } else if (CONVERSATIONS_INCLUDES_KEYS.has(tag.key)) {
    filterQuery.addContainsFilterValue(tag.key, '');
  } else {
    const isBoolean = fieldDefinition?.valueType === FieldValueType.BOOLEAN;
    filterQuery.addFilterValue(
      tag.key,
      isBoolean ? 'True' : tag.kind === FieldKind.MEASUREMENT ? '>0' : ''
    );
  }
}

export function parseTagKey(tagKey: string) {
  if (!isAggregateField(tagKey)) {
    return tagKey;
  }

  const aggregateKey = parseFunction(tagKey)?.name;
  return aggregateKey;
}

const FILTER_KEY_SECTIONS: Record<SchemaHintsSources, FilterKeySection[]> = {
  [SchemaHintsSources.EXPLORE]: SPANS_FILTER_KEY_SECTIONS,
  [SchemaHintsSources.LOGS]: LOGS_FILTER_KEY_SECTIONS,
  [SchemaHintsSources.CONVERSATIONS]: SPANS_FILTER_KEY_SECTIONS,
  // TODO: add error filter key sections when they are implemented
  [SchemaHintsSources.ERRORS]: [],
};

function getFilterKeySections(source: SchemaHintsSources) {
  return FILTER_KEY_SECTIONS[source];
}

export function formatHintName(hint: Tag) {
  if (hint.kind === FieldKind.FUNCTION) {
    return `${prettifyTagKey(hint.name)}(...)`;
  }
  return prettifyTagKey(hint.name);
}

function formatHintOperator(hint: Tag) {
  if (hint.kind === FieldKind.MEASUREMENT || hint.kind === FieldKind.FUNCTION) {
    return '>';
  }
  if (CONVERSATIONS_INCLUDES_KEYS.has(hint.key)) {
    return 'contains';
  }
  return 'is';
}

export function SchemaHintsList({
  supportedAggregates,
  booleanTags = {},
  numberTags,
  stringTags,
  isLoading,
  source = SchemaHintsSources.EXPLORE,
  searchBarWidthOffset,
}: SchemaHintsListProps) {
  const schemaHintsContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const organization = useOrganization();
  const {openDrawer, panelRef} = useDrawer();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const {dispatch, query} = useSearchQueryBuilderState();
  const {wrapperRef: searchBarWrapperRef} = useSearchQueryBuilderLayout();

  // Create a ref to hold the latest query for the drawer
  const queryRef = useRef(query);
  // Keep the ref up to date
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const functionTags = useMemo(() => {
    return getFunctionTags(supportedAggregates);
  }, [supportedAggregates]);

  // sort tags by the order they show up in the query builder
  const fullFilterTagsSorted = useMemo(() => {
    const filterTags = removeHiddenSchemaHintsKeys({
      ...functionTags,
      ...numberTags,
      ...booleanTags,
      ...stringTags,
    });

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
  }, [functionTags, numberTags, booleanTags, stringTags, source]);

  // In the bar, we can limit the schema hints shown to ONLY be ones in the list order set (eg. logs), but should still show the fullFilterTagsSorted in the drawer.
  const filterTagsSorted = useMemo(() => {
    return onlyShowSchemaHintsKeys(fullFilterTagsSorted, source);
  }, [fullFilterTagsSorted, source]);

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

      let lastVisibleIndex: number;

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
          const button = el?.firstElementChild;
          if (button instanceof HTMLElement) {
            button.textContent = getHintText(hint);
          }
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

  // ensures the search bar is the correct width when the drawer is open
  useEffect(() => {
    const adjustSearchBarWidth = () => {
      if (isDrawerOpen && searchBarWrapperRef.current && panelRef.current) {
        searchBarWrapperRef.current.style.width = `calc(100% - ${searchBarWidthOffset ? panelRef.current.clientWidth - searchBarWidthOffset : panelRef.current.clientWidth}px)`;
      }
    };

    adjustSearchBarWidth();

    const resizeObserver = new ResizeObserver(adjustSearchBarWidth);

    if (panelRef.current) {
      resizeObserver.observe(panelRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [isDrawerOpen, panelRef, searchBarWidthOffset, searchBarWrapperRef]);

  const onHintClick = (hint: Tag) => {
    if (hint.key === seeFullListTag.key) {
      if (!isDrawerOpen) {
        setIsDrawerOpen(true);
        openDrawer(
          () => (
            <SchemaHintsDrawer
              hints={fullFilterTagsSorted}
              exploreQuery={query}
              searchBarDispatch={dispatch}
              queryRef={queryRef}
            />
          ),
          {
            ariaLabel: t('Schema Hints Drawer'),
            drawerWidth: SCHEMA_HINTS_DRAWER_WIDTH,
            drawerKey: 'schema-hints-drawer',
            resizable: true,
            shouldCloseOnLocationChange: newLocation => {
              return (
                location.pathname !== newLocation.pathname ||
                // will close if anything but the filter query has changed
                !isEqual(
                  omit(location.query, [
                    'query',
                    'field',
                    LOGS_FIELDS_KEY,
                    LOGS_QUERY_KEY,
                  ]),
                  omit(newLocation.query, [
                    'query',
                    'field',
                    LOGS_FIELDS_KEY,
                    LOGS_QUERY_KEY,
                  ])
                )
              );
            },
            onOpen: () => {
              trackAnalytics('trace.explorer.schema_hints_drawer', {
                drawer_open: true,
                organization,
              });
              if (searchBarWrapperRef.current) {
                searchBarWrapperRef.current.style.minWidth = '20%';
              }
            },

            onClose: () => {
              setIsDrawerOpen(false);
              trackAnalytics('trace.explorer.schema_hints_drawer', {
                drawer_open: false,
                organization,
              });
              if (searchBarWrapperRef.current) {
                searchBarWrapperRef.current.style.width = '100%';
                searchBarWrapperRef.current.style.minWidth = '';
              }
            },
          }
        );
      }
      return;
    }

    const newSearchQuery = new MutableSearch(query);
    const fieldDefinition = getFieldDefinition(hint.key, {
      type: 'span',
      kind: hint.kind,
    });
    addFilterToQuery(newSearchQuery, hint, fieldDefinition);

    const newQuery = newSearchQuery.formatString();

    dispatch({
      type: 'UPDATE_QUERY',
      query: newQuery,
      focusOverride: {
        itemKey: `filter:${newSearchQuery
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
      source: 'list',
      organization,
    });
  };

  const getHintText = (hint: Tag) => {
    if (hint.key === seeFullListTag.key) {
      return hint.name;
    }

    return `${formatHintName(hint)} ${formatHintOperator(hint)} ...`;
  };

  const getHintElement = (hint: Tag) => {
    if (hint.key === seeFullListTag.key) {
      return hint.name;
    }

    return (
      <Flex gap="xs">
        <Text bold={false}>{formatHintName(hint)}</Text>
        <Text bold={false} variant="muted">
          {formatHintOperator(hint)}
        </Text>
        <Text bold={false} variant="accent">
          ...
        </Text>
      </Flex>
    );
  };

  if (isLoading) {
    return (
      <Flex aria-label={t('Schema Hints List')} gap="md" wrap="nowrap" overflow="hidden">
        {PLACEHOLDER_WIDTHS.map((width, index) => (
          <Container key={index} flexShrink={0} width={width}>
            <Placeholder width="100%" height="28px" />
          </Container>
        ))}
      </Flex>
    );
  }

  return (
    <Flex
      ref={schemaHintsContainerRef}
      aria-label={t('Schema Hints List')}
      gap="md"
      wrap="nowrap"
    >
      {visibleHints.map(hint => (
        <Container key={hint.key} flexShrink={0}>
          <Button size="xs" data-type={hint.key} onClick={() => onHintClick(hint)}>
            {getHintElement(hint)}
          </Button>
        </Container>
      ))}
    </Flex>
  );
}

export const SchemaHintsSection = styled('div')`
  display: grid;
  /* This is to ensure the hints section spans all the columns */
  grid-column: 1/-1;
  margin-bottom: ${p => p.theme.space.xl};
  margin-top: -4px;
  height: fit-content;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    margin-bottom: 0;
    margin-top: 0;
  }
`;
