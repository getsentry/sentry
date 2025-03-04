import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Reorder} from 'framer-motion';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {useNavContext} from 'sentry/components/nav/context';
import IssueViewNavEditableTitle from 'sentry/components/nav/issueViews/issueViewNavEditableTitle';
import {IssueViewNavEllipsisMenu} from 'sentry/components/nav/issueViews/issueViewNavEllipsisMenu';
import {constructViewLink} from 'sentry/components/nav/issueViews/issueViewNavItems';
import {IssueViewNavQueryCount} from 'sentry/components/nav/issueViews/issueViewNavQueryCount';
import IssueViewProjectIcons from 'sentry/components/nav/issueViews/issueViewProjectIcons';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {
  IssueView,
  IssueViewParams,
} from 'sentry/views/issueList/issueViews/issueViews';
import {normalizeProjectsEnvironments} from 'sentry/views/issueList/issueViewsHeader';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

export interface IssueViewNavItemContentProps {
  /**
   * Whether the item is active.
   */
  isActive: boolean;
  /**
   * Whether an item is being dragged.
   */
  isDragging: boolean;
  /**
   * Whether the item is the last view in the list.
   * This will be removed once view sharing/starring is implemented.
   */
  isLastView: boolean;
  /**
   * A callback function that's fired when the user clicks "Delete" on the view.
   */
  onDeleteView: () => void;
  /**
   * A callback function that's fired when the user clicks "Duplicate" on the view.
   */
  onDuplicateView: () => void;
  /**
   * A callback function that is called when the user has completed a reorder.
   */
  onReorderComplete: () => void;
  /**
   * A callback function that updates the view with new params.
   */
  onUpdateView: (updatedView: IssueView) => void;
  /**
   * A callback function that updates the isDragging state.
   */
  setIsDragging: (isDragging: boolean) => void;
  /**
   * The issue view to display
   */
  view: IssueView;
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
  isActive,
  onUpdateView,
  onDeleteView,
  onDuplicateView,
  onReorderComplete,
  isLastView,
  isDragging,
  setIsDragging,
}: IssueViewNavItemContentProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const baseUrl = `/organizations/${organization.slug}/issues`;
  const [isEditing, setIsEditing] = useState(false);

  const {projects} = useProjects();

  useEffect(() => {
    if (isActive) {
      if (Object.keys(location.query).length === 0) {
        navigate(constructViewLink(baseUrl, view), {replace: true});
        return;
      }
      const unsavedChanges = hasUnsavedChanges(view, location.query);

      if (unsavedChanges && !isEqual(unsavedChanges, view.unsavedChanges)) {
        onUpdateView({
          ...view,
          unsavedChanges,
        });
      } else if (!unsavedChanges && view.unsavedChanges) {
        onUpdateView({
          ...view,
          unsavedChanges: undefined,
        });
      }
    }
    return;
  }, [view, isActive, location.query, navigate, baseUrl, onUpdateView]);

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
      whileDrag={{
        cursor: 'grabbing',
      }}
      onDragStart={() => {
        setIsDragging(true);
        startInteraction();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onReorderComplete();
        endInteraction();
      }}
      layoutId={`${view.id}`}
      style={{
        ...(isDragging
          ? {}
          : {
              originY: '0px',
            }),
      }}
    >
      <StyledSecondaryNavItem
        to={constructViewLink(baseUrl, view)}
        isActive={isActive}
        leadingItems={<IssueViewProjectIcons projectPlatforms={projectPlatforms} />}
        trailingItems={
          <TrailingItemsWrapper
            onClickCapture={e => {
              e.preventDefault();
            }}
          >
            <IssueViewNavQueryCount view={view} />
            <IssueViewNavEllipsisMenu
              isLastView={isLastView}
              setIsEditing={setIsEditing}
              view={view}
              onUpdateView={onUpdateView}
              onDeleteView={onDeleteView}
              onDuplicateView={onDuplicateView}
              baseUrl={baseUrl}
              sectionRef={sectionRef}
            />
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
      >
        <IssueViewNavEditableTitle
          label={view.label}
          isEditing={isEditing}
          isSelected={isActive}
          onChange={value => {
            onUpdateView({...view, label: value});
            trackAnalytics('issue_views.renamed_view', {
              leftNav: true,
              organization: organization.slug,
            });
          }}
          setIsEditing={setIsEditing}
          isDragging={isDragging}
        />
        {view.unsavedChanges && (
          <Tooltip
            title={constructUnsavedTooltipTitle(view.unsavedChanges)}
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

const constructUnsavedTooltipTitle = (unsavedChanges: Partial<IssueViewParams>) => {
  const changedParams = Object.keys(unsavedChanges)
    .filter(k => unsavedChanges[k as keyof IssueViewParams] !== undefined)
    .map(k => READABLE_PARAM_MAPPING[k as keyof IssueViewParams]);

  return (
    <Fragment>
      {t(
        "This view's %s filters are not saved.",
        <BoldTooltipText>{oxfordizeArray(changedParams)}</BoldTooltipText>
      )}
    </Fragment>
  );
};

// TODO(msun): Once nuqs supports native array query params, we can use that here and replace this absurd function
const hasUnsavedChanges = (
  view: IssueView,
  queryParams: Location['query']
): false | Partial<IssueViewParams> => {
  const {
    query: originalQuery,
    querySort: originalSort,
    projects: originalProjects,
    environments: originalEnvironments,
    timeFilters: originalTimeFilters,
  } = view;
  const {
    query: queryQuery,
    sort: querySort,
    project,
    environment,
    start,
    end,
    statsPeriod,
    utc,
  } = queryParams;

  const queryTimeFilters =
    start || end || statsPeriod || utc
      ? {
          start: statsPeriod ? null : start?.toString() ?? null,
          end: statsPeriod ? null : end?.toString() ?? null,
          period: statsPeriod?.toString() ?? null,
          utc: statsPeriod ? null : utc?.toString() === 'true',
        }
      : undefined;

  const {queryEnvs, queryProjects} = normalizeProjectsEnvironments(
    project ?? [],
    environment ?? []
  );

  const issueSortOption = Object.values(IssueSortOptions).includes(
    querySort?.toString() as IssueSortOptions
  )
    ? (querySort as IssueSortOptions)
    : undefined;

  const newUnsavedChanges: Partial<IssueViewParams> = {
    query:
      queryQuery !== null &&
      queryQuery !== undefined &&
      queryQuery.toString() !== originalQuery
        ? queryQuery.toString()
        : undefined,
    querySort:
      querySort && issueSortOption !== originalSort ? issueSortOption : undefined,
    projects: !isEqual(queryProjects?.sort(), originalProjects.sort())
      ? queryProjects
      : undefined,
    environments: !isEqual(queryEnvs?.sort(), originalEnvironments.sort())
      ? queryEnvs
      : undefined,
    timeFilters:
      queryTimeFilters &&
      !isEqual(
        normalizeDateTimeParams(originalTimeFilters),
        normalizeDateTimeParams(queryTimeFilters)
      )
        ? queryTimeFilters
        : undefined,
  };

  const hasNoChanges = Object.values(newUnsavedChanges).every(
    value => value === undefined
  );
  if (hasNoChanges) {
    return false;
  }

  return newUnsavedChanges;
};

// Reorder.Item does handle lifting an item being dragged above other items out of the box,
// but we need to ensure the item is relatively positioned and has a background color for it to work
const StyledReorderItem = styled(Reorder.Item)`
  position: relative;
  background-color: ${p => p.theme.surface200};
`;

const TrailingItemsWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(0.25)};
`;

const StyledSecondaryNavItem = styled(SecondaryNav.Item)`
  position: relative;
  padding-right: ${space(0.5)};

  /* Hide the ellipsis menu if not hovered, or if it's not expanded  */
  :not(:hover):not(:has([data-ellipsis-menu-trigger][aria-expanded='true'])) {
    [data-ellipsis-menu-trigger] {
      ${p => p.theme.visuallyHidden}
    }
  }

  /* Hide the query count if the ellipsis menu is not expanded */
  :hover {
    [data-issue-view-query-count] {
      ${p => p.theme.visuallyHidden}
    }
  }

  /* Hide the query count if the ellipsis menu is expanded */
  &:has([data-ellipsis-menu-trigger][aria-expanded='true'])
    [data-issue-view-query-count] {
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
  width: 12px;
  height: 12px;
  top: -3px;
  right: -3px;
`;
