import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectsStore from 'sentry/stores/projectsStore';
import {BaseGroup, GroupTombstone, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getTitle} from 'sentry/utils/events';
import withOrganization from 'sentry/utils/withOrganization';

import EventTitleTreeLabel from './eventTitleTreeLabel';
import {StackTracePreview} from './stacktracePreview';

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

  const hasGroupingTreeUI = !!organization?.features.includes('grouping-tree-ui');
  const hasGroupingStacktraceUI = !!organization?.features.includes(
    'grouping-stacktrace-ui'
  );
  const {id, eventID, groupID, projectID} = event;

  const {title, subtitle, treeLabel} = getTitle(event, organization?.features, grouping);

  return (
    <Wrapper className={className} hasGroupingTreeUI={hasGroupingTreeUI}>
      {withStackTracePreview ? (
        <StyledStacktracePreview
          organization={organization}
          issueId={groupID ? groupID : id}
          groupingCurrentLevel={groupingCurrentLevel}
          // we need eventId and projectSlug only when hovering over Event, not Group
          // (different API call is made to get the stack trace then)
          eventId={eventID}
          projectSlug={eventID ? ProjectsStore.getById(projectID)?.slug : undefined}
          hasGroupingStacktraceUI={hasGroupingStacktraceUI}
        >
          {treeLabel ? <EventTitleTreeLabel treeLabel={treeLabel} /> : title}
        </StyledStacktracePreview>
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
const Spacer = () => <span style={{display: 'inline-block', width: 10}}>&nbsp;</span>;

const Subtitle = styled('em')`
  color: ${p => p.theme.gray300};
  font-style: normal;
`;

const StyledStacktracePreview = styled(StackTracePreview)<{
  hasGroupingStacktraceUI: boolean;
}>`
  ${p =>
    p.hasGroupingStacktraceUI &&
    css`
      display: inline-flex;
      overflow: hidden;
      height: 100%;
      > span:first-child {
        ${p.theme.overflowEllipsis}
      }
    `}
`;

const Wrapper = styled('span')<{hasGroupingTreeUI: boolean}>`
  ${p =>
    p.hasGroupingTreeUI &&
    css`
      display: inline-grid;
      grid-template-columns: auto max-content 1fr max-content;
      align-items: flex-end;
      line-height: 100%;

      ${Subtitle} {
        ${p.theme.overflowEllipsis};
        display: inline-block;
        height: 100%;
      }
    `}
`;
