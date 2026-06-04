import styled from '@emotion/styled';

import type {BaseGroup} from 'sentry/types/group';
import {getTitle} from 'sentry/utils/events';

import {GroupPreviewTooltip} from './groupPreviewTooltip';

interface GroupTitleProps {
  data: BaseGroup;
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
      {withStackTracePreview ? (
        <GroupPreviewTooltip
          groupId={data.id}
          issueCategory={data.issueCategory}
          groupingCurrentLevel={data.metadata?.current_level}
          query={query}
          issueType={data.issueType}
          project={data.project}
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
