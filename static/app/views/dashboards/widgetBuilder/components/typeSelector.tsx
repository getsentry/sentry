import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {IconGraph, IconNumber, IconSettings, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

const typeIcons: Partial<Record<DisplayType, React.ReactNode>> = {
  [DisplayType.AREA]: <IconGraph key="area" type="area" />,
  [DisplayType.BAR]: <IconGraph key="bar" type="bar" />,
  [DisplayType.LINE]: <IconGraph key="line" type="line" />,
  [DisplayType.TABLE]: <IconTable key="table" />,
  [DisplayType.BIG_NUMBER]: <IconNumber key="number" />,
  [DisplayType.DETAILS]: <IconSettings key="details" />,
  [DisplayType.CATEGORICAL_BAR]: <IconGraph key="categorical_bar" type="bar" />,
};

interface WidgetBuilderTypeSelectorProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

function WidgetBuilderTypeSelector({error, setError}: WidgetBuilderTypeSelectorProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  const config = getDatasetConfig(state.dataset);
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const organization = useOrganization();

  const allowIssueWidgetSeriesDisplayType = organization.features.includes(
    'dashboards-issue-widget-series-display-type'
  );

  const shouldDisabledIssueDisplayType = (value: DisplayType) => {
    return (
      state.dataset === WidgetType.ISSUE &&
      !allowIssueWidgetSeriesDisplayType &&
      usesTimeSeriesData(value)
    );
  };

  const hasDetailsWidget = organization.features.includes('dashboards-details-widget');
  const hasCategoricalBar = organization.features.includes(
    'dashboards-categorical-bar-charts'
  );

  // Use an array to define display type order explicitly.
  // Object key ordering in JS is technically specified but easy to break accidentally.
  const displayTypeOrder: Array<{label: string; type: DisplayType}> = [
    {type: DisplayType.AREA, label: t('Area')},
    {type: DisplayType.BAR, label: hasCategoricalBar ? t('Bar (Time Series)') : t('Bar')},
    ...(hasCategoricalBar
      ? [{type: DisplayType.CATEGORICAL_BAR, label: t('Bar (Categorical)')}]
      : []),
    {type: DisplayType.LINE, label: t('Line')},
    {type: DisplayType.TABLE, label: t('Table')},
    {type: DisplayType.BIG_NUMBER, label: t('Big Number')},
    ...(hasDetailsWidget ? [{type: DisplayType.DETAILS, label: t('Details')}] : []),
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
          payload: convertWidgetToBuilderStateParams({
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
        <Select
          name="displayType"
          value={state.displayType}
          options={displayTypeOrder.map(({type, label}) => ({
            leadingItems: typeIcons[type],
            label,
            value: type,
            disabled:
              !config.supportedDisplayTypes.includes(type) ||
              shouldDisabledIssueDisplayType(type),
          }))}
          clearable={false}
          onChange={(newValue: any) => {
            if (newValue?.value === state.displayType) {
              return;
            }
            setError?.({...error, displayType: undefined});

            if (state.dataset === WidgetType.ISSUE) {
              handleIssueWidgetDisplayTypeChange(newValue?.value);
            } else {
              dispatch({
                type: BuilderStateAction.SET_DISPLAY_TYPE,
                payload: newValue?.value,
              });
              if (
                (newValue.value === DisplayType.TABLE ||
                  newValue.value === DisplayType.BIG_NUMBER) &&
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
              value: newValue?.value ?? '',
              new_widget: !isEditing,
              organization,
            });
          }}
          components={{
            SingleValue: (containerProps: any) => {
              return (
                <components.SingleValue {...containerProps}>
                  <Flex gap="md">
                    {containerProps.data.leadingItems}
                    {containerProps.children}
                  </Flex>
                </components.SingleValue>
              );
            },
          }}
        />
      </StyledFieldGroup>
    </Fragment>
  );
}

export default WidgetBuilderTypeSelector;

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
`;
