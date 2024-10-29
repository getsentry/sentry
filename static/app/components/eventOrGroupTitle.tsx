import {Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {BaseGroup, GroupTombstoneHelper} from 'sentry/types/group';
import {getMessage, getTitle, isTombstone} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

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
  const organization = useOrganization({allowNull: true});
  const {id, groupID} = data as Event;

  const {title, subtitle} = getTitle(data);
  const titleLabel = title ?? '';

  const hasNewLayout =
    organization?.features.includes('issue-stream-table-layout') ?? false;

  const secondaryTitle = hasNewLayout ? getMessage(data) : subtitle;

  if (hasNewLayout) {
    return (
      <span className={className}>
        {!isTombstone(data) && withStackTracePreview ? (
          <GroupPreviewTooltip
            groupId={groupID ? groupID : id}
            issueCategory={data.issueCategory}
            groupingCurrentLevel={data.metadata?.current_level}
            query={query}
          >
            <Title data-issue-title-primary>{titleLabel}</Title>
          </GroupPreviewTooltip>
        ) : (
          titleLabel
        )}
        {secondaryTitle && (
          <Fragment>
            <Spacer width={space(1)} />
            <Message title={secondaryTitle}>{secondaryTitle}</Message>
          </Fragment>
        )}
      </span>
    );
  }

  return (
    <Wrapper className={className}>
      {!isTombstone(data) && withStackTracePreview ? (
        <GroupPreviewTooltip
          groupId={groupID ? groupID : id}
          issueCategory={data.issueCategory}
          groupingCurrentLevel={data.metadata?.current_level}
          query={query}
        >
          {titleLabel}
        </GroupPreviewTooltip>
      ) : (
        titleLabel
      )}
      {secondaryTitle && (
        <Fragment>
          <Spacer width="10px" />
          <Subtitle title={secondaryTitle}>{secondaryTitle}</Subtitle>
          <br />
        </Fragment>
      )}
    </Wrapper>
  );
}

export default EventOrGroupTitle;

/**
 * &nbsp; is used instead of margin/padding to split title and subtitle
 * into 2 separate text nodes on the HTML AST. This allows the
 * title to be highlighted without spilling over to the subtitle.
 */
function Spacer({width}: {width: string}) {
  return <span style={{display: 'inline-block', width}}>&nbsp;</span>;
}

const Subtitle = styled('em')`
  ${p => p.theme.overflowEllipsis};
  display: inline-block;
  color: ${p => p.theme.gray300};
  font-style: normal;
  height: 100%;
`;

const Message = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('span')`
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Wrapper = styled('span')`
  display: inline-grid;
  grid-template-columns: auto max-content 1fr max-content;

  align-items: baseline;
`;
