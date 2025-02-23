import {Component} from 'react';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';

import type {TooltipOption} from '../data';
import {getAxisOptions} from '../data';

type Props = {
  api: Client;
  eventView: EventView;
  leftAxis: string;
  location: Location;
  organization: Organization;
  rightAxis: string;
  options?: TooltipOption[];
};

type State = {
  totalValues: null | number;
};

class ChartFooter extends Component<Props, State> {
  state: State = {
    totalValues: null,
  };

  componentDidMount() {
    this.mounted = true;

    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props) {
    const orgSlugHasChanged =
      this.props.organization.slug !== prevProps.organization.slug;
    const shouldRefetch = this.shouldRefetchData(prevProps);

    if ((orgSlugHasChanged || shouldRefetch) && this.props.eventView.isValid()) {
      this.fetchTotalCount();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  handleSelectorChange(key: string, value: string) {
    const {location, organization} = this.props;
    trackAnalytics('performance_views.overview.change_chart', {
      organization,
      metric: value,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, [key]: value},
    });
  }

  mounted = false;

  async fetchTotalCount() {
    const {api, organization, location, eventView} = this.props;
    if (!eventView.isValid() || !this.mounted) {
      return;
    }

    try {
      const totals = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );

      if (this.mounted) {
        this.setState({totalValues: totals});
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  render() {
    const {leftAxis, organization, rightAxis} = this.props;
    const {totalValues} = this.state;

    const value = typeof totalValues === 'number' ? totalValues.toLocaleString() : '-';

    const options = this.props.options || getAxisOptions(organization);
    const leftOptions = options.map(opt => ({
      ...opt,
      disabled: opt.value === rightAxis,
    }));
    const rightOptions = options.map(opt => ({
      ...opt,
      disabled: opt.value === leftAxis,
    }));

    return (
      <ChartControls>
        <InlineContainer>
          <SectionHeading>{t('Total Events')}</SectionHeading>
          <SectionValue>{value}</SectionValue>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Display 1')}
            selected={leftAxis}
            options={leftOptions}
            onChange={(val: string) => this.handleSelectorChange('left', val)}
          />
          <OptionSelector
            title={t('Display 2')}
            selected={rightAxis}
            options={rightOptions}
            onChange={(val: string) => this.handleSelectorChange('right', val)}
          />
        </InlineContainer>
      </ChartControls>
    );
  }
}

export default ChartFooter;
