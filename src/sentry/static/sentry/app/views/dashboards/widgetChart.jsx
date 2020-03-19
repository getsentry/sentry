import {ClassNames} from '@emotion/core';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';

import ChartZoom from 'app/components/charts/chartZoom';
import ReleaseSeries from 'app/components/charts/releaseSeries';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';

import {WIDGET_DISPLAY} from './constants';
import {getChartComponent} from './utils/getChartComponent';
import {getData} from './utils/getData';
import {getEventsUrlFromDiscoverQueryWithConditions} from './utils/getEventsUrlFromDiscoverQueryWithConditions';

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
    reloading: PropTypes.bool,
  };

  shouldComponentUpdate(nextProps) {
    if (nextProps.reloading) {
      return false;
    }

    // It's not a big deal to re-render if this.prop.results === nextProps.results === []
    const isDataEqual =
      this.props.results.length &&
      nextProps.results.length &&
      this.props.results.length === nextProps.results.length;

    if (!isDataEqual) {
      return true;
    }

    for (let i = 0; i < this.props.results.length; i++) {
      if (!isEqual(this.props.results[i].data, nextProps.results[i].data)) {
        return true;
      }
    }

    return false;
  }

  renderZoomableChart(ChartComponent, props) {
    const {router, selection} = this.props;
    return (
      <ChartZoom router={router} useShortDate {...selection.datetime}>
        {zoomRenderProps => (
          <ClassNames>
            {({css}) => (
              <ChartComponent
                rowClassName={css`
                  color: ${theme.textColor};
                `}
                {...props}
                {...zoomRenderProps}
              />
            )}
          </ClassNames>
        )}
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
        getRowLink: rowObject => {
          // Table Charts don't support multiple queries
          const [query] = widget.queries.discover;

          return getEventsUrlFromDiscoverQueryWithConditions({
            values: rowObject.fieldValues,
            query,
            organization,
            selection,
          });
        },
      }),
    };

    // Releases can only be added to time charts
    if (widget.includeReleases) {
      return (
        <ReleaseSeries utc={selection.utc} releases={releases}>
          {({releaseSeries}) =>
            this.renderZoomableChart(ChartComponent, {
              ...extra,
              ...chartData,
              series: [...chartData.series, ...releaseSeries],
            })
          }
        </ReleaseSeries>
      );
    }

    if (chartData.isGroupedByDate) {
      return this.renderZoomableChart(ChartComponent, {
        ...extra,
        ...chartData,
      });
    }

    return (
      <ClassNames>
        {({css}) => (
          <ChartComponent
            rowClassName={css`
              color: ${theme.textColor};
            `}
            {...extra}
            {...chartData}
          />
        )}
      </ClassNames>
    );
  }
}

export default WidgetChart;
