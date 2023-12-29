import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {openAddToDashboardModal, openModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {
  IconCopy,
  IconDashboard,
  IconDelete,
  IconEdit,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  isCustomMeasurement,
  isCustomMetric,
  MetricDisplayType,
  MetricsQuery,
} from 'sentry/utils/metrics';
import {
  convertToDashboardWidget,
  encodeWidgetQuery,
  getWidgetAsQueryParams,
  getWidgetQuery,
} from 'sentry/utils/metrics/dashboard';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';
import {CreateAlertModal} from 'sentry/views/ddm/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  metricsQuery: MetricsQuery;
  onEdit: () => void;
  widgetIndex: number;
};

export function MetricWidgetContextMenu({
  metricsQuery,
  displayType,
  widgetIndex,
  onEdit,
  isEdit,
}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();
  const {removeWidget, duplicateWidget, widgets} = useDDMContext();
  const createAlert = useCreateAlert(organization, metricsQuery);
  const createDashboardWidget = useCreateDashboardWidget(
    organization,
    metricsQuery,
    displayType
  );

  const canDelete = widgets.length > 1;

  const items = useMemo<MenuItemProps[]>(
    () => [
      {
        leadingItems: [<IconCopy key="icon" />],
        key: 'duplicate',
        label: t('Duplicate'),
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.duplicate');
          duplicateWidget(widgetIndex);
        },
      },
      {
        leadingItems: [<IconSiren key="icon" />],
        key: 'add-alert',
        label: t('Create Alert'),
        disabled: !createAlert,
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.alert');
          createAlert?.();
        },
      },
      {
        leadingItems: [<IconDashboard key="icon" />],
        key: 'add-dashoard',
        label: t('Add to Dashboard'),
        disabled: !createDashboardWidget,
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.dashboard');
          createDashboardWidget?.();
        },
      },
      {
        leadingItems: [<IconSettings key="icon" />],
        key: 'settings',
        label: t('Metric Settings'),
        disabled: !isCustomMetric({mri: metricsQuery.mri}),
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.settings');
          navigateTo(
            `/settings/projects/:projectId/metrics/${encodeURIComponent(
              metricsQuery.mri
            )}`,
            router
          );
        },
      },
      {
        leadingItems: [<IconDelete key="icon" />],
        key: 'delete',
        label: t('Delete'),
        disabled: !canDelete,
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.delete');
          removeWidget(widgetIndex);
        },
      },
    ],
    [
      createAlert,
      createDashboardWidget,
      duplicateWidget,
      removeWidget,
      widgetIndex,
      canDelete,
      metricsQuery.mri,
      router,
    ]
  );

  if (!hasDDMFeature(organization)) {
    return null;
  }

  return (
    <Wrapper>
      {!isEdit && (
        <Button
          onClick={onEdit}
          borderless
          size="xs"
          aria-label={t('Edit widget')}
          icon={<IconEdit />}
        />
      )}

      <DropdownMenu
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
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin: ${space(1)} ${space(0.5)} 0 0;
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
