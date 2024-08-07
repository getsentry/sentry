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
  type MetricsQueryWidget,
} from 'sentry/utils/metrics/types';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {CreateAlertModal} from 'sentry/views/metrics/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {openExtractionRuleEditModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleEditModal';

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
  const {getExtractionRule} = useVirtualMetricsContext();
  const organization = useOrganization();
  const router = useRouter();

  const {removeWidget, duplicateWidget, widgets, updateWidget} = useMetricsContext();
  const createAlert = getCreateAlert(organization, metricsQuery);

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
        disabled: !isCustomMetric({mri: metricsQuery.mri}),
        label: t('Configure Metric'),
        onAction: () => {
          trackAnalytics('ddm.widget.settings', {
            organization,
          });
          Sentry.metrics.increment('ddm.widget.settings');

          if (!isVirtualMetric(metricsQuery)) {
            navigateTo(
              `/settings/projects/:projectId/metrics/${encodeURIComponent(
                metricsQuery.mri
              )}`,
              router
            );
          } else {
            const extractionRule = getExtractionRule(
              metricsQuery.mri,
              metricsQuery.condition!
            );
            if (extractionRule) {
              openExtractionRuleEditModal({
                metricExtractionRule: extractionRule,
                onSubmitSuccess: data => {
                  // Keep the unit of the MRI in sync with the unit of the extraction rule
                  // TODO: Remove this once we have a better way to handle this
                  const newMRI = metricsQuery.mri.replace(/@.*$/, `@${data.unit}`);
                  updateWidget(widgetIndex, {
                    mri: newMRI,
                  } as Partial<MetricsQueryWidget>);
                },
              });
            }
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
      metricsQuery,
      createDashboardWidget,
      hasDashboardFeature,
      canDelete,
      duplicateWidget,
      widgetIndex,
      router,
      getExtractionRule,
      updateWidget,
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
  const {resolveVirtualMRI} = useVirtualMetricsContext();

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
        <CreateAlertModal metricsQuery={queryCopy} {...deps} />
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
        widgetAsQueryParams,
        location: router.location,
        actions: ['add-and-open-dashboard', 'add-and-stay-on-current-page'],
        allowCreateNewDashboard: false,
      });
  }, [metricsQuery, selection, displayType, resolveVirtualMRI, organization, router]);
}
