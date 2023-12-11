import {useMemo} from 'react';
import styled from '@emotion/styled';

import {
  openAddToDashboardModal,
  openCreateDashboardFromScratchpad,
  openModal,
} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDashboard, IconEllipsis, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {isCustomMeasurement, MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {
  convertToDashboardWidget,
  encodeWidgetQuery,
  getWidgetAsQueryParams,
  getWidgetQuery,
} from 'sentry/utils/metrics/dashboard';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';
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
        widget: convertToDashboardWidget(metricsQuery, displayType),
        router,
        widgetAsQueryParams,
        location: router.location,
      });
  }, [metricsQuery, datetime, displayType, environments, organization, projects, router]);
}

export function useCreateDashboard() {
  const router = useRouter();
  const organization = useOrganization();
  const {widgets} = useDDMContext();
  const {selection} = usePageFilters();

  return useMemo(() => {
    return function (scratchpad?: {name: string}) {
      const newDashboard = {
        title: scratchpad?.name || 'DDM Dashboard',
        description: '',
        widgets: widgets
          .filter(widget => !!widget.mri)
          .map(widget =>
            // @ts-expect-error TODO(ogi): fix this
            convertToDashboardWidget(widget, widget.displayType)
          ),
        projects: selection.projects,
        environment: selection.environments,
        start: selection.datetime.start as string,
        end: selection.datetime.end as string,
        period: selection.datetime.period as string,
        filters: {},
        utc: selection.datetime.utc ?? false,
        id: 'ddm-scratchpad',
        dateCreated: '',
      };

      openCreateDashboardFromScratchpad({newDashboard, router, organization});
    };
  }, [selection, widgets, organization, router]);
}
