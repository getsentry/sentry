import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {
  applyQueryParamsUpdates,
  loadQueryParamsFromLocation,
} from 'sentry/views/explore/queryParams/parsers';

import {widgetCanUseTimeSeriesVisualization} from './utils/widgetCanUseTimeSeriesVisualization';
import {DisplayType, type DashboardDetails, type Widget} from './types';
import {WidgetLegendNameEncoderDecoder} from './widgetLegendNameEncoderDecoder';

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

const legendQueryParsers = {unselectedSeries: parseAsStringArray};

export class WidgetLegendSelectionState {
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
    const currentUnselectedSeries = this.getUnselectedSeries();
    const navigateWithUnselectedSeries = (unselectedSeries: string[]) =>
      navigate(
        applyQueryParamsUpdates(legendQueryParsers, location, {unselectedSeries}),
        {
          replace: true,
          preventScrollReset: true,
        }
      );

    if (!currentUnselectedSeries.length && widgets) {
      const newLegendQuery = widgets
        .filter(dashboardWidget => this.widgetIsChart(dashboardWidget))
        .map(dashboardWidget => {
          return dashboardWidget.id === widget.id
            ? this.encodeLegendQueryParam(widget, selected)
            : this.formatLegendDefaultQuery(dashboardWidget);
        })
        .filter(unselectedSeries => unselectedSeries !== undefined);

      const thisWidgetWithReleasesWasSelected =
        Object.values(selected).filter(value => !value).length !== 1 &&
        Object.keys(selected).includes(
          `${t('Releases')}${SERIES_NAME_DELIMITER}${widget.id}`
        );

      const thisWidgetWithoutReleasesWasSelected =
        !Object.keys(selected).includes(
          `${t('Releases')}${SERIES_NAME_DELIMITER}${widget.id}`
        ) && Object.values(selected).filter(value => !value).length === 1;

      // For new-path widgets the default is nothing hidden, so any toggle
      // should update the URL. The two conditions above only cover old-path
      // widgets where Releases-hidden was the implicit default state.
      if (
        thisWidgetWithReleasesWasSelected ||
        thisWidgetWithoutReleasesWasSelected ||
        !this.widgetRequiresLegendUnselection(widget)
      ) {
        navigateWithUnselectedSeries(newLegendQuery);
      }
    } else {
      let isInQuery = false;
      const newLegendQuery = currentUnselectedSeries.map(widgetLegend => {
        if (widgetLegend.includes(widget.id!)) {
          isInQuery = true;
          // names of legend options are stored as seriesName:widgetId and are stored in
          // query param as widgetId-seriesName-seriesName2-...
          return this.encodeLegendQueryParam(widget, selected);
        }
        return widgetLegend;
      });

      navigateWithUnselectedSeries(
        isInQuery
          ? newLegendQuery
          : [...currentUnselectedSeries, this.encodeLegendQueryParam(widget, selected)]
      );
    }
  }

  // sets unselected legend options by the legend query param
  getWidgetSelectionState(widget: Widget): LegendSelection {
    return this.getUnselectedSeries().length
      ? this.decodeLegendQueryParam(widget)
      : this.widgetRequiresLegendUnselection(widget)
        ? {
            [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend(
              t('Releases'),
              widget.id
            )]: false,
          }
        : {};
  }

  widgetRequiresLegendUnselection(widget: Widget) {
    // The new chart path renders releases as bubble markers that don't
    // clutter the chart, so there's no need to hide them by default.
    if (widgetCanUseTimeSeriesVisualization(widget)) {
      return false;
    }

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
      ? `${widget.id}${WIDGET_ID_DELIMITER}${t('Releases')}`
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
    const widgetLegendString = this.getUnselectedSeries().find(widgetLegend =>
      widgetLegend.includes(widget.id!)
    );
    if (widgetLegendString) {
      const [_, seriesNameString] = widgetLegendString.split(WIDGET_ID_DELIMITER);
      if (!seriesNameString) {
        return {};
      }
      const seriesNames = seriesNameString.split(SERIES_LIST_DELIMITER);
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
  setMultipleWidgetSelectionStateURL(newDashboard: DashboardDetails) {
    const currentUnselectedSeries = this.getUnselectedSeries();
    if (!currentUnselectedSeries.length) {
      return;
    }

    // widget added (since added widgets don't have an id until submitted), it sets selection state based on all widgets
    const unselectedSeries = newDashboard.widgets
      .map(widget => {
        const widgetLegendQuery = currentUnselectedSeries.find(legend =>
          legend.includes(widget.id!)
        );
        if (!widgetLegendQuery && this.widgetRequiresLegendUnselection(widget)) {
          return this.formatLegendDefaultQuery(widget);
        }
        return widgetLegendQuery;
      })
      .filter(Boolean);
    return unselectedSeries;
  }

  getUnselectedSeries() {
    return loadQueryParamsFromLocation(legendQueryParsers, this.location)
      .unselectedSeries;
  }
}
