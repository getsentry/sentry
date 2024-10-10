import type {Location} from 'history';

import type {Series} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {decodeList} from 'sentry/utils/queryString';

import {type DashboardDetails, DisplayType, type Widget} from '../types';

class WidgetLegendFunctions {
  // Updates legend param when a legend selection has been changed
  updateLegendQueryParam(
    selected: Record<string, boolean>,
    location: Location,
    widget: Widget,
    router: InjectedRouter,
    queryField: string,
    organization: Organization,
    widgets?: Widget[]
  ) {
    let newLegendQuery: string[];
    if (!location.query[queryField] && widgets && queryField === 'unselectedSeries') {
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
        pathname: location.pathname,
        query: {
          ...location.query,
          [queryField]: newLegendQuery,
        },
      });
    } else if (!location.query[queryField] && queryField === 'legend') {
      router.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          [queryField]: this.encodeLegendQueryParam(widget, selected),
        },
      });
    } else if (Array.isArray(location.query[queryField])) {
      let isInQuery = false;
      newLegendQuery = location.query[queryField].map(widgetLegend => {
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
            pathname: location.pathname,
            query: {
              ...location.query,
              [queryField]: [
                ...location.query[queryField],
                this.encodeLegendQueryParam(widget, selected),
              ],
            },
          })
        : router.replace({
            pathname: location.pathname,
            query: {
              ...location.query,
              [queryField]: newLegendQuery,
            },
          });
    } else {
      router.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          [queryField]: [
            location.query[queryField],
            this.encodeLegendQueryParam(widget, selected),
          ],
        },
      });
    }
  }

  // sets unselected legend options by the legend query param
  getLegendUnselected(location: Location, widget: Widget, queryField: string) {
    return location.query[queryField]
      ? this.decodeLegendQueryParam(location, widget, queryField)
      : this.widgetRequiresLegendUnselection(widget)
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
  decodeLegendQueryParam(location: Location, widget: Widget, queryField: string) {
    return decodeList(location.query[queryField]).reduce((acc, legend) => {
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
  updatedLegendQueryOnWidgetChange(
    organization: Organization,
    newDashboard: DashboardDetails,
    location: Location
  ) {
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

export default WidgetLegendFunctions;
