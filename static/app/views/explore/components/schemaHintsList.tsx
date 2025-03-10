import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/button';
import {getHasTag} from 'sentry/components/events/searchBar';
import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {prettifyTagKey} from 'sentry/utils/discover/fields';
import type {AggregationKey} from 'sentry/utils/fields';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

interface SchemaHintsListProps {
  numberTags: TagCollection;
  stringTags: TagCollection;
  supportedAggregates: AggregationKey[];
}

function SchemaHintsList({
  supportedAggregates,
  numberTags,
  stringTags,
}: SchemaHintsListProps) {
  const schemaHintsContainerRef = useRef<HTMLDivElement>(null);

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

  const [visibleHints, setVisibleHints] = useState(filterTagsSorted);

  useEffect(() => {
    // debounce calculation to prevent 'flickering' when resizing
    const calculateVisibleHints = debounce(() => {
      if (!schemaHintsContainerRef.current) {
        return;
      }

      const container = schemaHintsContainerRef.current;
      const containerRect = container.getBoundingClientRect();

      // First render all items
      setVisibleHints(filterTagsSorted);

      // this guarantees that the items are rendered before we try to measure them and do calculations
      requestAnimationFrame(() => {
        // Get all rendered items
        const items = Array.from(container.children) as HTMLElement[];

        // Find the last item that fits within the container
        let lastVisibleIndex = items.findIndex(item => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.right > containerRect.right;
        });

        // If all items fit, show them all
        if (lastVisibleIndex === -1) {
          lastVisibleIndex = items.length;
        }

        setVisibleHints(filterTagsSorted.slice(0, lastVisibleIndex));
      });
    }, 50);

    // initial calculation
    calculateVisibleHints();

    const resizeObserver = new ResizeObserver(calculateVisibleHints);
    if (schemaHintsContainerRef.current) {
      resizeObserver.observe(schemaHintsContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [filterTagsSorted]);

  return (
    <SchemaHintsContainer ref={schemaHintsContainerRef}>
      {visibleHints.map(hint => (
        <SchemaHintOption key={hint.key} data-type={hint.key}>
          {tct('[tag] is ...', {tag: prettifyTagKey(hint.key)})}
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
