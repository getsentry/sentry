import styled from '@emotion/styled';

import type {Event} from 'sentry/types/event';
import type {BaseGroup, GroupTombstoneHelper} from 'sentry/types/group';
import {getTitle, isTombstone} from 'sentry/utils/events';

import GroupPreviewTooltip from './groupPreviewTooltip';

interface EventOrGroupTitleProps {
  data: Event | BaseGroup | GroupTombstoneHelper;
  className?: string;
  query?: string;
  withStackTracePreview?: boolean;
}

function EventOrGroupTitle({
  data,
  withStackTracePreview,
  className,
  query,
}: EventOrGroupTitleProps) {
  const {id, groupID} = data as Event;

  const {title} = getTitle(data);
  const titleLabel = title ?? '';

  return (
    <span className={className}>
      {!isTombstone(data) && withStackTracePreview ? (
        <GroupPreviewTooltip
          groupId={groupID ? groupID : id}
          issueCategory={data.issueCategory}
          groupingCurrentLevel={data.metadata?.current_level}
          query={query}
          issueType={'issueType' in data ? data.issueType : undefined}
          project={'project' in data ? data.project : undefined}
        >
          <Title data-issue-title-primary>{titleLabel}</Title>
        </GroupPreviewTooltip>
      ) : (
        titleLabel
      )}
    </span>
  );
}

export default EventOrGroupTitle;

const Title = styled('span')`
  position: relative;
  font-size: ${p => p.theme.fontSize.md};
`;
