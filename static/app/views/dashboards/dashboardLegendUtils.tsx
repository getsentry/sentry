import type {Location} from 'history';

import type {Series} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {decodeList} from 'sentry/utils/queryString';

import {type DashboardDetails, DisplayType, type Widget} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
};

class DashboardLegendEncoderDecoder {
  dashboard: DashboardDetails | null;
  location: Location;
  organization: Organization;
  router: InjectedRouter;

  constructor(props: Props) {
    this.dashboard = props.dashboard;
    this.location = props.location;
    this.organization = props.organization;
    this.router = props.router;
  }

  // Updates legend param when a legend selection has been changed
  updateLegendQueryParam(selected: Record<string, boolean>, widget: Widget) {
    const [dashboard, location, organization, router] = [
      this.dashboard,
      this.location,
      this.organization,
      this.router,
    ];
    const widgets = dashboard ? dashboard.widgets : [];

    let newLegendQuery: string[];
    if (!location.query.unselectedSeries && widgets) {
      newLegendQuery = widgets
        .filter(dashboardWidget => this.widgetRequiresLegendUnselection(dashboardWidget))
        .map(dashboardWidget => {
          return dashboardWidget.id === widget.id
            ? this.encodeLegendQueryParam(widget, selected)
            : organization.features.includes('dashboards-releases-on-charts')
              ? this.formatLegendDefaultQuery(dashboardWidget.id)
              : `${widget.id}-`;
        });

      router.replace({
        // pathname: location.pathname,
        query: {
          ...location.query,
          unselectedSeries: newLegendQuery,
        },
      });
    } else if (Array.isArray(location.query.unselectedSeries)) {
      let isInQuery = false;
      newLegendQuery = location.query.unselectedSeries.map(widgetLegend => {
        if (widgetLegend.includes(widget.id!)) {
          isInQuery = true;
          // names of legend options are stored as seriesName:widgetId and are stored in
          // query param as widgetId-seriesName-seriesName2-...
          return this.encodeLegendQueryParam(widget, selected);
        }
        return widgetLegend;
      });

      !isInQuery
        ? router.replace({
            // pathname: location.pathname,
            query: {
              ...location.query,
              unselectedSeries: [
                ...location.query.unselectedSeries,
                this.encodeLegendQueryParam(widget, selected),
              ],
            },
          })
        : router.replace({
            // pathname: location.pathname,
            query: {
              ...location.query,
              unselectedSeries: newLegendQuery,
            },
          });
    } else {
      router.replace({
        // pathname: location.pathname,
        query: {
          ...location.query,
          unselectedSeries: [
            location.query.unselectedSeries,
            this.encodeLegendQueryParam(widget, selected),
          ],
        },
      });
    }
  }

  // sets unselected legend options by the legend query param
  getLegendUnselected(widget: Widget) {
    const location = this.location;

    return location.query.unselectedSeries
      ? this.decodeLegendQueryParam(widget)
      : this.widgetRequiresLegendUnselection(widget) &&
          this.organization.features.includes('dashboards-releases-on-charts')
        ? {[this.encodeSeriesNameForLegend('Releases', widget.id)]: false}
        : {};
  }

  widgetRequiresLegendUnselection(widget: Widget) {
    return (
      widget.displayType === DisplayType.AREA || widget.displayType === DisplayType.LINE
    );
  }

  formatLegendDefaultQuery(widgetId?: string) {
    return `${widgetId}-Releases`;
  }

  // going from selected to query param
  encodeLegendQueryParam(widget: Widget, selected: Record<string, boolean>) {
    return (
      widget.id +
      '-' +
      Object.keys(selected)
        .filter(key => !selected[key])
        .map(series => this.decodeSeriesNameForLegend(series))
        .join('-')
    );
  }

  // going from query param to selected
  decodeLegendQueryParam(widget: Widget) {
    const location = this.location;
    return decodeList(location.query.unselectedSeries).reduce((acc, legend) => {
      const legendValues = legend.split('-');
      const widgetId = legendValues[0];
      const seriesNames = legendValues.splice(1);
      if (widget.id === widgetId && seriesNames) {
        seriesNames.forEach(series => {
          if (series) {
            acc[this.encodeSeriesNameForLegend(series, widget.id)] = false;
          }
        });
      }
      return acc;
    }, {});
  }

  encodeSeriesNameForLegend(seriesName: string, widgetId?: string) {
    return `${seriesName}:${widgetId}`;
  }

  decodeSeriesNameForLegend(encodedSeriesName: string) {
    return encodedSeriesName.split(':')[0];
  }

  // change timeseries names to SeriesName:widgetID
  modifyTimeseriesNames(widget: Widget, timeseriesResults?: Series[]) {
    return timeseriesResults
      ? timeseriesResults.map(series => {
          return {
            ...series,
            seriesName: this.encodeSeriesNameForLegend(series.seriesName, widget.id),
          };
        })
      : [];
  }

  // when a widget has been changed/added/deleted update legend to incorporate that
  updatedLegendQueryOnWidgetChange(newDashboard: DashboardDetails) {
    const [organization, location] = [this.organization, this.location];
    if (
      organization.features.includes('dashboards-releases-on-charts') &&
      !location.query.unselectedSeries
    ) {
      return location.query.unselectedSeries;
    }

    return organization.features.includes('dashboards-releases-on-charts')
      ? newDashboard.widgets
          .filter(widget => this.widgetRequiresLegendUnselection(widget))
          .map(widget => {
            const widgetRegex = new RegExp(`/^${widget.id}-.*`);
            const widgetIdMatches = Array.isArray(location.query.unselectedSeries)
              ? location.query.unselectedSeries.filter(legend => widgetRegex.test(legend))
              : [location.query.unselectedSeries].filter(legend =>
                  legend ? widgetRegex.test(legend) : false
                );
            if (widgetIdMatches.length) {
              return widgetIdMatches[0];
            }
            return this.formatLegendDefaultQuery(widget.id);
          })
      : location.query.unselectedSeries;
  }
}

export default DashboardLegendEncoderDecoder;
