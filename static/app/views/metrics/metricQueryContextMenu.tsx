import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {openAddToDashboardModal, openModal} from 'sentry/actionCreators/modal';
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
import {isCustomMeasurement, isCustomMetric} from 'sentry/utils/metrics';
import {
  convertToDashboardWidget,
  encodeWidgetQuery,
  getWidgetAsQueryParams,
  getWidgetQuery,
} from 'sentry/utils/metrics/dashboard';
import {
  hasCustomMetrics,
  hasCustomMetricsExtractionRules,
  hasMetricAlertFeature,
} from 'sentry/utils/metrics/features';
import {
  isMetricsQueryWidget,
  type MetricDisplayType,
  type MetricsQuery,
} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {CreateAlertModal} from 'sentry/views/metrics/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

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
  const createAlert = useMemo(
    () => getCreateAlert(organization, metricsQuery),
    [metricsQuery, organization]
  );
  const createDashboardWidget = useCreateDashboardWidget(
    organization,
    metricsQuery,
    displayType
  );

  // At least one query must remain
  const canDelete = widgets.filter(isMetricsQueryWidget).length > 1;
  const hasDashboardFeature = organization.features.includes('dashboards-edit');

  const items = useMemo<MenuItemProps[]>(
    () => [
      {
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
      },
      {
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
      },
      {
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
      },
      {
        leadingItems: [<IconSettings key="icon" />],
        key: 'settings',
        disabled: hasCustomMetricsExtractionRules(organization)
          ? false
          : !isCustomMetric({mri: metricsQuery.mri}),
        label: t('Metric Settings'),
        onAction: () => {
          trackAnalytics('ddm.widget.settings', {
            organization,
          });
          Sentry.metrics.increment('ddm.widget.settings');
          if (
            !hasCustomMetricsExtractionRules(organization) ||
            isCustomMetric({mri: metricsQuery.mri})
          ) {
            navigateTo(
              `/settings/projects/:projectId/metrics/${encodeURIComponent(
                metricsQuery.mri
              )}`,
              router
            );
          } else {
            // TODO(telemetry-experience): As soon as the span-based-metrics data has an unique identifier, we should use it here
            navigateTo(`/settings/projects/:projectId/metrics/`, router);
          }
        },
      },
      {
        leadingItems: [<IconClose key="icon" />],
        key: 'delete',
        label: t('Remove Metric'),
        disabled: !canDelete,
        onAction: () => {
          Sentry.metrics.increment('ddm.widget.delete');
          removeWidget(widgetIndex);
        },
      },
    ],
    [
      createAlert,
      organization,
      createDashboardWidget,
      hasDashboardFeature,
      metricsQuery.mri,
      canDelete,
      duplicateWidget,
      widgetIndex,
      router,
      removeWidget,
    ]
  );

  if (!hasCustomMetrics(organization)) {
    return null;
  }

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

export function getCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  if (
    !metricsQuery.mri ||
    !metricsQuery.aggregation ||
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
}

export function useCreateDashboardWidget(
  organization: Organization,
  metricsQuery: MetricsQuery,
  displayType?: MetricDisplayType
) {
  const router = useRouter();
  const {selection} = usePageFilters();

  return useMemo(() => {
    if (
      !metricsQuery.mri ||
      !metricsQuery.aggregation ||
      isCustomMeasurement(metricsQuery)
    ) {
      return undefined;
    }

    const widgetQuery = getWidgetQuery(metricsQuery);
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
        widget: convertToDashboardWidget([metricsQuery], displayType),
        router,
        widgetAsQueryParams,
        location: router.location,
        actions: ['add-and-open-dashboard', 'add-and-stay-on-current-page'],
        allowCreateNewDashboard: false,
      });
  }, [metricsQuery, selection, displayType, organization, router]);
}
