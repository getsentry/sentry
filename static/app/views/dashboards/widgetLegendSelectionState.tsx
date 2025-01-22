import type {Location} from 'history';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {decodeList} from 'sentry/utils/queryString';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import {type DashboardDetails, DisplayType, type Widget} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
};

type LegendSelection = Record<string, boolean>;

const SERIES_LIST_DELIMITER = ',';
const WIDGET_ID_DELIMITER = ':';

const SERIES_NAME_DELIMITER = ';';

class WidgetLegendSelectionState {
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
  setWidgetSelectionState(selected: LegendSelection, widget: Widget) {
    const [dashboard, location, router] = [this.dashboard, this.location, this.router];
    const widgets = dashboard ? dashboard.widgets : [];
    let newLegendQuery: string[];
    if (!location.query.unselectedSeries && widgets) {
      newLegendQuery = widgets
        .filter(dashboardWidget => this.widgetIsChart(dashboardWidget))
        .map(dashboardWidget => {
          return dashboardWidget.id === widget.id
            ? this.encodeLegendQueryParam(widget, selected)
            : this.formatLegendDefaultQuery(dashboardWidget);
        })
        .filter(unselectedSeries => unselectedSeries !== undefined);

      const thisWidgetWithReleasesWasSelected =
        Object.values(selected).filter(value => value === false).length !== 1 &&
        Object.keys(selected).includes(`Releases${SERIES_NAME_DELIMITER}${widget.id}`);

      const thisWidgetWithoutReleasesWasSelected =
        !Object.keys(selected).includes(`Releases${SERIES_NAME_DELIMITER}${widget.id}`) &&
        Object.values(selected).filter(value => value === false).length === 1;

      if (thisWidgetWithReleasesWasSelected || thisWidgetWithoutReleasesWasSelected) {
        router.replace({
          query: {
            ...location.query,
            unselectedSeries: newLegendQuery,
          },
        });
      }
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

      if (isInQuery) {
        router.replace({
          query: {
            ...location.query,
            unselectedSeries: newLegendQuery,
          },
        });
      } else {
        router.replace({
          query: {
            ...location.query,
            unselectedSeries: [
              ...location.query.unselectedSeries,
              this.encodeLegendQueryParam(widget, selected),
            ],
          },
        });
      }
    } else {
      if (location.query.unselectedSeries?.includes(widget.id!)) {
        router.replace({
          query: {
            ...location.query,
            unselectedSeries: [this.encodeLegendQueryParam(widget, selected)],
          },
        });
      } else {
        router.replace({
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
  }

  // sets unselected legend options by the legend query param
  getWidgetSelectionState(widget: Widget): LegendSelection {
    const location = this.location;

    return location.query.unselectedSeries
      ? this.decodeLegendQueryParam(widget)
      : this.widgetRequiresLegendUnselection(widget)
        ? {
            [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend(
              'Releases',
              widget.id
            )]: false,
          }
        : {};
  }

  widgetRequiresLegendUnselection(widget: Widget) {
    return (
      widget.displayType === DisplayType.AREA || widget.displayType === DisplayType.LINE
    );
  }

  widgetIsChart(widget: Widget) {
    return (
      widget.displayType === DisplayType.AREA ||
      widget.displayType === DisplayType.LINE ||
      widget.displayType === DisplayType.BAR ||
      widget.displayType === DisplayType.TOP_N
    );
  }

  formatLegendDefaultQuery(widget: Widget) {
    return this.widgetRequiresLegendUnselection(widget)
      ? `${widget.id}${WIDGET_ID_DELIMITER}Releases`
      : undefined;
  }

  // going from selected to query param
  encodeLegendQueryParam(widget: Widget, selected: LegendSelection) {
    return (
      widget.id +
      WIDGET_ID_DELIMITER +
      Object.keys(selected)
        .filter(key => !selected[key])
        .map(series =>
          encodeURIComponent(
            WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(series)!
          )
        )
        .join(SERIES_LIST_DELIMITER)
    );
  }

  // going from query param to selected
  decodeLegendQueryParam(widget: Widget) {
    const location = this.location;

    const widgetLegendString = decodeList(location.query.unselectedSeries).find(
      widgetLegend => widgetLegend.includes(widget.id!)
    );
    if (widgetLegendString) {
      const [_, seriesNameString] = widgetLegendString.split(WIDGET_ID_DELIMITER);
      const seriesNames = seriesNameString!.split(SERIES_LIST_DELIMITER);
      return seriesNames.reduce((acc, series) => {
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[
          decodeURIComponent(
            WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend(series, widget.id)
          )
        ] = false;
        return acc;
      }, {});
    }
    return {};
  }

  // when a widget has been changed/added/deleted update legend to incorporate that
  setMultipleWidgetSelectionStateURL(newDashboard: DashboardDetails, newWidget?: Widget) {
    const location = this.location;
    if (!location.query.unselectedSeries) {
      return location.query.unselectedSeries;
    }

    // if widget was updated it returns updated widget to default selection state
    if (newWidget && newDashboard.widgets.includes(newWidget)) {
      const formattedDefaultQuery = this.formatLegendDefaultQuery(newWidget);

      const newQuery = Array.isArray(location.query.unselectedSeries)
        ? location.query.unselectedSeries
            .map(legend => {
              if (legend.includes(newWidget.id!)) {
                return this.formatLegendDefaultQuery(newWidget);
              }
              return legend;
            })
            .filter(Boolean)
        : location.query.unselectedSeries.includes(newWidget.id!)
          ? formattedDefaultQuery
          : [location.query.unselectedSeries, formattedDefaultQuery].filter(Boolean);

      return newQuery;
    }

    // if widget was deleted it removes it from the selection query (clean up the url)
    if (newWidget) {
      return Array.isArray(location.query.unselectedSeries)
        ? location.query.unselectedSeries
            .map(legend => {
              if (legend.includes(newWidget.id!)) {
                return undefined;
              }
              return legend;
            })
            .filter(Boolean)
        : location.query.unselectedSeries.includes(newWidget.id!)
          ? []
          : location.query.unselectedSeries;
    }

    // widget added (since added widgets don't have an id until submitted), it sets selection state based on all widgets
    const unselectedSeries = newDashboard.widgets
      .map(widget => {
        if (Array.isArray(location.query.unselectedSeries)) {
          const widgetLegendQuery = location.query.unselectedSeries.find(legend =>
            legend.includes(widget.id!)
          );
          if (!widgetLegendQuery && this.widgetRequiresLegendUnselection(widget)) {
            return this.formatLegendDefaultQuery(widget);
          }
          return widgetLegendQuery;
        }
        return location.query.unselectedSeries?.includes(widget.id!)
          ? location.query.unselectedSeries
          : this.formatLegendDefaultQuery(widget);
      })
      .filter(Boolean);
    return unselectedSeries;
  }
}

export default WidgetLegendSelectionState;
