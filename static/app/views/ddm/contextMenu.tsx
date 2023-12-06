import {useMemo} from 'react';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {openAddToDashboardModal, openModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDashboard, IconEllipsis, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  getFieldFromMetricsQuery,
  isCustomMeasurement,
  isCustomMetric,
  MetricDisplayType,
  MetricsQuery,
} from 'sentry/utils/metrics';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';
import {CreateAlertModal} from 'sentry/views/ddm/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
};

export function MetricWidgetContextMenu({metricsQuery, displayType}: ContextMenuProps) {
  const organization = useOrganization();
  const createAlert = useCreateAlert(organization, metricsQuery);
  const createDashboardWidget = useCreateDashboardWidget(
    organization,
    metricsQuery,
    displayType
  );

  if (!hasDDMFeature(organization)) {
    return null;
  }

  return (
    <StyledDropdownMenuControl
      items={[
        {
          leadingItems: [<IconSiren key="icon" />],
          key: 'add-alert',
          label: t('Create Alert'),
          disabled: !createAlert,
          onAction: createAlert,
        },
        {
          leadingItems: [<IconDashboard key="icon" />],
          key: 'add-dashoard',
          label: t('Add to Dashboard'),
          disabled: !createDashboardWidget,
          onAction: createDashboardWidget,
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

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin: ${space(1)};
`;

export function useCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  return useMemo(() => {
    if (
      !metricsQuery.mri ||
      !metricsQuery.op ||
      isCustomMeasurement(metricsQuery) ||
      !organization.access.includes('alerts:write')
    ) {
      return undefined;
    }
    return function () {
      return openModal(deps => (
        <OrganizationContext.Provider value={organization}>
          <CreateAlertModal metricsQuery={metricsQuery} {...deps} />
        </OrganizationContext.Provider>
      ));
    };
  }, [metricsQuery, organization]);
}

export function useCreateDashboardWidget(
  organization: Organization,
  metricsQuery: MetricsQuery,
  displayType?: MetricDisplayType
) {
  const router = useRouter();
  const {projects, environments, datetime} = metricsQuery;
  const isCustomMetricQuery = isCustomMetric(metricsQuery);

  return useMemo(() => {
    if (!metricsQuery.mri || !metricsQuery.op || isCustomMeasurement(metricsQuery)) {
      return undefined;
    }

    const widgetQuery = getWidgetQuery(metricsQuery);
    const urlWidgetQuery = encodeWidgetQuery(widgetQuery);
    const widgetAsQueryParams = getWidgetAsQueryParams(
      metricsQuery,
      urlWidgetQuery,
      displayType
    );

    return () =>
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
          widgetType: isCustomMetricQuery ? WidgetType.METRICS : WidgetType.DISCOVER,
          limit: !metricsQuery.groupBy?.length ? 1 : 10,
          queries: [widgetQuery],
        },
        router,
        widgetAsQueryParams,
        location: router.location,
      });
  }, [
    isCustomMetricQuery,
    metricsQuery,
    datetime,
    displayType,
    environments,
    organization,
    projects,
    router,
  ]);
}

function getWidgetQuery(metricsQuery: MetricsQuery) {
  const field = getFieldFromMetricsQuery(metricsQuery);

  return {
    name: '',
    aggregates: [field],
    columns: metricsQuery.groupBy ?? [],
    fields: [field],
    conditions: metricsQuery.query ?? '',
    orderby: '',
  };
}

function encodeWidgetQuery(query) {
  return urlEncode({
    ...query,
    aggregates: query.aggregates.join(','),
    fields: query.fields?.join(','),
    columns: query.columns.join(','),
  });
}

function getWidgetAsQueryParams(
  metricsQuery: MetricsQuery,
  urlWidgetQuery: string,
  displayType?: MetricDisplayType
) {
  const {start, end, period} = metricsQuery.datetime;
  const {projects} = metricsQuery;

  return {
    source: DashboardWidgetSource.DDM,
    start,
    end,
    statsPeriod: period,
    defaultWidgetQuery: urlWidgetQuery,
    defaultTableColumns: [],
    defaultTitle: 'DDM Widget',
    environment: metricsQuery.environments,
    displayType,
    project: projects,
  };
}
