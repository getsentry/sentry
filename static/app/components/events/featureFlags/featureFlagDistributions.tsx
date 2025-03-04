import {useMemo} from 'react';
import styled from '@emotion/styled';

import useGroupFlags from 'sentry/components/events/featureFlags/useGroupFlags';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export default function FeatureFlagDistributions({
  group,
  search = '',
}: {
  group: Group;
  orderBy?: string;
  search?: string;
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
      data.reduce((valueMap, tag) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        valueMap[tag.key] = tag.topValues.map(tv => tv.value).join(' ');
        return valueMap;
      }, {}),
    [data]
  );

  const displayTags = useMemo(() => {
    const sortedTags = data.sort((a, b) => a.key.localeCompare(b.key));
    const searchedTags = sortedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        tagValues[tag.key].toLowerCase().includes(search.toLowerCase())
    );
    return searchedTags;
  }, [data, search, tagValues]);

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
