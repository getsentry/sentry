import {Fragment} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import ProjectsStore from 'app/stores/projectsStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {BaseGroup, GroupTombstone, Organization} from 'app/types';
import {Event} from 'app/types/event';
import {getTitle} from 'app/utils/events';
import withOrganization from 'app/utils/withOrganization';

import EventTitleTreeLabel from './eventTitleTreeLabel';
import StacktracePreview from './stacktracePreview';

type Props = Partial<DefaultProps> & {
  data: Event | BaseGroup | GroupTombstone;
  organization: Organization;
  hasGuideAnchor?: boolean;
  withStackTracePreview?: boolean;
  guideAnchorName?: string;
  className?: string;
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
  className,
}: Props) {
  const event = data as Event;
  const groupingCurrentLevel = (data as BaseGroup).metadata?.current_level;

  const hasGroupingTreeUI = !!organization?.features.includes('grouping-tree-ui');
  const {id, eventID, groupID, projectID} = event;

  const {title, subtitle, treeLabel} = getTitle(event, organization?.features);

  return (
    <Wrapper className={className} hasGroupingTreeUI={hasGroupingTreeUI}>
      <GuideAnchor disabled={!hasGuideAnchor} target={guideAnchorName} position="bottom">
        <StyledStacktracePreview
          organization={organization}
          issueId={groupID ? groupID : id}
          groupingCurrentLevel={groupingCurrentLevel}
          // we need eventId and projectSlug only when hovering over Event, not Group
          // (different API call is made to get the stack trace then)
          eventId={eventID}
          projectSlug={eventID ? ProjectsStore.getById(projectID)?.slug : undefined}
          disablePreview={!withStackTracePreview}
          hasGroupingTreeUI={hasGroupingTreeUI}
        >
          {treeLabel ? <EventTitleTreeLabel treeLabel={treeLabel} /> : title}
        </StyledStacktracePreview>
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

const StyledStacktracePreview = styled(StacktracePreview)<{hasGroupingTreeUI: boolean}>`
  ${p =>
    p.hasGroupingTreeUI &&
    `
      display: inline-flex;
      > span:first-child {
        display: inline-flex;
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
