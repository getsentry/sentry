import type {PageFilters} from 'sentry/types/core';
import getDynamicText from 'sentry/utils/getDynamicText';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MobileAppSizeConfig} from 'sentry/views/dashboards/datasetConfig/mobileAppSize';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';

import type {GenericWidgetQueriesResult} from './genericWidgetQueries';

type MobileAppSizeWidgetQueriesProps = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  selection?: PageFilters;
};

function MobileAppSizeWidgetQueries({
  children,
  widget,
  dashboardFilters,
  selection: propsSelection,
}: MobileAppSizeWidgetQueriesProps) {
  const organization = useOrganization();
  const hookPageFilters = usePageFilters();
  const pageFilters = propsSelection ?? hookPageFilters.selection;

  const result = MobileAppSizeConfig.useSeriesQuery!({
    widget,
    organization,
    pageFilters,
    dashboardFilters,
    enabled: true,
  });

  return getDynamicText({
    value: children(result),
    fixed: <div />,
  });
}

export default MobileAppSizeWidgetQueries;
