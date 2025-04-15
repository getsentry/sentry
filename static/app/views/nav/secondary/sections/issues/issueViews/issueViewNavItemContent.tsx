import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, Reorder, useDragControls} from 'framer-motion';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {useNavContext} from 'sentry/views/nav/context';
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import IssueViewNavEditableTitle from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavEditableTitle';
import {IssueViewNavEllipsisMenu} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavEllipsisMenu';
import {
  constructViewLink,
  type NavIssueView,
} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItems';
import {IssueViewNavQueryCount} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavQueryCount';

export interface IssueViewNavItemContentProps {
  /**
   * Whether the item is active.
   */
  isActive: boolean;
  /**
   * Whether an item is being dragged.
   */
  isDragging: string | null;
  /**
   * Whether the item is the last view in the list.
   * This will be removed once view sharing/starring is implemented.
   */
  isLastView: boolean;
  /**
   * A callback function that is called when the user has completed a reorder.
   */
  onReorderComplete: () => void;
  /**
   * A callback function that updates the isDragging state.
   */
  setIsDragging: (isDragging: string | null) => void;
  /**
   * The issue view to display
   */
  view: NavIssueView;
  /**
   * Ref to the body of the section that contains the reorderable items.
   * This is used as the portal container for the ellipsis menu, and as
   * the dragging constraint for each nav item.
   */
  sectionRef?: React.RefObject<HTMLDivElement | null>;
}

export function IssueViewNavItemContent({
  view,
  sectionRef,
  isActive,
  onReorderComplete,
  isLastView,
  isDragging,
  setIsDragging,
}: IssueViewNavItemContentProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {projects} = useProjects();

  const hasIssueViewSharing = organization.features.includes('issue-view-sharing');

  const controls = useDragControls();

  const baseUrl = `/organizations/${organization.slug}/issues`;
  const [isEditing, setIsEditing] = useState(false);
  const {hasUnsavedChanges, changedParams} = useIssueViewUnsavedChanges();

  useEffect(() => {
    if (isActive) {
      if (Object.keys(location.query).length === 0) {
        navigate(constructViewLink(baseUrl, view), {replace: true});
        return;
      }
    }
    return;
  }, [view, isActive, location.query, navigate, baseUrl]);

  const projectPlatforms = projects
    .filter(p => view.projects.map(String).includes(p.id))
    .map(p => p.platform)
    .filter(defined);

  const {startInteraction, endInteraction, isInteractingRef} = useNavContext();

  const scrollPosition = window.scrollY || document.documentElement.scrollTop;

  return (
    <StyledReorderItem
      as="div"
      dragConstraints={sectionRef}
      dragElastic={0.03}
      dragTransition={{bounceStiffness: 400, bounceDamping: 40}}
      value={view}
      onDragStart={() => {
        setIsDragging(view.id);
        startInteraction();
      }}
      onDragEnd={() => {
        setIsDragging(null);
        onReorderComplete();
        endInteraction();
      }}
      dragListener={false}
      dragControls={controls}
      // This style is a hack to fix a framer-motion bug that causes views to
      // jump from the bottom of the nav bar to their correct positions
      // upon scrolling down on the page and triggering a page navigation.
      // See: https://github.com/motiondivision/motion/issues/2006
      style={{
        ...(isDragging || scrollPosition === 0
          ? {}
          : {
              originY: '0px',
            }),
      }}
      grabbing={isDragging === view.id}
    >
      <StyledSecondaryNavItem
        to={constructViewLink(baseUrl, view)}
        isActive={isActive}
        leadingItems={
          <LeadingItemsWrapper>
            <GrabHandleWrapper
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
              <StyledInteractionStateLayer isPressed={isDragging === view.id} />
              <IconGrabbable color="gray300" />
            </GrabHandleWrapper>
            <ProjectIcon projectPlatforms={projectPlatforms} />
          </LeadingItemsWrapper>
        }
        trailingItems={
          <TrailingItemsWrapper
            onClickCapture={e => {
              if (!hasIssueViewSharing) {
                e.preventDefault();
              }
            }}
          >
            <IssueViewNavQueryCount view={view} isActive={isActive} />
            {!hasIssueViewSharing && (
              <IssueViewNavEllipsisMenu
                isLastView={isLastView}
                setIsEditing={setIsEditing}
                view={view}
                sectionRef={sectionRef}
              />
            )}
          </TrailingItemsWrapper>
        }
        onPointerDown={e => {
          e.preventDefault();
        }}
        onClick={e => {
          if (isInteractingRef.current) {
            e.preventDefault();
          } else {
            trackAnalytics('issue_views.switched_views', {
              leftNav: true,
              organization: organization.slug,
            });
          }
        }}
        analyticsItemName="issues_view_starred"
        hasIssueViewSharing={hasIssueViewSharing}
      >
        {hasIssueViewSharing ? (
          view.label
        ) : (
          <IssueViewNavEditableTitle
            view={view}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            isDragging={!!isDragging}
            isActive={isActive}
          />
        )}
        {isActive && hasUnsavedChanges && changedParams && (
          <Tooltip
            title={constructUnsavedTooltipTitle(changedParams)}
            position="top"
            skipWrapper
          >
            <UnsavedChangesIndicator
              role="presentation"
              data-test-id="unsaved-changes-indicator"
              isActive={isActive}
            />
          </Tooltip>
        )}
      </StyledSecondaryNavItem>
    </StyledReorderItem>
  );
}

