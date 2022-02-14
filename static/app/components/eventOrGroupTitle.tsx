import {Fragment} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ProjectsStore from 'sentry/stores/projectsStore';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import {BaseGroup, GroupTombstone, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getTitle} from 'sentry/utils/events';
import withOrganization from 'sentry/utils/withOrganization';

import EventTitleTreeLabel from './eventTitleTreeLabel';
import {StackTracePreview} from './stacktracePreview';

type Props = Partial<DefaultProps> & {
  data: Event | BaseGroup | GroupTombstone;
  organization: Organization;
  className?: string;
  /* is issue breakdown? */
  grouping?: boolean;
  guideAnchorName?: string;
  hasGuideAnchor?: boolean;
  withStackTracePreview?: boolean;
};

type DefaultProps = {
  guideAnchorName: string;
};

function EventOrGroupTitle({
  guideAnchorName = 'issue_title',
  organization,
  data,
  withStackTracePreview,
  hasGuideAnchor,
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
      <GuideAnchor disabled={!hasGuideAnchor} target={guideAnchorName} position="bottom">
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
      </GuideAnchor>
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
    `
      display: inline-flex;
      overflow: hidden;
      > span:first-child {
        ${overflowEllipsis}
      }
    `}
`;

const Wrapper = styled('span')<{hasGroupingTreeUI: boolean}>`
  ${p =>
    p.hasGroupingTreeUI &&
    `
      display: inline-grid;
      grid-template-columns: auto max-content 1fr max-content;
      align-items: flex-end;
      line-height: 100%;

      ${Subtitle} {
        ${overflowEllipsis};
        display: inline-block;
      }
    `}
`;
