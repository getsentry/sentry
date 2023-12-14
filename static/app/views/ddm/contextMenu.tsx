import {useMemo} from 'react';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {openAddToDashboardModal, openModal} from 'sentry/actionCreators/modal';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconCopy, IconDashboard, IconDelete, IconEllipsis, IconSiren} from 'sentry/icons';
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
import {useDDMContext} from 'sentry/views/ddm/context';
import {CreateAlertModal} from 'sentry/views/ddm/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
  widgetIndex: number;
};

export function MetricWidgetContextMenu({
  metricsQuery,
  displayType,
  widgetIndex,
}: ContextMenuProps) {
  const organization = useOrganization();
  const {removeWidget, duplicateWidget} = useDDMContext();
  const createAlert = useCreateAlert(organization, metricsQuery);
  const createDashboardWidget = useCreateDashboardWidget(
    organization,
    metricsQuery,
    displayType
  );

  const items = useMemo<MenuItemProps[]>(
    () => [
      {
        leadingItems: [<IconCopy key="icon" />],
        key: 'duplicate',
        label: t('Duplicate'),
        onAction: () => duplicateWidget(widgetIndex),
      },
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
      {
        leadingItems: [<IconDelete key="icon" />],
        key: 'delete',
        label: t('Delete'),
        onAction: () => removeWidget(widgetIndex),
      },
    ],
    [createAlert, createDashboardWidget, duplicateWidget, removeWidget, widgetIndex]
  );

  if (!hasDDMFeature(organization)) {
    return null;
  }

  return (
    <StyledDropdownMenuControl
      items={items}
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
