import {useState} from 'react';
import styled from '@emotion/styled';
import type {DraggableProps} from 'framer-motion';

import {IssueViewNavEllipsisMenu} from 'sentry/components/nav/issueViews/issueViewNavEllipsisMenu';
import {IssueViewNavQueryCount} from 'sentry/components/nav/issueViews/issueViewNavQueryCount';
import IssueViewProjectIcons from 'sentry/components/nav/issueViews/issueViewProjectIcons';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
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
   * Ref that constrains where each nav item can be dragged.
   */
  dragConstraints?: DraggableProps['dragConstraints'];
  /**
   * Whether the item is active.
   */
  isActive?: boolean;
  /**
   * Ref to the body of the section that contains the reorderable items.
   * This is used as the portal container for the ellipsis menu.
   */
  sectionBodyRef?: React.RefObject<HTMLDivElement>;
}

export function IssueViewNavItemContent({
  view,
  dragConstraints,
  sectionBodyRef,
  isActive,
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
      to={constructViewLink(baseUrl, view)}
      value={view}
      leadingItems={<IssueViewProjectIcons projectPlatforms={projectPlatforms} />}
      trailingItems={
        <TrailingItemsWrapper>
          <IssueViewNavQueryCount view={view} />
          <IssueViewNavEllipsisMenu
            sectionBodyRef={sectionBodyRef}
            setIsEditing={setIsEditing}
          />
        </TrailingItemsWrapper>
      }
      dragConstraints={dragConstraints}
      isActive={isActive}
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

const constructViewLink = (baseUrl: string, view: IssueViewPF) => {
  return normalizeUrl({
    query: {
      query: view.unsavedChanges?.query ?? view.query,
      sort: view.unsavedChanges?.querySort ?? view.querySort,
      project: view.unsavedChanges?.projects ?? view.projects,
      environment: view.unsavedChanges?.environments ?? view.environments,
      ...normalizeDateTimeParams(view.unsavedChanges?.timeFilters ?? view.timeFilters),
      cursor: undefined,
      page: undefined,
    },
    pathname: `${baseUrl}/views/${view.id}/`,
  });
};

const TrailingItemsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-right: ${space(0.5)};
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
`;
