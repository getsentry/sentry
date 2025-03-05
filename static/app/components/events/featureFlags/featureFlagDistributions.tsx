import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import useGroupFlags from 'sentry/components/events/featureFlags/useGroupFlags';
import {OrderBy} from 'sentry/components/events/featureFlags/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export default function FeatureFlagDistributions({
  group,
  search,
  orderBy,
}: {
  group: Group;
  orderBy: OrderBy;
  search: string;
}) {
  const environments = useEnvironmentsFromUrl();

  // Flags use the same endpoint and response format as tags, so we reuse TagDistribution, tag types, and "tag" in variable names.
  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupFlags({
    groupId: group.id,
    environment: environments,
  });

  const tagValues = useMemo(
    () =>
      data.reduce<Record<string, string>>((valueMap, tag) => {
        valueMap[tag.key] = tag.topValues.map(tv => tv.value).join(' ');
        return valueMap;
      }, {}),
    [data]
  );

  const getSortedTags = useCallback(
    (tags: GroupTag[]) => {
      switch (orderBy) {
        case OrderBy.NEWEST:
          return tags.sort((a, b) => {
            const timeA = new Date(a.topValues[0]!.lastSeen);
            const timeB = new Date(b.topValues[0]!.lastSeen);
            return timeB.getTime() - timeA.getTime();
          });
        case OrderBy.OLDEST:
          return tags.sort((a, b) => {
            const timeA = new Date(a.topValues[0]!.lastSeen);
            const timeB = new Date(b.topValues[0]!.lastSeen);
            return timeA.getTime() - timeB.getTime();
          });
        case OrderBy.Z_TO_A:
          return tags.sort((a, b) => b.key.localeCompare(a.key));
        default:
          return tags.sort((a, b) => a.key.localeCompare(b.key));
      }
    },
    [orderBy]
  );

  const displayTags = useMemo(() => {
    const sortedTags = getSortedTags(data);
    const searchedTags = sortedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        tagValues[tag.key]?.toLowerCase().includes(search.toLowerCase())
    );
    return searchedTags;
  }, [data, getSortedTags, search, tagValues]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('There was an error loading issue flags.')}
        onRetry={refetch}
      />
    );
  }

  return (
    <Wrapper>
      <Container>
        {displayTags.map((tag, tagIdx) => (
          <TagDistribution
            tag={tag}
            key={tagIdx}
            groupId={group.id}
            allowPrefetch={false}
          />
        ))}
      </Container>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;
