import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {TagPreviewDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useGroupTagsReadable} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export default function IssueTagsPreview({
  groupId,
  environments,
}: {
  environments: string[];
  groupId: string;
}) {
  const {
    isError,
    isPending,
    data: tags,
  } = useGroupTagsReadable({
    groupId,
    environment: environments,
    limit: 3,
  });
  const tagToPreview = useMemo(() => {
    const priorityTags = ['browser.name', 'os.name', 'runtime.name', 'environment'];
    // Sort tags based on priority order defined in priorityTags array
    const sortedTags = tags
      ?.filter(tag => priorityTags.includes(tag.key))
      .sort((a, b) => priorityTags.indexOf(a.key) - priorityTags.indexOf(b.key));

    return sortedTags?.[0] ?? null;
  }, [tags]);

  if (isPending) {
    return (
      <LoadingContainer style={{paddingTop: space(1)}}>
        <Placeholder width="155px" height="95px" />
        <SectionDivider />
      </LoadingContainer>
    );
  }

  if (isError || !tagToPreview) {
    return null;
  }

  return (
    <Fragment>
      <TagsPreview>
        <TagPreviewDistribution tag={tagToPreview} />
      </TagsPreview>
      <SectionDivider />
    </Fragment>
  );
}

const TagsPreview = styled('div')`
  padding-top: ${space(1)};
  max-width: 25%;
  width: 155px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
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