const READABLE_PARAM_MAPPING = {
  query: t('query'),
  querySort: t('sort'),
  projects: t('projects'),
  environments: t('environments'),
  timeFilters: t('time range'),
};

const constructUnsavedTooltipTitle = (changedParams: {
  environments: boolean;
  projects: boolean;
  query: boolean;
  querySort: boolean;
  timeFilters: boolean;
}) => {
  const changedParamsArray = Object.keys(changedParams)
    .filter(k => changedParams[k as keyof typeof changedParams])
    .map(k => READABLE_PARAM_MAPPING[k as keyof typeof READABLE_PARAM_MAPPING]);

  return (
    <Fragment>
      {t(
        "This view's %s filters are not saved.",
        <BoldTooltipText>{oxfordizeArray(changedParamsArray)}</BoldTooltipText>
      )}
    </Fragment>
  );
};

// Reorder.Item does handle lifting an item being dragged above other items out of the box,
// but we need to ensure the item is relatively positioned and has a background color for it to work
const StyledReorderItem = styled(Reorder.Item, {
  shouldForwardProp: prop => prop !== 'grabbing',
})<{grabbing: boolean}>`
  position: relative;
  background-color: ${p => (p.grabbing ? p.theme.translucentSurface200 : 'transparent')};
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  height: 120%;
  border-radius: 4px;
`;

const TrailingItemsWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(0.25)};
`;

const StyledSecondaryNavItem = styled(SecondaryNav.Item)<{hasIssueViewSharing: boolean}>`
  position: relative;
  padding-right: ${space(0.5)};

  /* Hide the ellipsis menu if the item is not hovered */
  :not(:hover) {
    ${p =>
      !p.hasIssueViewSharing &&
      css`
        [data-ellipsis-menu-trigger]:not([aria-expanded='true']) {
          ${p.theme.visuallyHidden}
        }
      `}

    [data-drag-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }

  /* Hide the query count if the ellipsis menu is not expanded */
  :hover {
    ${p =>
      !p.hasIssueViewSharing &&
      css`
        [data-issue-view-query-count] {
          ${p.theme.visuallyHidden}
        }
      `}

    [data-project-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }

  /* Hide the query count if the ellipsis menu is expanded */
  :has([data-ellipsis-menu-trigger][aria-expanded='true']) [data-issue-view-query-count] {
    ${p => p.theme.visuallyHidden}
  }
`;

const BoldTooltipText = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const UnsavedChangesIndicator = styled('div')<{isActive: boolean}>`
  opacity: ${p => (p.isActive ? 1 : 0)};

  ${StyledSecondaryNavItem}:hover & {
    opacity: ${p => (p.isActive ? 1 : 0.75)};
  }

  border-radius: 50%;
  background: ${p => p.theme.purple400};
  border: solid 2px ${p => p.theme.surface200};
  position: absolute;
  width: 10px;
  height: 10px;
  top: -3px;
  right: -3px;
`;

const LeadingItemsWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: ${space(0.75)};
`;

const GrabHandleWrapper = styled(motion.div)`
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
