import {doEventsRequest} from 'sentry/actionCreators/events';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

function numOfEvents(timeseriesData) {
  return timeseriesData.data.reduce((acc, item) => {
    const count = item[1][0].count;
    return acc + count;
  }, 0);
}

function applySampleRate(timeseriesData, sampleRate = 1) {
  const scaledData = timeseriesData.data.map(([timestamp, value]) => {
    return [timestamp, value.map(item => ({count: Math.round(item.count / sampleRate)}))];
  });

  return {
    ...timeseriesData,
    isExtrapolatedData: true,
    data: scaledData,
  };
}

class OnDemandMetricRequest extends EventsRequest {
  fetchMetricsData = async () => {
    const {api, ...props} = this.props;

    try {
      api.clear();

      const timeseriesData = await doEventsRequest(api, {
        ...props,
        useOnDemandMetrics: true,
      });

      return timeseriesData;
    } catch {
      return {
        data: [],
        isMetricsData: false,
      };
    }
  };

  fetchIndexedData = async () => {
    const {api, sampleRate, ...props} = this.props;

    const timeseriesData = await doEventsRequest(api, {
      ...props,
      useOnDemandMetrics: false,
      queryExtras: {dataset: DiscoverDatasets.DISCOVER},
    });

    return applySampleRate(timeseriesData, sampleRate);
  };

  fetchData = async () => {
    const {api, confirmedQuery, onError, expired, name, hideError, ...props} = this.props;
    let timeseriesData: EventsStats | MultiSeriesEventsStats | null = null;

    if (confirmedQuery === false) {
      return;
    }
    this.setState(state => ({
      reloading: state.timeseriesData !== null,
      errored: false,
      errorMessage: undefined,
    }));
    let errorMessage;
    if (expired) {
      errorMessage = t(
        '%s has an invalid date range. Please try a more recent date range.',
        name
      );
      addErrorMessage(errorMessage, {append: true});
      this.setState({
        errored: true,
        errorMessage,
      });
    } else {
      try {
        api.clear();

        timeseriesData = await this.fetchMetricsData();

        const fallbackToIndexed =
          !timeseriesData.isMetricsData || numOfEvents(timeseriesData) === 0;

        if (fallbackToIndexed) {
          timeseriesData = await this.fetchIndexedData();
        }
      } catch (resp) {
        if (resp && resp.responseJSON && resp.responseJSON.detail) {
          errorMessage = resp.responseJSON.detail;
        } else {
          errorMessage = t('Error loading chart data');
        }
        if (!hideError) {
          addErrorMessage(errorMessage);
        }
        onError?.(errorMessage);
        this.setState({
          errored: true,
          errorMessage,
        });
      }

      this.setState({
        reloading: false,
        timeseriesData,
        fetchedWithPrevious: props.includePrevious,
      });
    }

    if (props.dataLoadedCallback) {
      props.dataLoadedCallback(timeseriesData);
    }
  };
}

export default OnDemandMetricRequest;
