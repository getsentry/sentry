import {useCallback, useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {MRI, Organization, PageFilters} from 'sentry/types';
import {
  emptyWidget,
  MetricDisplayType,
  MetricWidgetQueryParams,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {AugmentedEChartDataZoomHandler} from 'sentry/views/dashboards/widgetCard/chart';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {InlineEditor} from 'sentry/views/dashboards/widgetCard/metricWidgetCard/inlineEditor';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {MetricWidgetBody} from 'sentry/views/ddm/widget';

import {convertToDashboardWidget} from '../../../../utils/metrics/dashboard';
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

export function defaultMetricWidget(selection) {
  return convertToDashboardWidget({...selection, ...emptyWidget}, MetricDisplayType.LINE);
}

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
  const query = widget.queries[0];
  const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};

  const [metricWidgetQueryParams, setMetricWidgetQueryParams] =
    useState<MetricWidgetQueryParams>({
      mri: parsed.mri,
      op: parsed.op,
      query: query.conditions,
      groupBy: query.columns,
      title: widget.title,
      displayType: toMetricDisplayType(widget.displayType),
    });

  const handleChange = useCallback((data: Partial<MetricWidgetQueryParams>) => {
    setMetricWidgetQueryParams(curr => ({
      ...curr,
      ...data,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      {...selection, ...metricWidgetQueryParams},
      toMetricDisplayType(widget.displayType)
    );

    const title = stringifyMetricWidget(metricWidgetQueryParams);

    const updatedWidget = {
      ...widget,
      title,
      queries: convertedWidget.queries,
    };

    onUpdate?.(updatedWidget);
  }, [metricWidgetQueryParams, onUpdate, widget, selection]);

  const handleCancel = useCallback(() => {
    onUpdate?.(null);
  }, [onUpdate]);

  if (!parsed) {
    return (
      <ErrorPanel height="200px">
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  return (
    <DashboardsMEPContext.Provider
      value={{
        isMetricsData: undefined,
        setIsMetricsData: () => {},
      }}
    >
      <WidgetCardPanel isDragging={false}>
        <WidgetHeaderWrapper>
          <WidgetHeaderDescription>
            <WidgetTitleRow>
              <InlineEditor
                isEdit={!!isEditingWidget}
                displayType={toMetricDisplayType(widget.displayType)}
                metricsQuery={metricWidgetQueryParams}
                projects={selection.projects}
                powerUserMode={false}
                onChange={handleChange}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </WidgetTitleRow>
          </WidgetHeaderDescription>
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

        <MetricWidgetBody
          widgetIndex={0}
          focusArea={null}
          datetime={selection.datetime}
          projects={selection.projects}
          environments={selection.environments}
          onChange={() => {}}
          mri={metricWidgetQueryParams.mri}
          op={metricWidgetQueryParams.op}
          query={metricWidgetQueryParams.query}
          groupBy={metricWidgetQueryParams.groupBy}
          displayType={metricWidgetQueryParams.displayType as any as MetricDisplayType}
        />
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
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
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  ${p => p.theme.overflowEllipsis};
`;

function toMetricDisplayType(displayType: string): MetricDisplayType {
  if (Object.values(MetricDisplayType).includes(displayType as MetricDisplayType)) {
    return displayType as MetricDisplayType;
  }
  return MetricDisplayType.LINE;
}
