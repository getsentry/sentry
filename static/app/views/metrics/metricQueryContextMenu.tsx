import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Hovercard} from 'sentry/components/hovercard';
import {CreateMetricAlertFeature} from 'sentry/components/metrics/createMetricAlertFeature';
import {
  IconClose,
  IconCopy,
  IconDashboard,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMeasurement, isCustomMetric, isVirtualMetric} from 'sentry/utils/metrics';
import {
  convertToDashboardWidget,
  encodeWidgetQuery,
  getWidgetAsQueryParams,
  getWidgetQuery,
} from 'sentry/utils/metrics/dashboard';
import {hasCustomMetrics, hasMetricAlertFeature} from 'sentry/utils/metrics/features';
import {
  isMetricsQueryWidget,
  type MetricDisplayType,
  type MetricsQuery,
} from 'sentry/utils/metrics/types';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {openCreateAlertModal} from 'sentry/views/metrics/createAlertModal';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
  widgetIndex: number;
};

export function MetricQueryContextMenu({
  metricsQuery,
  displayType,
  widgetIndex,
}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();

  const {removeWidget, duplicateWidget, widgets} = useMetricsContext();
  const createAlert = getCreateAlert(organization, metricsQuery);

  const createDashboardWidget = useCreateDashboardWidget(
    organization,
    metricsQuery,
    displayType
  );

  // At least one query must remain
  const canDelete = widgets.filter(isMetricsQueryWidget).length > 1;
  const hasDashboardFeature = organization.features.includes('dashboards-edit');

  const items = useMemo<MenuItemProps[]>(() => {
    const duplicateItem = {
      leadingItems: [<IconCopy key="icon" />],
      key: 'duplicate',
      label: t('Duplicate'),
      onAction: () => {
        trackAnalytics('ddm.widget.duplicate', {
          organization,
        });
        Sentry.metrics.increment('ddm.widget.duplicate');
        duplicateWidget(widgetIndex);
      },
    };

    const createAlertItem = {
      leadingItems: [<IconSiren key="icon" />],
      key: 'add-alert',
      label: <CreateMetricAlertFeature>{t('Create Alert')}</CreateMetricAlertFeature>,
      disabled: !createAlert || !hasMetricAlertFeature(organization),
      onAction: () => {
        trackAnalytics('ddm.create-alert', {
          organization,
          source: 'widget',
        });
        Sentry.metrics.increment('ddm.widget.alert');
        createAlert?.();
      },
    };

    const addToDashboardItem = {
      leadingItems: [<IconDashboard key="icon" />],
      key: 'add-dashboard',
      label: (
        <Feature
          organization={organization}
          hookName="feature-disabled:dashboards-edit"
          features="dashboards-edit"
          renderDisabled={p => (
            <Hovercard
              body={
                <FeatureDisabled
                  features={p.features}
                  hideHelpToggle
                  featureName={t('Metric Alerts')}
                />
              }
            >
              {typeof p.children === 'function' ? p.children(p) : p.children}
            </Hovercard>
          )}
        >
          <span>{t('Add to Dashboard')}</span>
        </Feature>
      ),
      disabled: !createDashboardWidget || !hasDashboardFeature,
      onAction: () => {
        if (!organization.features.includes('dashboards-edit')) {
          return;
        }
        trackAnalytics('ddm.add-to-dashboard', {
          organization,
          source: 'widget',
        });
        Sentry.metrics.increment('ddm.widget.dashboard');
        createDashboardWidget?.();
      },
    };

    const settingsItem = {
      leadingItems: [<IconSettings key="icon" />],
      key: 'settings',
      disabled: !isCustomMetric({mri: metricsQuery.mri}),
      label: t('Configure Metric'),
      onAction: () => {
        trackAnalytics('ddm.widget.settings', {
          organization,
        });
        Sentry.metrics.increment('ddm.widget.settings');

        if (!isVirtualMetric(metricsQuery)) {
          navigateTo(
            `/settings/${organization.slug}/projects/:projectId/metrics/${encodeURIComponent(
              metricsQuery.mri
            )}`,
            router
          );
        }
      },
    };

    const deleteItem = {
      leadingItems: [<IconClose key="icon" />],
      key: 'delete',
      label: t('Delete'),
      disabled: !canDelete,
      onAction: () => {
        trackAnalytics('ddm.widget.delete', {
          organization,
        });
        Sentry.metrics.increment('ddm.widget.delete');
        removeWidget(widgetIndex);
      },
    };

    if (hasCustomMetrics(organization)) {
      return [
        duplicateItem,
        createAlertItem,
        addToDashboardItem,
        settingsItem,
        deleteItem,
      ];
    }
    return [duplicateItem, settingsItem, deleteItem];
  }, [
    createAlert,
    organization,
    metricsQuery,
    createDashboardWidget,
    hasDashboardFeature,
    canDelete,
    duplicateWidget,
    widgetIndex,
    router,
    removeWidget,
  ]);

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        'aria-label': t('Widget actions'),
        size: 'md',
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

function canCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  return (
    organization.access.includes('alerts:write') &&
    metricsQuery.mri &&
    metricsQuery.aggregation &&
    !isCustomMeasurement(metricsQuery)
  );
}

export function getCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  if (!canCreateAlert(organization, metricsQuery)) {
    return undefined;
  }
  return function () {
    openCreateAlertModal({metricsQuery, organization});
  };
}

function useCreateDashboardWidget(
  organization: Organization,
  metricsQuery: MetricsQuery,
  displayType?: MetricDisplayType
) {
  const router = useRouter();
  const {resolveVirtualMRI} = useVirtualMetricsContext();
  const {selection} = usePageFilters();

  return useMemo(() => {
    if (
      !metricsQuery.mri ||
      !metricsQuery.aggregation ||
      isCustomMeasurement(metricsQuery)
    ) {
      return undefined;
    }

    const queryCopy = {...metricsQuery};
    if (isVirtualMetric(metricsQuery) && metricsQuery.condition) {
      const {mri, aggregation} = resolveVirtualMRI(
        metricsQuery.mri,
        metricsQuery.condition,
        metricsQuery.aggregation
      );
      queryCopy.mri = mri;
      queryCopy.aggregation = aggregation;
    }

    const widgetQuery = getWidgetQuery(queryCopy);
    const urlWidgetQuery = encodeWidgetQuery(widgetQuery);
    const widgetAsQueryParams = getWidgetAsQueryParams(
      selection,
      urlWidgetQuery,
      displayType
    );

    return () =>
      openAddToDashboardModal({
        organization,
        selection,
        widget: convertToDashboardWidget([queryCopy], displayType),
        router,
        // Previously undetected because the type relied on implicit any.
        // @ts-expect-error TS(2741): Property 'source' is missing in type '{ start: Dat... Remove this comment to see the full error message
        widgetAsQueryParams,
        location: router.location,
        actions: ['add-and-open-dashboard', 'add-and-stay-on-current-page'],
        allowCreateNewDashboard: false,
      });
  }, [metricsQuery, selection, displayType, resolveVirtualMRI, organization, router]);
}
