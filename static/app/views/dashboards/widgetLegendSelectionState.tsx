import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {decodeList} from 'sentry/utils/queryString';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {hasTimeseriesVisualizationFeature} from 'sentry/views/dashboards/utils/useTimeseriesVisualizationEnabled';
import {widgetCanUseTimeSeriesVisualization} from 'sentry/views/dashboards/utils/widgetCanUseTimeSeriesVisualization';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import {DisplayType, type DashboardDetails, type Widget} from './types';

type Props = {
  dashboard: DashboardDetails | null;
  location: Location;
  navigate: ReactRouter3Navigate;
  organization: Organization;
};

type LegendSelection = Record<string, boolean>;

const SERIES_LIST_DELIMITER = ',';
const WIDGET_ID_DELIMITER = ':';

const SERIES_NAME_DELIMITER = '|~|';

class WidgetLegendSelectionState {
  dashboard: DashboardDetails | null;
  location: Location;
  organization: Organization;
  navigate: ReactRouter3Navigate;

  constructor(props: Props) {
    this.dashboard = props.dashboard;
    this.location = props.location;
    this.organization = props.organization;
    this.navigate = props.navigate;
  }

  // Updates legend param when a legend selection has been changed
  setWidgetSelectionState(selected: LegendSelection, widget: Widget) {
    const [dashboard, location, navigate] = [
      this.dashboard,
      this.location,
      this.navigate,
    ];
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

      const showReleaseByDefault = this.shouldShowReleaseByDefault(widget);
      const releasesKey = `Releases${SERIES_NAME_DELIMITER}${widget.id}`;

      const releasesSelectionDiffersFromDefault =
        releasesKey in selected && selected[releasesKey] !== showReleaseByDefault;

      const thisWidgetWithoutReleasesWasSelected =
        !(releasesKey in selected) &&
        Object.values(selected).filter(value => value === showReleaseByDefault).length ===
          1;

      if (releasesSelectionDiffersFromDefault || thisWidgetWithoutReleasesWasSelected) {
        navigate(
          {
            ...location,
            query: {
              ...location.query,
              unselectedSeries: newLegendQuery,
            },
          },
          {replace: true, preventScrollReset: true}
        );
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

      const unselectedSeries = isInQuery
        ? newLegendQuery
        : [
            ...location.query.unselectedSeries,
            this.encodeLegendQueryParam(widget, selected),
          ];
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            unselectedSeries,
          },
        },
        {replace: true, preventScrollReset: true}
      );
    } else {
      if (location.query.unselectedSeries?.includes(widget.id!)) {
        navigate(
          {
            ...location,
            query: {
              ...location.query,
              unselectedSeries: [this.encodeLegendQueryParam(widget, selected)],
            },
          },
          {replace: true, preventScrollReset: true}
        );
      } else {
        navigate(
          {
            ...location,
            query: {
              ...location.query,
              unselectedSeries: [
                location.query.unselectedSeries,
                this.encodeLegendQueryParam(widget, selected),
              ],
            },
          },
          {replace: true, preventScrollReset: true}
        );
      }
    }
  }

  shouldShowReleaseByDefault(widget: Widget) {
    return (
      hasTimeseriesVisualizationFeature(this.organization) &&
      widgetCanUseTimeSeriesVisualization(widget)
    );
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
            )]: this.shouldShowReleaseByDefault(widget),
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
    const shouldHideReleasesByDefault =
      this.widgetRequiresLegendUnselection(widget) &&
      !this.shouldShowReleaseByDefault(widget);
    return shouldHideReleasesByDefault
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
            WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(series, true)
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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
