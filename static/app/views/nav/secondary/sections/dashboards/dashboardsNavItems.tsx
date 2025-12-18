import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Reorder, useDragControls} from 'framer-motion';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useReorderStarredDashboards} from 'sentry/views/dashboards/hooks/useReorderStarredDashboards';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';

type DashboardsNavItemsProps = {
  initialDashboards: DashboardListItem[];
};

export function DashboardsNavItems({initialDashboards}: DashboardsNavItemsProps) {
  const organization = useOrganization();
  const user = useUser();
  const location = useLocation();
  const [savedDashboards, setSavedDashboards] =
    useState<DashboardListItem[]>(initialDashboards);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Any time the dashboards prop changes (e.g. when the user stars or unstars a dashboard),
  // we need to reset the savedDashboards state.
  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setSavedDashboards(initialDashboards);
  }, [initialDashboards]);

  const id = getIdFromLocation(location);

  const controls = useDragControls();

  const {projects} = useProjects();

  const reorderStarredDashboards = useReorderStarredDashboards();

  const [isDragging, setIsDragging] = useState<string | null>(null);

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={savedDashboards}
      onReorder={newOrder => {
        setSavedDashboards(newOrder);
      }}
      initial={false}
      ref={sectionRef}
    >
      {savedDashboards?.map(dashboard => {
        const dashboardProjects = new Set((dashboard?.projects ?? []).map(String));
        if (!defined(dashboard?.projects)) {
          Sentry.setTag('organization', organization.id);
          Sentry.setTag('dashboard.id', dashboard.id);
          Sentry.setTag('user.id', user.id);
          Sentry.captureMessage('dashboard.projects is undefined in starred sidebar', {
            level: 'warning',
          });
        }
        const dashboardProjectPlatforms = projects
          .filter(p => dashboardProjects.has(p.id))
          .map(p => p.platform)
          .filter(defined);
        return (
          <StyledReorderItem
            grabbing={isDragging === dashboard.id}
            as="div"
            dragConstraints={sectionRef}
            dragElastic={0.03}
            dragTransition={{bounceStiffness: 400, bounceDamping: 40}}
            // This style is a hack to fix a framer-motion bug that causes views to
            // jump from the bottom of the nav bar to their correct positions
            // upon scrolling down on the page and triggering a page navigation.
            // See: https://github.com/motiondivision/motion/issues/2006
            style={{
              ...(isDragging
                ? {}
                : {
                    originY: '0px',
                  }),
            }}
            key={dashboard.id}
            value={dashboard}
            onDragStart={() => {
              setIsDragging(dashboard.id);
            }}
            onDragEnd={() => {
              setIsDragging(null);
              reorderStarredDashboards(savedDashboards);
            }}
          >
            <StyledSecondaryNavItem
              leadingItems={
                <LeadingItemsWrapper>
                  <GrabHandleWrapper
                    data-test-id={`grab-handle-${dashboard.id}`}
                    data-drag-icon
                    onPointerDown={e => {
                      controls.start(e);
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <StyledInteractionStateLayer
                      isPressed={isDragging === dashboard.id}
                    />
                    <IconGrabbable color="gray300" />
                  </GrabHandleWrapper>
                  <ProjectIcon
                    projectPlatforms={dashboardProjectPlatforms}
                    allProjects={
                      dashboard.projects.length === 1 && dashboard.projects[0] === -1
                    }
                  />
                </LeadingItemsWrapper>
              }
              key={dashboard.id}
              to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
              analyticsItemName="dashboard_starred_item"
              isActive={id === dashboard.id.toString()}
            >
              <Tooltip
                title={dashboard.title}
                position="top"
                showOnlyOnOverflow
                skipWrapper
              >
                <TruncatedTitle>{dashboard.title}</TruncatedTitle>
              </Tooltip>
            </StyledSecondaryNavItem>
          </StyledReorderItem>
        );
      })}
    </Reorder.Group>
  );
}

const StyledSecondaryNavItem = styled(SecondaryNav.Item)`
  align-items: center;
  padding-right: ${space(0.5)};
  position: relative;

  :not(:hover) {
    [data-drag-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }

  :hover {
    [data-project-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const StyledReorderItem = styled(Reorder.Item, {
  shouldForwardProp: prop => prop !== 'grabbing',
})<{grabbing: boolean}>`
  position: relative;
  background-color: ${p => (p.grabbing ? p.theme.colors.surface200 : 'transparent')};
  border-radius: ${p => p.theme.radius.md};
`;

const GrabHandleWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  cursor: grab;
  z-index: 3;

  &:active {
    cursor: grabbing;
  }
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  height: 120%;
  border-radius: 4px;
`;

const LeadingItemsWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TruncatedTitle = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
