import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {CreateMetricAlertFeature} from 'sentry/components/metrics/createMetricAlertFeature';
import {getQuerySymbol} from 'sentry/components/metrics/querySymbol';
import {IconBookmark, IconEllipsis, IconSettings, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMeasurement} from 'sentry/utils/metrics';
import {hasCustomMetrics, hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {formatMRI} from 'sentry/utils/metrics/mri';
import {MetricExpressionType, type MetricsQueryWidget} from 'sentry/utils/metrics/types';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {getCreateAlert} from 'sentry/views/metrics/metricQueryContextMenu';

interface Props {
  addCustomMetric: () => void;
  showAddMetricButton: boolean;
}

export function PageHeaderActions({showAddMetricButton, addCustomMetric}: Props) {
  const router = useRouter();
  const organization = useOrganization();
  const metricsNewInputs = hasMetricsNewInputs(organization);

  const {isDefaultQuery, setDefaultQuery, widgets, showQuerySymbols} =
    useMetricsContext();

  const handleToggleDefaultQuery = useCallback(() => {
    if (isDefaultQuery) {
      Sentry.metrics.increment('ddm.remove-default-query');
      trackAnalytics('ddm.remove-default-query', {
        organization,
      });
      setDefaultQuery(null);
    } else {
      Sentry.metrics.increment('ddm.set-default-query');
      trackAnalytics('ddm.set-default-query', {
        organization,
      });
      setDefaultQuery(router.location.query);
    }
  }, [isDefaultQuery, organization, router.location.query, setDefaultQuery]);

  const items = useMemo(() => {
    const settingsItem = {
      leadingItems: [<IconSettings key="icon" />],
      key: 'Metrics Settings',
      label: t('Metrics Settings'),
      onAction: () =>
        navigateTo(`/settings/${organization.slug}/projects/:projectId/metrics/`, router),
    };

    return [settingsItem];
  }, [organization, router]);

  const alertItems = useMemo(
    () =>
      widgets
        .filter(
          (query): query is MetricsQueryWidget =>
            query.type === MetricExpressionType.QUERY
        )
        .map((widget, index) => {
          const createAlert = getCreateAlert(organization, widget);
          return {
            leadingItems: showQuerySymbols
              ? [<span key="symbol">{getQuerySymbol(widget.id, metricsNewInputs)}:</span>]
              : [],
            key: `add-alert-${index}`,
            label: widget.mri
              ? `${widget.aggregation}(${middleEllipsis(formatMRI(widget.mri), 60, /\.|-|_/)})`
              : t('Select a metric to create an alert'),
            tooltip: isCustomMeasurement({mri: widget.mri})
              ? t('Custom measurements cannot be used to create alerts')
              : undefined,
            disabled: !createAlert,
            onAction: () => {
              trackAnalytics('ddm.create-alert', {
                organization,
                source: 'global',
              });
              createAlert?.();
            },
          };
        }),
    [widgets, showQuerySymbols, metricsNewInputs, organization]
  );

  return (
    <ButtonBar gap={1}>
      {showAddMetricButton && hasCustomMetrics(organization) && (
        <Button priority="primary" onClick={() => addCustomMetric()} size="sm">
          {t('Add Custom Metrics')}
        </Button>
      )}
      <Button
        size="sm"
        icon={<IconBookmark isSolid={isDefaultQuery} />}
        onClick={handleToggleDefaultQuery}
      >
        {isDefaultQuery ? t('Remove Default') : t('Save as default')}
      </Button>
      {hasCustomMetrics(organization) && (
        <CreateMetricAlertFeature>
          {({hasFeature}) =>
            alertItems.length === 1 ? (
              <Button
                size="sm"
                icon={<IconSiren />}
                disabled={!alertItems[0]!.onAction || !hasFeature}
                onClick={alertItems[0]!.onAction}
              >
                {t('Create Alert')}
              </Button>
            ) : (
              <DropdownMenu
                items={alertItems}
                triggerLabel={t('Create Alert')}
                isDisabled={!hasFeature}
                triggerProps={{
                  size: 'sm',
                  showChevron: false,
                  icon: <IconSiren direction="down" size="sm" />,
                }}
                position="bottom-end"
              />
            )
          }
        </CreateMetricAlertFeature>
      )}
      <DropdownMenu
        items={items}
        triggerProps={{
          'aria-label': t('Page actions'),
          size: 'sm',
          showChevron: false,
          icon: <IconEllipsis direction="down" size="xs" />,
        }}
        position="bottom-end"
      />
    </ButtonBar>
  );
}
