import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';
import {getChartComponent} from 'app/views/organizationDashboard/utils/getChartComponent';
import {getData} from 'app/views/organizationDashboard/utils/getData';
import ChartZoom from 'app/components/charts/chartZoom';
import ExploreWidget from 'app/views/organizationDashboard/exploreWidget';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';

/**
 * Component that decides what Chart to render
 * Extracted into another component so that we can use shouldComponentUpdate
 */
class WidgetChart extends React.Component {
  static propTypes = {
    router: PropTypes.object,
    results: SentryTypes.DiscoverResult,
    releases: PropTypes.arrayOf(SentryTypes.Release),
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
  };

  shouldComponentUpdate(nextProps) {
    if (nextProps.reloading) {
      return false;
    }

    // It's not a big deal to re-render if this.prop.results == nextProps.results == []
    const isDataEqual =
      this.props.results.length &&
      nextProps.results.length &&
      isEqual(this.props.results[0].data, nextProps.results[0].data);

    if (isDataEqual) {
      return false;
    }

    return true;
  }

  renderZoomableChart(ChartComponent, props) {
    const {router, selection} = this.props;
    return (
      <ChartZoom router={router} {...selection.datetime}>
        {zoomRenderProps => <ChartComponent {...props} {...zoomRenderProps} />}
      </ChartZoom>
    );
  }

  render() {
    const {results, releases, router, selection, widget} = this.props;
    const isTable = widget.type === WIDGET_DISPLAY.TABLE;

    // get visualization based on widget data
    const ChartComponent = getChartComponent(widget);

    // get data func based on query
    const chartData = getData(results, widget);

    const extra = {
      ...(isTable && {
        headerProps: {hasButtons: true},
        extraTitle: <ExploreWidget {...{widget, router, selection}} />,
      }),
    };

    // Releases can only be added to time charts
    if (widget.includeReleases) {
      return (
        <ReleaseSeries releases={releases}>
          {({releaseSeries}) =>
            this.renderZoomableChart(ChartComponent, {
              ...chartData,
              ...extra,
              series: [...chartData.series, ...releaseSeries],
            })}
        </ReleaseSeries>
      );
    }

    if (chartData.isGroupedByDate) {
      return this.renderZoomableChart(ChartComponent, {
        ...chartData,
        ...extra,
      });
    }

    return <ChartComponent {...chartData} {...extra} />;
  }
}

export default WidgetChart;
