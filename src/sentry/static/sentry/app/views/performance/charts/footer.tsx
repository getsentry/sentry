import React from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import * as Sentry from '@sentry/react';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import {Client} from 'app/api';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {fetchTotalCount} from 'app/actionCreators/events';
import OptionSelector from 'app/components/charts/optionSelector';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';

import {getAxisOptions} from '../data';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
  rightAxis: string;
  leftAxis: string;
};

type State = {
  totalValues: null | number;
};

class ChartFooter extends React.Component<Props, State> {
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
    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.change_chart',
      eventName: 'Performance Views: Change Overview Chart',
      organization_id: parseInt(organization.id, 10),
      metric: value,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, [key]: value},
    });
  }

  mounted: boolean = false;

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

    const options = getAxisOptions(organization);
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
            menuWidth="200px"
          />
          <OptionSelector
            title={t('Display 2')}
            selected={rightAxis}
            options={rightOptions}
            onChange={(val: string) => this.handleSelectorChange('right', val)}
            menuWidth="200px"
          />
        </InlineContainer>
      </ChartControls>
    );
  }
}

export default ChartFooter;
