import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useGroupTagsReadable} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';

type Segment = {
  count: number;
  name: string;
  percentage: number;
  color?: string;
};

function SegmentedBar({segments}: {segments: Segment[]}) {
  return (
    <TagBarPlaceholder>
      {segments.map((segment, idx) => (
        <TagBarSegment
          key={idx}
          style={{
            left: `${segments.slice(0, idx).reduce((sum, s) => sum + s.percentage, 0)}%`,
            width: `${segment.percentage}%`,
          }}
          index={idx}
        />
      ))}
    </TagBarPlaceholder>
  );
}

function TagPreviewProgressBar({tag}: {tag: GroupTag}) {
  const segments: Segment[] = tag.topValues.map(value => ({
    name: value.name,
    percentage: percent(value.count, tag.totalValues),
    count: value.count,
  }));

  const topSegment = segments[0];
  if (!topSegment) {
    return null;
  }

  const topPercentage =
    topSegment.percentage < 1 ? '<1%' : `${topSegment.percentage.toFixed(0)}%`;

  return (
    <Fragment>
      <TagBarPlaceholder>
        <SegmentedBar segments={segments} />
      </TagBarPlaceholder>
      <div>{topPercentage}</div>
      <TextOverflow>{topSegment?.name}</TextOverflow>
    </Fragment>
  );
}

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
  });
  const tagsToPreview = useMemo(() => {
    const priorityTags = ['browser.name', 'os.name', 'runtime.name', 'environment'];
    // Sort tags based on priority order defined in priorityTags array
    const sortedTags = tags
      ?.filter(tag => priorityTags.includes(tag.key))
      .sort((a, b) => priorityTags.indexOf(a.key) - priorityTags.indexOf(b.key));

    return sortedTags?.slice(0, 4) ?? null;
  }, [tags]);

  if (isPending) {
    return (
      <LoadingContainer style={{paddingTop: space(1)}}>
        <Placeholder width="320px" height="95px" />
      </LoadingContainer>
    );
  }

  if (isError || !tagsToPreview || searchQuery || tagsToPreview.length === 0) {
    return null;
  }

  return (
    <TagsPreview>
      {tagsToPreview.map(tag => (
        <TagPreviewProgressBar key={tag.key} tag={tag} />
      ))}
    </TagsPreview>
  );
}

const TagsPreview = styled('div')`
  width: 240px;
  display: grid;
  grid-template-columns: minmax(50px, 0.8fr) min-content auto;
  align-items: center;
  align-content: center;
  gap: 1px;
  column-gap: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const LoadingContainer = styled('div')`
  padding-top: ${space(1)};
  display: flex;
`;

const TagBarPlaceholder = styled('div')`
  position: relative;
  height: 8px;
  width: 100%;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px ${p => p.theme.translucentBorder};
  background: ${p => Color(p.theme.gray300).alpha(0.1).toString()};
  overflow: hidden;
`;

const TagBarSegment = styled('div')<{index: number}>`
  height: 100%;
  position: absolute;
  top: 0;
  min-width: ${space(0.25)};
  background: ${p => Color(CHART_PALETTE[4][p.index]).alpha(0.8).toString()};
  border-right: 1px solid ${p => p.theme.background};

  &:last-child {
    border-right: none;
  }
`;
