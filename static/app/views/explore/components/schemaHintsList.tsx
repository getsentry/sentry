import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Button} from 'sentry/components/core/button';
import {getHasTag} from 'sentry/components/events/searchBar';
import useDrawer from 'sentry/components/globalDrawer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
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
} from 'sentry/views/explore/components/schemaHintsUtils/schemaHintsListOrder';
import {LOGS_FILTER_KEY_SECTIONS} from 'sentry/views/explore/logs/constants';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

export const SCHEMA_HINTS_DRAWER_WIDTH = '350px';

interface SchemaHintsListProps extends SchemaHintsPageParams {
  numberTags: TagCollection;
  stringTags: TagCollection;
  supportedAggregates: AggregationKey[];
  filterKeySections?: FilterKeySection[];
  isLoading?: boolean;
  source?: SchemaHintsSources;
}

export interface SchemaHintsPageParams {
  exploreQuery: string;
  setExploreQuery: (query: string) => void;
}

const seeFullListTag: Tag = {
  key: 'seeFullList',
  name: t('See full list'),
  kind: undefined,
};

const hideListTag: Tag = {
  key: 'hideList',
  name: t('Hide list'),
  kind: undefined,
};

function getTagsFromKeys(keys: string[], tags: TagCollection): Tag[] {
  return keys.map(key => tags[key]).filter(tag => !!tag);
}

export function addFilterToQuery(
  filterQuery: MutableSearch,
  tag: Tag,
  isBoolean: boolean
) {
  filterQuery.addFilterValue(
    isBoolean || tag.kind === FieldKind.MEASUREMENT ? tag.key : `!${tag.key}`,
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
  exploreQuery,
  setExploreQuery,
  source = SchemaHintsSources.EXPLORE,
}: SchemaHintsListProps) {
  const schemaHintsContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen, closeDrawer} = useDrawer();

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

  useEffect(() => {
    // debounce calculation to prevent 'flickering' when resizing
    const calculateVisibleHints = debounce(() => {
      if (!schemaHintsContainerRef.current) {
        return;
      }

      const container = schemaHintsContainerRef.current;

      // Create a temporary div to measure items without rendering them
      const measureDiv = document.createElement('div');
      measureDiv.style.visibility = 'hidden';
      document.body.appendChild(measureDiv);

      // Clone the container styles
      const styles = window.getComputedStyle(container);
      measureDiv.style.display = styles.display;
      measureDiv.style.gap = styles.gap;
      measureDiv.style.width = styles.width;

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

      const measureDivRect = measureDiv.getBoundingClientRect();
      // Find the last item that fits within the container
      let lastVisibleIndex =
        items.findIndex(item => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.right > measureDivRect.right - (seeFullListTagRect?.width ?? 0);
        }) - 1;

      // If all items fit, show them all
      if (lastVisibleIndex < 0) {
        lastVisibleIndex = items.length;
      }

      setVisibleHints([
        ...filterTagsSorted.slice(0, lastVisibleIndex),
        isDrawerOpen ? hideListTag : seeFullListTag,
      ]);

      // Remove the temporary div
      document.body.removeChild(measureDiv);
    }, 30);

    // initial calculation
    calculateVisibleHints();

    const resizeObserver = new ResizeObserver(calculateVisibleHints);
    if (schemaHintsContainerRef.current) {
      resizeObserver.observe(schemaHintsContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [filterTagsSorted, isDrawerOpen]);

  const onHintClick = useCallback(
    (hint: Tag) => {
      if (hint.key === seeFullListTag.key) {
        if (!isDrawerOpen) {
          openDrawer(
            () => (
              <SchemaHintsDrawer
                hints={filterTagsSorted}
                exploreQuery={exploreQuery}
                setExploreQuery={setExploreQuery}
              />
            ),
            {
              ariaLabel: t('Schema Hints Drawer'),
              drawerWidth: SCHEMA_HINTS_DRAWER_WIDTH,
              transitionProps: {
                key: 'schema-hints-drawer',
                type: 'tween',
                duration: 0.7,
                ease: 'easeOut',
              },
              shouldCloseOnLocationChange: newLocation => {
                return (
                  location.pathname !== newLocation.pathname ||
                  // will close if anything but the filter query has changed
                  !isEqual(
                    omit(location.query, ['query']),
                    omit(newLocation.query, ['query'])
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

      if (hint.key === hideListTag.key) {
        if (isDrawerOpen) {
          closeDrawer();
        }
        return;
      }

      const newSearchQuery = new MutableSearch(exploreQuery);
      const isBoolean =
        getFieldDefinition(hint.key, 'span', hint.kind)?.valueType ===
        FieldValueType.BOOLEAN;
      addFilterToQuery(newSearchQuery, hint, isBoolean);
      setExploreQuery(newSearchQuery.formatString());
      trackAnalytics('trace.explorer.schema_hints_click', {
        hint_key: hint.key,
        source: 'list',
        organization,
      });
    },
    [
      exploreQuery,
      setExploreQuery,
      isDrawerOpen,
      organization,
      openDrawer,
      filterTagsSorted,
      location.pathname,
      location.query,
      closeDrawer,
    ]
  );

  const getHintText = (hint: Tag) => {
    if (hint.key === seeFullListTag.key || hint.key === hideListTag.key) {
      return hint.name;
    }

    return `${prettifyTagKey(hint.name)} ${hint.kind === FieldKind.MEASUREMENT ? '>' : 'is'} ...`;
  };

  const getHintElement = (hint: Tag) => {
    if (hint.key === seeFullListTag.key || hint.key === hideListTag.key) {
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
  overflow: hidden;

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
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: 4px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
  display: flex;
  padding: ${space(0.5)} ${space(1)};
  align-content: center;
  min-height: 0;
  height: 24px;
  flex-wrap: wrap;

  /* Ensures that filters do not grow outside of the container */
  min-width: fit-content;

  &[aria-selected='true'] {
    background-color: ${p => p.theme.gray100};
  }
`;

export const SchemaHintsSection = styled('div')<{withSchemaHintsDrawer: boolean}>`
  display: grid;
  /* This is to ensure the hints section spans all the columns */
  grid-column: 1/-1;
  margin-bottom: ${space(2)};
  margin-top: -4px;
  height: fit-content;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr ${p =>
        p.withSchemaHintsDrawer ? SCHEMA_HINTS_DRAWER_WIDTH : '0px'};
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
