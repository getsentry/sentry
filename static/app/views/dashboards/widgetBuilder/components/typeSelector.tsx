import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from '@sentry/scraps/compactSelect';

import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {IconGraph, IconMarkdown, IconNumber, IconSettings, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useDashboardWidgetSource} from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import {useIsEditingWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertWidgetToBuilderState} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

export const DISPLAY_TYPE_ICONS: Partial<Record<DisplayType, React.ReactNode>> = {
  [DisplayType.AREA]: <IconGraph key="area" type="area" />,
  [DisplayType.BAR]: <IconGraph key="bar" type="bar" />,
  [DisplayType.LINE]: <IconGraph key="line" type="line" />,
  [DisplayType.TABLE]: <IconTable key="table" />,
  [DisplayType.BIG_NUMBER]: <IconNumber key="number" />,
  [DisplayType.DETAILS]: <IconSettings key="details" />,
  [DisplayType.CATEGORICAL_BAR]: <IconGraph key="categorical_bar" type="bar" />,
  [DisplayType.TEXT]: <IconMarkdown key="text" />,
};

interface WidgetBuilderTypeSelectorProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

export function WidgetBuilderTypeSelector({
  error,
  setError,
}: WidgetBuilderTypeSelectorProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const config = getDatasetConfig(state.dataset);
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const organization = useOrganization();

  const hasDetailsWidget = organization.features.includes('dashboards-details-widget');
  const hasTextWidget = organization.features.includes('dashboards-text-widgets');
  // Use an array to define display type order explicitly.
  // Object key ordering in JS is technically specified but easy to break accidentally.
  const displayTypeOrder: Array<{
    details: string;
    label: string;
    type: DisplayType;
  }> = [
    {
      type: DisplayType.AREA,
      label: t('Area'),
      details: t('Compare relative contributions over time.'),
    },
    {
      type: DisplayType.BAR,
      label: t('Bar (Time Series)'),
      details: t('Compare one or more measurements over time using bars.'),
    },
    {
      type: DisplayType.CATEGORICAL_BAR,
      label: t('Bar (Categorical)'),
      details: t('Compare measurements across categories.'),
    },
    {
      type: DisplayType.LINE,
      label: t('Line'),
      details: t('Compare one or more measurements over time.'),
    },
    {
      type: DisplayType.TABLE,
      label: t('Table'),
      details: t('Display filtered fields and aggregations in a table.'),
    },
    {
      type: DisplayType.BIG_NUMBER,
      label: t('Big Number'),
      details: t('Show a single aggregated value over the selected time range.'),
    },
    ...(hasTextWidget
      ? [
          {
            type: DisplayType.TEXT,
            label: t('Text (Markdown)'),
            details: t('Display rich text and formatted markdown.'),
          },
        ]
      : []),
    ...(hasDetailsWidget
      ? [
          {
            type: DisplayType.DETAILS,
            label: t('Details'),
            details: t('Show a representative example of the filtered event data.'),
          },
        ]
      : []),
  ];

  // Issue series widgets query a different data source from table widgets.
  // Therefore we need to handle resetting the query on display type change due to incompatibility.
  const handleIssueWidgetDisplayTypeChange = (newValue: DisplayType) => {
    if (state.dataset === WidgetType.ISSUE && config.defaultSeriesWidgetQuery) {
      const newDisplayIsChart = usesTimeSeriesData(newValue);
      const oldDisplayIsChart = usesTimeSeriesData(state.displayType);
      if (newDisplayIsChart === oldDisplayIsChart) {
        // Data source does not change, so we just do a normal display type change.
        dispatch({
          type: BuilderStateAction.SET_DISPLAY_TYPE,
          payload: newValue,
        });
      } else {
        // Data source changed between table and series, so we need to reset the query.
        dispatch({
          type: BuilderStateAction.SET_STATE,
          payload: convertWidgetToBuilderState({
            widgetType: WidgetType.ISSUE,
            queries: [
              (newDisplayIsChart && config.defaultSeriesWidgetQuery) ||
                config.defaultWidgetQuery,
            ],
            displayType: newValue,
            interval: '',
            title: state.title ?? '',
          }),
        });
      }
    }
  };

  const handleTextWidgetDisplayTypeChange = (newValue: DisplayType) => {
    const defaultConfig = getDatasetConfig(state.dataset ?? WidgetType.ERRORS);
    dispatch({
      type: BuilderStateAction.SET_STATE,
      payload: convertWidgetToBuilderState({
        widgetType: state.dataset ?? WidgetType.ERRORS,
        queries: [
          (usesTimeSeriesData(newValue) && defaultConfig.defaultSeriesWidgetQuery) ||
            defaultConfig.defaultWidgetQuery,
        ],
        displayType: newValue,
        interval: '',
        title: state.title ?? '',
      }),
    });
  };

  return (
    <Fragment>
      <SectionHeader
        tooltipText={t('This is the type of visualization (ex. line chart)')}
        title={t('Type')}
      />
      <StyledFieldGroup
        error={error?.displayType}
        inline={false}
        flexibleControlStateSize
      >
        <CompactSelect
          value={state.displayType}
          options={displayTypeOrder.map(({type, label, details}) => ({
            leadingItems: DISPLAY_TYPE_ICONS[type],
            label,
            value: type,
            details,
            disabled:
              type !== DisplayType.TEXT && !config.supportedDisplayTypes.includes(type),
          }))}
          menuWidth={300}
          onChange={selection => {
            const newValue = selection.value;
            if (newValue === state.displayType) {
              return;
            }
            setError?.({...error, displayType: undefined});

            if (state.displayType === DisplayType.TEXT && newValue !== DisplayType.TEXT) {
              handleTextWidgetDisplayTypeChange(newValue);
            } else if (state.dataset === WidgetType.ISSUE) {
              handleIssueWidgetDisplayTypeChange(newValue);
            } else {
              dispatch({
                type: BuilderStateAction.SET_DISPLAY_TYPE,
                payload: newValue,
              });
              if (
                (newValue === DisplayType.TABLE || newValue === DisplayType.BIG_NUMBER) &&
                state.query?.length
              ) {
                dispatch({
                  type: BuilderStateAction.SET_QUERY,
                  payload: [state.query[0]!],
                });
              }
            }
            trackAnalytics('dashboards_views.widget_builder.change', {
              from: source,
              widget_type: state.dataset ?? '',
              builder_version: WidgetBuilderVersion.SLIDEOUT,
              field: 'displayType',
              value: newValue ?? '',
              new_widget: !isEditing,
              organization,
            });
          }}
        />
      </StyledFieldGroup>
    </Fragment>
  );
}

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
  border-bottom: none;
`;
