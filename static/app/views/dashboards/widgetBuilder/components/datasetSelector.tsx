import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import type {
  RadioGroupProps,
  RadioOption,
} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
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
  const disabledChoices: RadioGroupProps<WidgetType>['disabledChoices'] = [];
  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();

  const datasetChoices: Array<RadioOption<WidgetType>> = [];
  datasetChoices.push([WidgetType.ERRORS, t('Errors')]);
  if (organization.features.includes('discover-saved-queries-deprecation')) {
    disabledChoices.push([
      WidgetType.TRANSACTIONS,
      tct('This dataset is no longer supported. Please use the [spans] dataset.', {
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
      }),
    ]);
  }

  if (organization.features.includes('visibility-explore-view')) {
    datasetChoices.push([WidgetType.SPANS, t('Spans')]);
  }
  if (isLogsEnabled(organization)) {
    datasetChoices.push([WidgetType.LOGS, t('Logs')]);
  }
  if (hasTraceMetricsDashboards) {
    datasetChoices.push([WidgetType.TRACEMETRICS, t('Metrics')]);
  }
  datasetChoices.push([WidgetType.ISSUE, t('Issues')]);
  datasetChoices.push([WidgetType.RELEASE, t('Releases')]);
  datasetChoices.push([WidgetType.TRANSACTIONS, t('Transactions')]);

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
      <DatasetChoices
        label={t('Dataset')}
        value={state.dataset ?? WidgetType.ERRORS}
        choices={datasetChoices}
        disabledChoices={disabledChoices}
        tooltipIsHoverable
        onChange={(newDataset: WidgetType) => {
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

const DatasetChoices = styled(RadioGroup<WidgetType>)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`;

const StyledSectionHeader = styled(SectionHeader)`
  margin-bottom: ${space(1)};
`;
