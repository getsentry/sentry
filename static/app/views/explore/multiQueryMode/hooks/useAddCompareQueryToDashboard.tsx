import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';
import {MAX_NUM_Y_AXES} from 'sentry/views/dashboards/widgetBuilder/buildSteps/yAxisStep/yAxisSelector';
import {handleAddQueryToDashboard} from 'sentry/views/discover/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  getQueryMode,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';

export function useAddCompareQueryToDashboard(query: ReadableExploreQueryParts) {
  const organization = useOrganization();
  const hasWidgetBuilderRedesign = organization.features.includes(
    'dashboards-widget-builder-redesign'
  );
  const {selection} = usePageFilters();
  const location = useLocation();
  const router = useRouter(); // required for handleAddQueryToDashboard

  const yAxes = query.yAxes.slice(0, MAX_NUM_Y_AXES);
  const groupBys = query.groupBys;
  const mode = getQueryMode(groupBys);
  const sortBys = query.sortBys;
  const qs = query.query;
  const queryFields = query.fields;

  const getEventView = useCallback(() => {
    let fields: any;
    if (mode === Mode.SAMPLES) {
      if (hasWidgetBuilderRedesign) {
        // TODO: Handle the fields for the widget builder if we've selected the samples mode
        fields = [];
      } else {
        fields = queryFields.filter(Boolean);
      }
    } else {
      fields = [
        ...new Set([...groupBys, ...yAxes, ...sortBys.map(sort => sort.field)]),
      ].filter(Boolean);
    }

    const search = new MutableSearch(qs);

    const discoverQuery: NewQuery = {
      name: t('Custom Widget'),
      fields,
      orderby: sortBys.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
      yAxis: yAxes,
    };

    const newEventView = EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
    newEventView.dataset = DiscoverDatasets.SPANS_EAP_RPC;
    return newEventView;
  }, [
    groupBys,
    hasWidgetBuilderRedesign,
    mode,
    qs,
    queryFields,
    selection,
    sortBys,
    yAxes,
  ]);

  const addToDashboard = useCallback(() => {
    const eventView = getEventView();

    handleAddQueryToDashboard({
      organization,
      location,
      eventView,
      router,
      yAxis: eventView.yAxis,
      widgetType: WidgetType.SPANS,
      source: DashboardWidgetSource.TRACE_EXPLORER,
    });
  }, [organization, location, getEventView, router]);

  return {
    addToDashboard,
  };
}
