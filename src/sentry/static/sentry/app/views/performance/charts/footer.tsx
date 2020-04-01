import React from 'react';
import * as Sentry from '@sentry/browser';
import {Location} from 'history';

import {t} from 'app/locale';
import {Client} from 'app/api';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {fetchTotalCount} from 'app/actionCreators/events';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';
import {Organization} from 'app/types';

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  location: Location;
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
    const {totalValues} = this.state;

    const value = typeof totalValues === 'number' ? totalValues.toLocaleString() : '-';

    return (
      <ChartControls>
        <InlineContainer>
          <SectionHeading>{t('Total Events')}</SectionHeading>
          <SectionValue>{value}</SectionValue>
        </InlineContainer>
      </ChartControls>
    );
  }
}

export default ChartFooter;
