import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {TagPreviewDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useGroupTagsReadable} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';

export default function IssueTagsPreview({
  groupId,
  environments,
}: {
  environments: string[];
  groupId: string;
}) {
  const searchQuery = useEventQuery({groupId});

  const {
    isError,
    isPending,
    data: tags,
  } = useGroupTagsReadable({
    groupId,
    environment: environments,
    limit: 3,
  });
  const tagsToPreview = useMemo(() => {
    const priorityTags = ['browser.name', 'os.name', 'runtime.name', 'environment'];
    // Sort tags based on priority order defined in priorityTags array
    const sortedTags = tags
      ?.filter(tag => priorityTags.includes(tag.key))
      .sort((a, b) => priorityTags.indexOf(a.key) - priorityTags.indexOf(b.key));

    return sortedTags?.slice(0, 2) ?? null;
  }, [tags]);

  if (isPending) {
    return (
      <LoadingContainer style={{paddingTop: space(1)}}>
        <Placeholder width="320px" height="95px" />
        <SectionDivider />
      </LoadingContainer>
    );
  }

  if (isError || !tagsToPreview || searchQuery) {
    return null;
  }

  return (
    <Fragment>
      <TagsPreview>
        {tagsToPreview.map(tag => (
          <TagPreviewDistribution key={tag.key} tag={tag} />
        ))}
      </TagsPreview>
      <SectionDivider />
    </Fragment>
  );
}

const TagsPreview = styled('div')`
  padding-top: ${space(1)};
  max-width: 40%;
  width: 320px;
  display: flex;
  flex-direction: row;
  gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }

  > *:nth-child(2) {
    @media (max-width: ${p => p.theme.breakpoints.xlarge}) {
      display: none;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.xlarge}) {
    max-width: 20%;
    width: 160px;
  }
`;

const LoadingContainer = styled('div')`
  padding-top: ${space(1)};
  display: flex;
`;

const SectionDivider = styled('div')`
  border-left: 1px solid ${p => p.theme.translucentBorder};
  display: flex;
  align-items: center;
  margin: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;
