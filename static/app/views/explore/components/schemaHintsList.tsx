import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {getHasTag} from 'sentry/components/events/searchBar';
import {getFunctionTags} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {AggregationKey} from 'sentry/utils/fields';

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

  const filterTagsWithoutTagPrefix = useMemo(() => {
    return Object.keys(filterTags)
      .map(tag => filterTags[tag])
      .filter(tag => !tag?.key.startsWith('tags['));
  }, [filterTags]);

  // only show 8 tags for now until we have a better way to decide to display them
  const first8Tags = useMemo(() => {
    return filterTagsWithoutTagPrefix.slice(0, 8);
  }, [filterTagsWithoutTagPrefix]);

  const tagHintsText = useMemo(() => {
    return first8Tags.map(tag => `${tag?.key} is ...`);
  }, [first8Tags]);

  return (
    <SchemaHintsContainer>
      <HintsWrapper>
        {tagHintsText.map(text => (
          <SchemaHintOption key={text}>{text}</SchemaHintOption>
        ))}
      </HintsWrapper>
      <SchemaHintOption style={{flexShrink: 0}}>{t('See full list')}</SchemaHintOption>
    </SchemaHintsContainer>
  );
}

export default SchemaHintsList;

const SchemaHintsContainer = styled('div')`
  gap: ${space(1)};
  max-width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
`;

const HintsWrapper = styled('div')`
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
  min-width: min-content;

  &[aria-selected='true'] {
    background-color: ${p => p.theme.gray100};
  }
`;
