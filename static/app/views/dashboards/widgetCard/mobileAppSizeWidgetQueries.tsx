import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useIsWidgetInViewport} from 'sentry/views/dashboards/contexts/widgetViewportContext';
import {MobileAppSizeConfig} from 'sentry/views/dashboards/datasetConfig/mobileAppSize';
import {useDashboardSamplingMode} from 'sentry/views/dashboards/hooks/useDashboardQueryPriority';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';

import type {GenericWidgetQueriesResult} from './genericWidgetQueries';

type MobileAppSizeWidgetQueriesProps = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  selection?: PageFilters;
  widgetInterval?: string;
};

export function MobileAppSizeWidgetQueries({
  children,
  widget,
  dashboardFilters,
  selection: propsSelection,
  widgetInterval,
}: MobileAppSizeWidgetQueriesProps) {
  const organization = useOrganization();
  const hookPageFilters = usePageFilters();
  const pageFilters = propsSelection ?? hookPageFilters.selection;
  const samplingMode = useDashboardSamplingMode(undefined);
  const isInViewport = useIsWidgetInViewport();

  const result = MobileAppSizeConfig.useSeriesQuery!({
    widget,
    organization,
    pageFilters,
    dashboardFilters,
    enabled: isInViewport,
    samplingMode,
    widgetInterval,
  });

  return getDynamicText({
    value: children(result),
    fixed: <div />,
  });
}
