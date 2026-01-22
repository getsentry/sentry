import {Text} from 'sentry/components/core/text';
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
  const titleLabel = getTitle(data).title ?? '';

  return (
    <span className={className}>
      {!isTombstone(data) && withStackTracePreview ? (
        <GroupPreviewTooltip
          query={query}
          issueCategory={data.issueCategory}
          groupId={'groupID' in data && data.groupID ? data.groupID : data.id}
          groupingCurrentLevel={data.metadata?.current_level}
          issueType={'issueType' in data ? data.issueType : undefined}
          project={'project' in data ? data.project : undefined}
        >
          <Text data-issue-title-primary size="md">
            {titleLabel}
          </Text>
        </GroupPreviewTooltip>
      ) : (
        titleLabel
      )}
    </span>
  );
}

export default EventOrGroupTitle;
