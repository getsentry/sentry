import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {buildAggregate} from 'sentry/views/alerts/rules/metric/mriField';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
};

export function MetricWidgetContextMenu({metricsQuery, displayType}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();
  const projects = useProjects();
  const pageFilters = usePageFilters();
  const firstProject = projects.projects.find(
    p => p.id === pageFilters.selection.projects[0].toString()
  );

  if (!organization.features.includes('ddm-experimental')) {
    return null;
  }

  const isCreateAlertEnabled = firstProject && metricsQuery.mri && metricsQuery.op;

  return (
    <StyledDropdownMenuControl
      items={[
        {
          key: 'add-alert',
          label: t('Create Alert'),
          disabled: !isCreateAlertEnabled,
          to: isCreateAlertEnabled
            ? {
                pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
                query: {
                  // Needed, so alerts-create also collects environment via event view
                  createFromDiscover: true,
                  dataset: Dataset.GENERIC_METRICS,
                  eventTypes: EventTypes.TRANSACTION,
                  aggregate: buildAggregate(metricsQuery.mri, metricsQuery.op as string),
                  referrer: 'ddm',
                  // Event type also needs to be added to the query
                  query: `${metricsQuery.query}  event.type:transaction`.trim(),
                  environment: metricsQuery.environments,
                  project: firstProject?.slug,
                },
              }
            : undefined,
        },
        {
          key: 'add-dashoard',
          label: t('Add to Dashboard'),
          onAction: () => {
            handleAddQueryToDashboard(metricsQuery, organization, router, displayType);
          },
        },
      ]}
      triggerProps={{
        'aria-label': t('Widget actions'),
        size: 'xs',
        borderless: true,
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

function handleAddQueryToDashboard(
  {projects, environments, datetime, op, mri, groupBy, query}: MetricsQuery,
  organization: Organization,
  router: InjectedRouter,
  displayType?: MetricDisplayType
) {
  const {start, end, period} = datetime;
  // TODO(ddm): make a util that does this
  const field = op ? `${op}(${mri})` : mri;

  const widgetAsQueryParams = {
    ...router.location?.query,
    source: DashboardWidgetSource.DDM,
    start,
    end,
    statsPeriod: period,
    defaultWidgetQuery: field,
    defaultTableColumns: [],
    defaultTitle: 'DDM Widget',
    displayType,
  };

  const limit = !groupBy?.length ? 1 : 10;
  openAddToDashboardModal({
    organization,
    selection: {
      projects,
      environments,
      datetime,
    },
    widget: {
      title: 'DDM Widget',
      displayType,
      widgetType: 'custom-metrics',
      limit,
      queries: [
        {
          name: '',
          aggregates: [field],
          columns: groupBy ?? [],
          fields: [field],
          conditions: query,
        },
      ],
    },
    router,
    widgetAsQueryParams,
    location: router.location,
  });
}

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin: ${space(1)};
`;
