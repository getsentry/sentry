import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {getHasTag} from 'sentry/components/events/searchBar';
import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
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
  const functionTags = useMemo(() => {
    return getFunctionTags(supportedAggregates);
  }, [supportedAggregates]);

  const filterTags: TagCollection = useMemo(() => {
    const tags: TagCollection = {...functionTags, ...numberTags, ...stringTags};
    tags.has = getHasTag({...stringTags});
    return tags;
  }, [numberTags, stringTags, functionTags]);

  // sort tags by the order they show up in the query builder
  const filterTagsSorted = useMemo(() => {
    const sectionKeys = SPANS_FILTER_KEY_SECTIONS.flatMap(section => section.children);
    const sectionSortedTags = sectionKeys.map(key => filterTags[key]).filter(Boolean);
    const otherKeys = Object.keys(filterTags).filter(key => !sectionKeys.includes(key));
    const otherTags = otherKeys.map(key => filterTags[key]).filter(Boolean);
    return [...sectionSortedTags, ...otherTags];
  }, [filterTags]);

  // only show 8 tags for now until we have a better way to decide to display them
  // TODO: use resize observer to dynamically show more/less tags
  const first8Tags = useMemo(() => {
    return filterTagsSorted.slice(0, 8);
  }, [filterTagsSorted]);

  const tagHintsText = useMemo(() => {
    return first8Tags.map(tag => `${tag?.key} is ...`);
  }, [first8Tags]);

  return (
    <SchemaHintsContainer>
      {tagHintsText.map(text => (
        <SchemaHintOption key={text}>{text}</SchemaHintOption>
      ))}
    </SchemaHintsContainer>
  );
}

export default SchemaHintsList;

const SchemaHintsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  overflow: hidden;
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
