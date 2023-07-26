import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BaseGroup, GroupTombstoneHelper, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getTitle, isTombstone} from 'sentry/utils/events';
import withOrganization from 'sentry/utils/withOrganization';

import EventTitleTreeLabel from './eventTitleTreeLabel';
import GroupPreviewTooltip from './groupPreviewTooltip';

interface EventOrGroupTitleProps {
  data: Event | BaseGroup | GroupTombstoneHelper;
  organization: Organization;
  className?: string;
  /* is issue breakdown? */
  grouping?: boolean;
  query?: string;
  withStackTracePreview?: boolean;
}

function EventOrGroupTitle({
  organization,
  data,
  withStackTracePreview,
  grouping = false,
  className,
  query,
}: EventOrGroupTitleProps) {
  const {id, groupID} = data as Event;

  const {title, subtitle, treeLabel} = getTitle(data, organization?.features, grouping);
  const titleLabel = treeLabel ? (
    <EventTitleTreeLabel treeLabel={treeLabel} />
  ) : (
    title ?? ''
  );

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
      {subtitle && (
        <Fragment>
          <Spacer />
          <Subtitle title={subtitle}>{subtitle}</Subtitle>
          <br />
        </Fragment>
      )}
    </Wrapper>
  );
}

export default withOrganization(EventOrGroupTitle);

/**
 * &nbsp; is used instead of margin/padding to split title and subtitle
 * into 2 separate text nodes on the HTML AST. This allows the
 * title to be highlighted without spilling over to the subtitle.
 */
function Spacer() {
  return <span style={{display: 'inline-block', width: 10}}>&nbsp;</span>;
}

const Subtitle = styled('em')`
  ${p => p.theme.overflowEllipsis};
  display: inline-block;
  color: ${p => p.theme.gray300};
  font-style: normal;
  height: 100%;
`;

const Wrapper = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  display: inline-grid;
  grid-template-columns: auto max-content 1fr max-content;
  align-items: baseline;
`;
