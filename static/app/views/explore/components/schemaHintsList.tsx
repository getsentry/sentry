import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/core/button';
import {getHasTag} from 'sentry/components/events/searchBar';
import useDrawer from 'sentry/components/globalDrawer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {prettifyTagKey} from 'sentry/utils/discover/fields';
import {type AggregationKey, FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import SchemaHintsDrawer from 'sentry/views/explore/components/schemaHintsDrawer';
import {
  PageParamsProvider,
  useExploreQuery,
  useSetExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

interface SchemaHintsListProps {
  numberTags: TagCollection;
  stringTags: TagCollection;
  supportedAggregates: AggregationKey[];
  isLoading?: boolean;
}

const seeFullListTag: Tag = {
  key: 'seeFullList',
  name: t('See full list'),
  kind: undefined,
};

function SchemaHintsList({
  supportedAggregates,
  numberTags,
  stringTags,
  isLoading,
}: SchemaHintsListProps) {
  const schemaHintsContainerRef = useRef<HTMLDivElement>(null);
  const exploreQuery = useExploreQuery();
  const setExploreQuery = useSetExploreQuery();

  const {openDrawer, isDrawerOpen} = useDrawer();

  const functionTags = useMemo(() => {
    return getFunctionTags(supportedAggregates);
  }, [supportedAggregates]);

  // sort tags by the order they show up in the query builder
  const filterTagsSorted = useMemo(() => {
    const filterTags: TagCollection = {...functionTags, ...numberTags, ...stringTags};
    filterTags.has = getHasTag({...stringTags});

    const sectionKeys = SPANS_FILTER_KEY_SECTIONS.flatMap(section => section.children);
    const sectionSortedTags = sectionKeys
      .map(key => filterTags[key])
      .filter(tag => !!tag);
    const otherKeys = Object.keys(filterTags).filter(key => !sectionKeys.includes(key));
    const otherTags = otherKeys.map(key => filterTags[key]).filter(tag => !!tag);
    return [...sectionSortedTags, ...otherTags];
  }, [numberTags, stringTags, functionTags]);

  const [visibleHints, setVisibleHints] = useState([seeFullListTag]);

  useEffect(() => {
    // debounce calculation to prevent 'flickering' when resizing
    const calculateVisibleHints = debounce(() => {
      if (!schemaHintsContainerRef.current) {
        return;
      }

      const container = schemaHintsContainerRef.current;
      const containerRect = container.getBoundingClientRect();

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

      // Find the last item that fits within the container
      let lastVisibleIndex =
        items.findIndex(item => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.right > containerRect.right - (seeFullListTagRect?.width ?? 0);
        }) - 1;

      // If all items fit, show them all
      if (lastVisibleIndex < 0) {
        lastVisibleIndex = items.length;
      }

      setVisibleHints([...filterTagsSorted.slice(0, lastVisibleIndex), seeFullListTag]);

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
  }, [filterTagsSorted]);

  const onHintClick = useCallback(
    (hint: Tag) => {
      if (hint.key === seeFullListTag.key) {
        if (!isDrawerOpen) {
          openDrawer(
            () => (
              <PageParamsProvider>
                <SchemaHintsDrawer hints={filterTagsSorted} />
              </PageParamsProvider>
            ),
            {
              ariaLabel: t('Schema Hints Drawer'),
            }
          );
        }
        return;
      }

      const newSearchQuery = new MutableSearch(exploreQuery);
      newSearchQuery.addFilterValue(
        hint.key,
        hint.kind === FieldKind.MEASUREMENT ? '>0' : ''
      );
      setExploreQuery(newSearchQuery.formatString());
    },
    [exploreQuery, setExploreQuery, isDrawerOpen, openDrawer, filterTagsSorted]
  );

  const getHintText = (hint: Tag) => {
    if (hint.key === seeFullListTag.key) {
      return hint.name;
    }

    return `${prettifyTagKey(hint.name)} ${hint.kind === FieldKind.MEASUREMENT ? '>' : 'is'} ...`;
  };

  if (isLoading) {
    return (
      <SchemaHintsLoadingContainer>
        <LoadingIndicator mini />
      </SchemaHintsLoadingContainer>
    );
  }

  return (
    <SchemaHintsContainer ref={schemaHintsContainerRef}>
      {visibleHints.map(hint => (
        <SchemaHintOption
          key={hint.key}
          data-type={hint.key}
          onClick={() => onHintClick(hint)}
        >
          {getHintText(hint)}
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
