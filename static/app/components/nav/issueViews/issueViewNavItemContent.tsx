import {useState} from 'react';
import styled from '@emotion/styled';

import {IssueViewNavEllipsisMenu} from 'sentry/components/nav/issueViews/issueViewNavEllipsisMenu';
import {IssueViewNavQueryCount} from 'sentry/components/nav/issueViews/issueViewNavQueryCount';
import IssueViewProjectIcons from 'sentry/components/nav/issueViews/issueViewProjectIcons';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import EditableTabTitle from 'sentry/views/issueList/issueViews/editableTabTitle';
import type {IssueViewPF} from 'sentry/views/issueList/issueViewsPF/issueViewsPF';

export interface IssueViewNavItemContentProps {
  /**
   * The issue view to display
   */
  view: IssueViewPF;
  /**
   * Ref to the body of the section that contains the reorderable items.
   * This is used as the portal container for the ellipsis menu, and as
   * the dragging constraint for each nav item.
   */
  sectionRef?: React.RefObject<HTMLDivElement>;
}

export function IssueViewNavItemContent({
  view,
  sectionRef,
}: IssueViewNavItemContentProps) {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/issues`;
  const [isEditing, setIsEditing] = useState(false);

  const {projects} = useProjects();

  const projectPlatforms = projects
    .filter(p => view.projects.map(String).includes(p.id))
    .map(p => p.platform)
    .filter(defined);

  return (
    <StyledSecondaryNavReordableItem
      to={`${baseUrl}/?viewId=${view.id}`}
      value={view}
      leadingItems={<IssueViewProjectIcons projectPlatforms={projectPlatforms} />}
      trailingItems={
        <TrailingItemsWrapper>
          <IssueViewNavQueryCount view={view} />
          <IssueViewNavEllipsisMenu sectionRef={sectionRef} setIsEditing={setIsEditing} />
        </TrailingItemsWrapper>
      }
      dragConstraints={sectionRef}
    >
      <EditableTabTitle
        label={view.label}
        isEditing={isEditing}
        isSelected={false}
        onChange={() => {}}
        setIsEditing={setIsEditing}
      />
    </StyledSecondaryNavReordableItem>
  );
}

const TrailingItemsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledSecondaryNavReordableItem = styled(SecondaryNav.ReordableItem)`
  position: relative;
  padding-right: ${space(0.5)};

  :hover {
    [data-ellipsis-menu-trigger] {
      display: flex;
    }
    [data-issue-view-query-count] {
      display: none;
    }
  }

  [data-ellipsis-menu-trigger][aria-expanded='true'] {
    display: flex;
  }
  &:has([data-ellipsis-menu-trigger][aria-expanded='true'])
    [data-issue-view-query-count] {
    display: none;
  }
  [data-visible='false'] & ~ div [data-ellipsis-menu] {
    display: none;
  }
`;
