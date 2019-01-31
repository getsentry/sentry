import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {getChartComponent} from 'app/views/organizationDashboard/utils/getChartComponent';
import {getData} from 'app/views/organizationDashboard/utils/getData';
import ChartZoom from 'app/components/charts/chartZoom';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';

/**
 * Component that decides what Chart to render
 * Extracted into another component so that we can use shouldComponentUpdate
 */
class WidgetChart extends React.Component {
  static propTypes = {
    router: PropTypes.object,
    results: SentryTypes.DiscoverResults,
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
    const {results, releases, widget} = this.props;

    // get visualization based on widget data
    const ChartComponent = getChartComponent(widget);

    // get data func based on query
    const chartData = getData(results, widget);

    // Releases can only be added to time charts
    if (widget.includeReleases) {
      return (
        <ReleaseSeries releases={releases}>
          {({releaseSeries}) =>
            this.renderZoomableChart(ChartComponent, {
              ...chartData,
              series: [...chartData.series, ...releaseSeries],
            })}
        </ReleaseSeries>
      );
    }

    if (chartData.isGroupedByDate) {
      return this.renderZoomableChart(ChartComponent, {
        ...chartData,
      });
    }

    return <ChartComponent {...chartData} />;
  }
}

export default WidgetChart;
