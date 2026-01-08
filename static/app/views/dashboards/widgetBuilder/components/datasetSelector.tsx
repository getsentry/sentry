import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Link} from 'sentry/components/core/link';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasTraceMetricsDashboards} from 'sentry/views/dashboards/hooks/useHasTraceMetricsDashboards';
import {WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useCacheBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useCacheBuilderState';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {useSegmentSpanWidgetState} from 'sentry/views/dashboards/widgetBuilder/hooks/useSegmentSpanWidgetState';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';

function WidgetBuilderDatasetSelector() {
  const organization = useOrganization();
  const location = useLocation();
  const {state} = useWidgetBuilderContext();
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const {cacheBuilderState, restoreOrSetBuilderState} = useCacheBuilderState();
  const {setSegmentSpanBuilderState} = useSegmentSpanWidgetState();

  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();

  const datasetOptions = [];
  datasetOptions.push({
    value: WidgetType.ERRORS,
    label: t('Errors'),
    details: t(
      'Error events from your application that Sentry uses to group into issues. Use for error frequency, distribution, and impact.'
    ),
  });

  const transactionsOption = {
    value: WidgetType.TRANSACTIONS,
    label: t('Transactions'),
    disabled: organization.features.includes('discover-saved-queries-deprecation'),
    details: organization.features.includes('discover-saved-queries-deprecation')
      ? tct('This dataset is no longer supported. Please use the [spans] dataset.', {
          spans: (
            <Link
              // We need to do this otherwise the dashboard filters will change
              to={{
                pathname: location.pathname,
                query: {
                  project: location.query.project,
                  start: location.query.start,
                  end: location.query.end,
                  statsPeriod: location.query.statsPeriod,
                  environment: location.query.environment,
                  utc: location.query.utc,
                },
              }}
              onClick={() => {
                cacheBuilderState(state.dataset ?? WidgetType.ERRORS);
                setSegmentSpanBuilderState();
              }}
            >
              {t('spans')}
            </Link>
          ),
        })
      : t(
          'Transaction events that track the performance of operations in your application. Use for endpoint performance, throughput, and trends.'
        ),
  };

  if (organization.features.includes('visibility-explore-view')) {
    datasetOptions.push({
      value: WidgetType.SPANS,
      label: t('Spans'),
      details: t(
        'Distributed tracing spans from your application that track the performance of individual operations. Use for detailed performance analysis.'
      ),
    });
  }

  if (isLogsEnabled(organization)) {
    datasetOptions.push({
      value: WidgetType.LOGS,
      label: t('Logs'),
      details: t(
        'Log messages from your application for debugging and monitoring. Use for tracking application events and troubleshooting issues.'
      ),
    });
  }

  if (hasTraceMetricsDashboards) {
    datasetOptions.push({
      value: WidgetType.TRACEMETRICS,
      label: t('Metrics'),
      details: t(
        'Performance metrics derived from traces to monitor and analyze system behavior. Use for high-level performance monitoring.'
      ),
    });
  }
  datasetOptions.push({
    value: WidgetType.ISSUE,
    label: t('Issues'),
    details: t(
      'Issues grouped by root cause with properties like state and assignment. Use for creating custom issue lists and tracking resolution.'
    ),
  });

  datasetOptions.push({
    value: WidgetType.RELEASE,
    label: t('Releases'),
    details: t(
      'Release-specific data including sessions and crash rates. Use for monitoring release health and stability across versions.'
    ),
  });

  datasetOptions.push(transactionsOption);

  return (
    <Fragment>
      <StyledSectionHeader
        title={t('Dataset')}
        tooltipText={tct(
          `This reflects the type of information you want to use. To learn more, [link: read the docs].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/dashboards/widget-builder/#choose-your-dataset" />
            ),
          }
        )}
      />
      <CompactSelect
        value={state.dataset ?? WidgetType.ERRORS}
        options={datasetOptions}
        menuWidth={500}
        onChange={selection => {
          const newDataset = selection.value;

          // Set the current dataset state in local storage for recovery
          // when the user navigates back to this dataset
          cacheBuilderState(state.dataset ?? WidgetType.ERRORS);

          // Restore the builder state for the new dataset
          // or set the dataset if there is no cached state
          restoreOrSetBuilderState(newDataset);

          trackAnalytics('dashboards_views.widget_builder.change', {
            from: source,
            widget_type: state.dataset ?? '',
            builder_version: WidgetBuilderVersion.SLIDEOUT,
            field: 'dataSet',
            value: newDataset,
            new_widget: !isEditing,
            organization,
          });
        }}
      />
    </Fragment>
  );
}

export default WidgetBuilderDatasetSelector;

const StyledSectionHeader = styled(SectionHeader)`
  margin-bottom: ${space(1)};
`;
