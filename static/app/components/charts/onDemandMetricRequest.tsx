import {doEventsRequest} from 'sentry/actionCreators/events';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';

export class OnDemandMetricRequest extends EventsRequest {
  fetchExtrapolatedData = async (): Promise<EventsStats> => {
    const {api, organization, ...props} = this.props;
    const retVal = await doEventsRequest(api, {
      ...props,
      organization,
      generatePathname: () =>
        `/organizations/${organization.slug}/metrics-estimation-stats/`,
    });
    return {
      ...retVal,
      isExtrapolatedData: true,
    } as EventsStats;
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
    let errorMessage: any;
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

        timeseriesData = await this.fetchExtrapolatedData();
      } catch (resp) {
        errorMessage = resp?.responseJSON?.detail ?? t('Error loading chart data');
        if (!hideError) {
          addErrorMessage(errorMessage);
        }
        onError?.(errorMessage);
        this.setState({
          errored: true,
          errorMessage: t('Error fetching estimated data'),
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
