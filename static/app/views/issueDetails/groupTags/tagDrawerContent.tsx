import {useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import TagDetailsLink from 'sentry/views/issueDetails/groupTags/tagDetailsLink';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useGroupTags} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export default function TagDrawerContent({
  group,
  organization,
  project,
  environments,
  search,
}: {
  environments: string[];
  group: Group;
  organization: Organization;
  project: Project;
  search: string;
}) {
  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupTags({
    groupId: group.id,
    environment: environments,
  });

  const {data: detailedProject, isPending: isHighlightsPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const highlightTagKeys = useMemo(() => {
    return detailedProject?.highlightTags ?? project?.highlightTags ?? [];
  }, [detailedProject, project]);

  const tagValues = useMemo(
    () =>
      data.reduce<Record<string, string>>((valueMap, tag) => {
        valueMap[tag.key] = tag.topValues.map(tv => tv.value).join(' ');
        return valueMap;
      }, {}),
    [data]
  );

  const displayTags = useMemo(() => {
    const highlightTags = data.filter(tag => highlightTagKeys.includes(tag.key));
    const orderedHighlightTags = highlightTags.sort(
      (a, b) => highlightTagKeys.indexOf(a.key) - highlightTagKeys.indexOf(b.key)
    );
    const remainingTags = data.filter(tag => !highlightTagKeys.includes(tag.key));
    const sortedTags = remainingTags.sort((a, b) => a.key.localeCompare(b.key));
    const orderedTags = [...orderedHighlightTags, ...sortedTags];
    const searchedTags = orderedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        tagValues[tag.key]?.includes(search)
    );
    return searchedTags;
  }, [data, search, tagValues, highlightTagKeys]);

  if (isPending || isHighlightsPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('There was an error loading issue tags.')}
        onRetry={refetch}
      />
    );
  }

  if (displayTags.length === 0) {
    return (
      <StyledEmptyStateWarning withIcon>
        {data.length === 0
          ? t('No tags were found for this issue')
          : t('No tags were found for this search')}
      </StyledEmptyStateWarning>
    );
  }

  return (
    <Container>
      {displayTags.map(tag => (
        <div key={tag.name}>
          <TagDetailsLink tag={tag} groupId={group.id}>
            <TagDistribution tag={tag} />
          </TagDetailsLink>
        </div>
      ))}
    </Container>
  );
}

export const Container = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

export const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  border: ${p => p.theme.tokens.border.primary} solid 1px;
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: ${p => p.theme.fontSize.lg};
`;
