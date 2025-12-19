import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion, Reorder, useDragControls} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {useNavContext} from 'sentry/views/nav/context';
import ProjectIcon from 'sentry/views/nav/projectIcon';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {IssueViewQueryCount} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewQueryCount';
import {
  constructViewLink,
  type IssueView,
} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViews';

interface IssueViewItemProps {
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
  view: IssueView;
  /**
   * Ref to the body of the section that contains the reorderable items.
   * This is used as the portal container for the ellipsis menu, and as
   * the dragging constraint for each nav item.
   */
  sectionRef?: React.RefObject<HTMLDivElement | null>;
}

export function IssueViewItem({
  view,
  sectionRef,
  isActive,
  onReorderComplete,
  isDragging,
  setIsDragging,
}: IssueViewItemProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const controls = useDragControls();

  const baseUrl = `/organizations/${organization.slug}/issues`;
  const {hasUnsavedChanges, changedParams} = useIssueViewUnsavedChanges();

  const projectPlatforms = projects
    .filter(p => view.projects.map(String).includes(p.id))
    .map(p => p.platform)
    .filter(defined);

  const {startInteraction, endInteraction, isInteractingRef} = useNavContext();

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
        ...(isDragging
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
            <ProjectIcon
              projectPlatforms={projectPlatforms}
              allProjects={view.projects.length === 1 && view.projects[0] === -1}
            />
          </LeadingItemsWrapper>
        }
        trailingItems={
          <Flex align="center">
            <IssueViewQueryCount view={view} isActive={isActive} />
          </Flex>
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
      >
        <Tooltip title={view.label} position="top" showOnlyOnOverflow skipWrapper>
          <TruncatedTitle>{view.label}</TruncatedTitle>
        </Tooltip>
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
        "This view's %s filters have not been saved.",
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
  background-color: ${p => (p.grabbing ? p.theme.colors.surface200 : 'transparent')};
  border-radius: ${p => p.theme.radius.md};
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  height: 120%;
  border-radius: 4px;
`;

const StyledSecondaryNavItem = styled(SecondaryNav.Item)`
  position: relative;
  padding-right: ${space(0.5)};

  /* Hide the project icon on hover in favor of the drag handle */
  :hover {
    [data-project-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }

  :not(:hover) {
    [data-drag-icon] {
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const BoldTooltipText = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const UnsavedChangesIndicator = styled('div')<{isActive: boolean}>`
  opacity: ${p => (p.isActive ? 1 : 0)};

  ${StyledSecondaryNavItem}:hover & {
    opacity: ${p => (p.isActive ? 1 : 0.75)};
  }

  border-radius: 50%;
  background: ${p => p.theme.colors.blue500};
  border: solid 2px ${p => p.theme.colors.surface300};
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

const TruncatedTitle = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
