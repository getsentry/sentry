import styled from '@emotion/styled';

import type {BaseGroup, GroupTombstoneHelper} from 'sentry/types/group';
import {getTitle, isTombstone} from 'sentry/utils/events';

import {GroupPreviewTooltip} from './groupPreviewTooltip';

interface GroupTitleProps {
  data: BaseGroup | GroupTombstoneHelper;
  className?: string;
  query?: string;
  withStackTracePreview?: boolean;
}

export function GroupTitle({
  data,
  withStackTracePreview,
  className,
  query,
}: GroupTitleProps) {
  const {title} = getTitle(data);
  const titleLabel = title ?? '';

  return (
    <span className={className}>
      {!isTombstone(data) && withStackTracePreview ? (
        <GroupPreviewTooltip
          groupId={data.id}
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

const Title = styled('span')`
  position: relative;
  font-size: ${p => p.theme.font.size.md};
`;
