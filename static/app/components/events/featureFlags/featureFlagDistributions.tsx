import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export default function FeatureFlagDistributions({group}: {group: Group}) {
  const environments = useEnvironmentsFromUrl();

  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupTags({
    groupId: group.id,
    environment: environments,
  });

  const [search] = useState(''); // TODO:

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
        tagValues[tag.key].includes(search)
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
          <TagDistribution tag={tag} key={tagIdx} groupId={group.id} />
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
