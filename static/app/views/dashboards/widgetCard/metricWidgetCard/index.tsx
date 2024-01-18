import {useCallback, useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import TextOverflow from 'sentry/components/textOverflow';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {MRI, Organization, PageFilters} from 'sentry/types';
import {MetricWidgetQueryParams, stringifyMetricWidget} from 'sentry/utils/metrics';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {AugmentedEChartDataZoomHandler} from 'sentry/views/dashboards/widgetCard/chart';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {InlineEditor} from 'sentry/views/dashboards/widgetCard/metricWidgetCard/inlineEditor';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {MetricWidgetBody} from 'sentry/views/ddm/widget';

import {
  convertToDashboardWidget,
  toMetricDisplayType,
} from '../../../../utils/metrics/dashboard';
import {parseField} from '../../../../utils/metrics/mri';
import {Widget} from '../../types';

type Props = {
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: (index: string) => void;
  onUpdate?: (widget: Widget | null) => void;
  onZoom?: AugmentedEChartDataZoomHandler;
  showSlider?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function MetricWidgetCard({
  organization,
  selection,
  widget,
  isEditingWidget,
  isEditingDashboard,
  onEdit,
  onUpdate,
  onDelete,
  onDuplicate,
  location,
  router,
  index,
}: Props) {
  const [metricWidgetQueryParams, setMetricWidgetQueryParams] =
    useState<MetricWidgetQueryParams>(convertFromWidget(widget));

  const handleChange = useCallback(
    (data: Partial<MetricWidgetQueryParams>) => {
      setMetricWidgetQueryParams(curr => ({
        ...curr,
        ...data,
      }));
    },
    [setMetricWidgetQueryParams]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      {...selection, ...metricWidgetQueryParams},
      toMetricDisplayType(metricWidgetQueryParams.displayType)
    );

    const title = stringifyMetricWidget(metricWidgetQueryParams);

    const updatedWidget = {
      ...widget,
      title,
      queries: convertedWidget.queries,
      displayType: convertedWidget.displayType,
    };

    onUpdate?.(updatedWidget);
  }, [metricWidgetQueryParams, onUpdate, widget, selection]);

  const handleCancel = useCallback(() => {
    onUpdate?.(null);
  }, [onUpdate]);

  if (!metricWidgetQueryParams.mri) {
    return (
      <ErrorPanel height="200px">
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  const stringifiedMetricWidget =
    widget.title ?? stringifyMetricWidget(metricWidgetQueryParams);

  return (
    <DashboardsMEPContext.Provider
      value={{
        isMetricsData: undefined,
        setIsMetricsData: () => {},
      }}
    >
      <WidgetCardPanel isDragging={false}>
        <WidgetHeaderWrapper>
          {isEditingWidget ? (
            <InlineEditor
              isEdit={!!isEditingWidget}
              displayType={metricWidgetQueryParams.displayType}
              metricsQuery={metricWidgetQueryParams}
              projects={selection.projects}
              powerUserMode={false}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          ) : (
            <WidgetHeaderDescription>
              <WidgetTitleRow>
                <WidgetTitle>
                  <TextOverflow>{stringifiedMetricWidget}</TextOverflow>
                </WidgetTitle>
              </WidgetTitleRow>
            </WidgetHeaderDescription>
          )}

          <ContextMenuWrapper>
            {!isEditingDashboard && (
              <WidgetCardContextMenu
                organization={organization}
                widget={widget}
                selection={selection}
                showContextMenu
                isPreview={false}
                widgetLimitReached={false}
                onEdit={() => index && onEdit?.(index)}
                router={router}
                location={location}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
              />
            )}
          </ContextMenuWrapper>
        </WidgetHeaderWrapper>
        <MetricWidgetChartWrapper>
          <MetricWidgetChartContainer
            selection={selection}
            widget={widget}
            editorParams={metricWidgetQueryParams}
          />
        </MetricWidgetChartWrapper>
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
}

type MetricWidgetChartContainerProps = {
  selection: PageFilters;
  widget: Widget;
  editorParams?: Partial<MetricWidgetQueryParams>;
};

export function MetricWidgetChartContainer({
  selection,
  widget,
  editorParams = {},
}: MetricWidgetChartContainerProps) {
  const metricWidgetQueryParams = {
    ...convertFromWidget(widget),
    ...editorParams,
  };

  return (
    <MetricWidgetBody
      widgetIndex={0}
      focusArea={null}
      datetime={selection.datetime}
      projects={selection.projects}
      environments={selection.environments}
      mri={metricWidgetQueryParams.mri}
      op={metricWidgetQueryParams.op}
      query={metricWidgetQueryParams.query}
      groupBy={metricWidgetQueryParams.groupBy}
      displayType={toMetricDisplayType(metricWidgetQueryParams.displayType)}
    />
  );
}

function convertFromWidget(widget: Widget): MetricWidgetQueryParams {
  const query = widget.queries[0];
  const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};

  return {
    mri: parsed.mri,
    op: parsed.op,
    query: query.conditions,
    groupBy: query.columns,
    title: widget.title,
    displayType: toMetricDisplayType(widget.displayType),
  };
}

const WidgetHeaderWrapper = styled('div')`
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const ContextMenuWrapper = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
`;

const WidgetHeaderDescription = styled('div')`
  ${p => p.theme.overflowEllipsis};
  overflow-y: visible;
`;

const WidgetTitle = styled(HeaderTitle)`
  padding-left: ${space(3)};
  padding-top: ${space(2)};
  padding-right: ${space(1)};
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const MetricWidgetChartWrapper = styled('div')`
  height: 100%;
  width: 100%;
  padding: ${space(2)};
`;
