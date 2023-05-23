import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BaseGroup, GroupTombstone, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getTitle} from 'sentry/utils/events';
import withOrganization from 'sentry/utils/withOrganization';

import EventTitleTreeLabel from './eventTitleTreeLabel';
import GroupPreviewTooltip from './groupPreviewTooltip';

type Props = {
  data: Event | BaseGroup | GroupTombstone;
  organization: Organization;
  className?: string;
  /* is issue breakdown? */
  grouping?: boolean;
  hasGuideAnchor?: boolean;
  withStackTracePreview?: boolean;
};

function EventOrGroupTitle({
  organization,
  data,
  withStackTracePreview,
  grouping = false,
  className,
}: Props) {
  const event = data as Event;
  const groupingCurrentLevel = (data as BaseGroup).metadata?.current_level;
  const groupingIssueCategory = (data as BaseGroup)?.issueCategory;

  const {id, eventID, groupID, projectID} = event;

  const {title, subtitle, treeLabel} = getTitle(event, organization?.features, grouping);

  return (
    <Wrapper className={className}>
      {withStackTracePreview ? (
        <GroupPreviewTooltip
          groupId={groupID ? groupID : id}
          issueCategory={groupingIssueCategory}
          groupingCurrentLevel={groupingCurrentLevel}
          eventId={eventID}
          projectId={projectID}
        >
          {treeLabel ? <EventTitleTreeLabel treeLabel={treeLabel} /> : title ?? ''}
        </GroupPreviewTooltip>
      ) : treeLabel ? (
        <EventTitleTreeLabel treeLabel={treeLabel} />
      ) : (
        title
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
