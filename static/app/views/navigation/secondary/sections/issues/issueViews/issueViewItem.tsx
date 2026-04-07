import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueViewQueryCount} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViewQueryCount';
import {
  constructViewLink,
  type IssueView,
} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';

interface IssueViewItemProps {
  isActive: boolean;
  view: IssueView;
}

export function IssueViewItem({view, isActive}: IssueViewItemProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const baseUrl = `/organizations/${organization.slug}/issues`;
  const {hasUnsavedChanges, changedParams} = useIssueViewUnsavedChanges();

  const projectPlatforms = projects
    .filter(p => view.projects.map(String).includes(p.id))
    .map(p => p.platform)
    .filter(defined);

  return (
    <SecondaryNavigation.ReorderableLink
      to={constructViewLink(baseUrl, view)}
      isActive={isActive}
      analyticsItemName="issues_view_starred"
      icon={
        <SecondaryNavigation.ProjectIcon
          projectPlatforms={projectPlatforms}
          allProjects={view.projects.length === 1 && view.projects[0] === -1}
        />
      }
      trailingItems={
        <Flex align="center">
          <IssueViewQueryCount view={view} isActive={isActive} />
          {isActive && hasUnsavedChanges && changedParams && (
            <Tooltip
              title={constructUnsavedTooltipTitle(changedParams)}
              position="top"
              skipWrapper
            >
              <SecondaryNavigation.Indicator variant="accent" />
            </Tooltip>
          )}
        </Flex>
      }
      onNavigate={() => {
        trackAnalytics('issue_views.switched_views', {
          leftNav: true,
          organization: organization.slug,
        });
      }}
    >
      <Tooltip title={view.label} position="top" showOnlyOnOverflow skipWrapper>
        <Text ellipsis variant="inherit">
          {view.label}
        </Text>
      </Tooltip>
    </SecondaryNavigation.ReorderableLink>
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
        <Text bold>{oxfordizeArray(changedParamsArray)}</Text>
      )}
    </Fragment>
  );
};
