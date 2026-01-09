import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Select} from 'sentry/components/core/select';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {IconGraph, IconNumber, IconSettings, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';

const typeIcons = {
  [DisplayType.AREA]: <IconGraph key="area" type="area" />,
  [DisplayType.BAR]: <IconGraph key="bar" type="bar" />,
  [DisplayType.LINE]: <IconGraph key="line" type="line" />,
  [DisplayType.TABLE]: <IconTable key="table" />,
  [DisplayType.BIG_NUMBER]: <IconNumber key="number" />,
  [DisplayType.DETAILS]: <IconSettings key="details" />,
};

const BASE_DISPLAY_TYPES: Partial<Record<DisplayType, string>> = {
  [DisplayType.AREA]: t('Area'),
  [DisplayType.BAR]: t('Bar'),
  [DisplayType.LINE]: t('Line'),
  [DisplayType.TABLE]: t('Table'),
  [DisplayType.BIG_NUMBER]: t('Big Number'),
} as const;

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
      isChartDisplayType(value)
    );
  };

  const displayTypes = {...BASE_DISPLAY_TYPES};
  if (organization.features.includes('dashboards-details-widget')) {
    displayTypes[DisplayType.DETAILS] = t('Details');
  }

  // Issue series widgets query a different data source from table widgets.
  // Therefore we need to handle resetting the query on display type change due to incompatibility.
  const handleIssueWidgetDisplayTypeChange = (newValue: DisplayType) => {
    if (state.dataset === WidgetType.ISSUE && config.defaultSeriesWidgetQuery) {
      const newDisplayIsChart = isChartDisplayType(newValue);
      const oldDisplayIsChart = isChartDisplayType(state.displayType);
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
          options={Object.keys(displayTypes).map(value => ({
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            leadingItems: typeIcons[value],
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            label: displayTypes[value],
            value,
            disabled:
              !config.supportedDisplayTypes.includes(value as DisplayType) ||
              shouldDisabledIssueDisplayType(value as DisplayType),
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
