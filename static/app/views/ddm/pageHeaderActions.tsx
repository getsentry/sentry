import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  IconBookmark,
  IconDashboard,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMeasurement} from 'sentry/utils/metrics';
import {MRIToField} from 'sentry/utils/metrics/mri';
import {MetricQueryType, type MetricQueryWidgetParams} from 'sentry/utils/metrics/types';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';
import {getCreateAlert} from 'sentry/views/ddm/metricQueryContextMenu';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';
import {useCreateDashboard} from 'sentry/views/ddm/useCreateDashboard';

interface Props {
  addCustomMetric: () => void;
  showCustomMetricButton: boolean;
}

export function PageHeaderActions({showCustomMetricButton, addCustomMetric}: Props) {
  const router = useRouter();
  const organization = useOrganization();
  const createDashboard = useCreateDashboard();
  const {
    isDefaultQuery,
    setDefaultQuery,
    widgets,
    showQuerySymbols,
    selectedWidgetIndex,
  } = useDDMContext();

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

  const items = useMemo(
    () => [
      {
        leadingItems: [<IconDashboard key="icon" />],
        key: 'add-dashboard',
        label: (
          <Feature
            organization={organization}
            hookName="feature-disabled:dashboards-edit"
            features="dashboards-edit"
          >
            {({hasFeature}) => (
              <AddToDashboardItem disabled={!hasFeature}>
                {t('Add to Dashboard')}
              </AddToDashboardItem>
            )}
          </Feature>
        ),
        onAction: () => {
          if (!organization.features.includes('dashboards-edit')) {
            return;
          }
          trackAnalytics('ddm.add-to-dashboard', {
            organization,
            source: 'global',
          });
          createDashboard();
        },
      },
      {
        leadingItems: [<IconSettings key="icon" />],
        key: 'metrics-settings',
        label: t('Metrics Settings'),
        onAction: () => navigateTo(`/settings/projects/:projectId/metrics/`, router),
      },
    ],
    [createDashboard, organization, router]
  );

  const alertItems = useMemo(
    () =>
      widgets
        .filter(
          (query): query is MetricQueryWidgetParams =>
            query.type === MetricQueryType.QUERY
        )
        .map((widget, index) => {
          const createAlert = getCreateAlert(organization, {
            query: widget.query,
            mri: widget.mri,
            groupBy: widget.groupBy,
            op: widget.op,
          });
          return {
            leadingItems: showQuerySymbols
              ? [
                  <QuerySymbol
                    key="icon"
                    queryId={widget.id}
                    isHidden={widget.isHidden}
                    isSelected={index === selectedWidgetIndex}
                  />,
                ]
              : [],
            key: `add-alert-${index}`,
            label: widget.mri
              ? middleEllipsis(MRIToField(widget.mri, widget.op), 60, /\.|-|_/)
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
    [organization, selectedWidgetIndex, showQuerySymbols, widgets]
  );

  return (
    <ButtonBar gap={1}>
      {showCustomMetricButton && (
        <Button priority="primary" onClick={() => addCustomMetric()} size="sm">
          {t('Set Up Custom Metrics')}
        </Button>
      )}
      <Button
        size="sm"
        icon={<IconBookmark isSolid={isDefaultQuery} />}
        onClick={handleToggleDefaultQuery}
      >
        {isDefaultQuery ? t('Remove Default') : t('Save as default')}
      </Button>
      {alertItems.length === 1 ? (
        <Button
          size="sm"
          icon={<IconSiren />}
          disabled={!alertItems[0].onAction}
          onClick={alertItems[0].onAction}
        >
          {t('Create Alert')}
        </Button>
      ) : (
        <DropdownMenu
          items={alertItems}
          triggerLabel={t('Create Alert')}
          triggerProps={{
            size: 'sm',
            showChevron: false,
            icon: <IconSiren direction="down" size="sm" />,
          }}
          position="bottom-end"
        />
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

const AddToDashboardItem = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
