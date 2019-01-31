import {css} from 'react-emotion';
import {isEqual, zipWith} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {OPERATOR} from 'app/views/organizationDiscover/data';
import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';
import {getChartComponent} from 'app/views/organizationDashboard/utils/getChartComponent';
import {getData} from 'app/views/organizationDashboard/utils/getData';
import {getEventsUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getEventsUrlPathFromDiscoverQuery';
import ChartZoom from 'app/components/charts/chartZoom';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';

const tableRowCss = css`
  color: ${theme.textColor};
`;

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
    const {organization, results, releases, selection, widget} = this.props;
    const isTable = widget.type === WIDGET_DISPLAY.TABLE;

    // get visualization based on widget data
    const ChartComponent = getChartComponent(widget);

    // get data func based on query
    const chartData = getData(results, widget);

    const extra = {
      ...(isTable && {
        rowClassName: tableRowCss,
        getRowLink: rowObject => {
          // Table Charts don't support multiple queries
          const [query] = widget.queries.discover;

          return getEventsUrlWithConditions({rowObject, query, organization, selection});
        },
      }),
    };

    // Releases can only be added to time charts
    if (widget.includeReleases) {
      return (
        <ReleaseSeries releases={releases}>
          {({releaseSeries}) =>
            this.renderZoomableChart(ChartComponent, {
              ...extra,
              ...chartData,
              series: [...chartData.series, ...releaseSeries],
            })}
        </ReleaseSeries>
      );
    }

    if (chartData.isGroupedByDate) {
      return this.renderZoomableChart(ChartComponent, {
        ...extra,
        ...chartData,
      });
    }

    return <ChartComponent {...extra} {...chartData} />;
  }
}

export default WidgetChart;

/**
 * Generate a URL to the events page for a discover query that
 * contains a condition.
 *
 * This is pretty specific to the table chart right now, so not exported,
 * but can be adapted to be more generic
 *
 * @param {Object} query The discover query object
 * @param {Object} rowObject The data object for a row in a `TableChart`
 * @param {String} rowObject.name A comma separated string of labels for a row
 *   e.g. if the query has multiple fields (browser, device) `name` could be "Chrome, iPhone"
 * @return {String} Returns a url to the "events" page with any discover conditions tranformed to search query syntax
 */
function getEventsUrlWithConditions({rowObject, query, selection, organization}) {
  if (!rowObject || typeof rowObject.name === 'undefined') return null;

  return getEventsUrlPathFromDiscoverQuery({
    organization,
    selection,
    query: {
      ...query,
      conditions: [
        ...query.conditions,
        // For each `groupby` field, create a condition that joins it with each `rowObject.name` value (separated by commas)
        // e.g. groupby: ['browser', 'device'],  rowObject.name: "Chrome, iPhone"
        //      ----> [['browser', '=', 'Chrome'], ['device', '=', 'iPhone']]
        ...zipWith(query.groupby, rowObject.name.split(','), (field, value) => [
          field,
          OPERATOR.EQUAL,
          value,
        ]),
      ],
    },
  });
}
