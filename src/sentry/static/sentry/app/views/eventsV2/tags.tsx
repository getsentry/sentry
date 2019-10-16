import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {isEqual, omit} from 'lodash';
import {Location} from 'history';
import * as Sentry from '@sentry/browser';

import {Client} from 'app/api';
import SentryTypes from 'app/sentryTypes';
import Placeholder from 'app/components/placeholder';
import TagDistributionMeter from 'app/components/tagDistributionMeter';
import withApi from 'app/utils/withApi';
import {Organization} from 'app/types';

import {
  fetchTagDistribution,
  fetchTotalCount,
  getEventTagSearchUrl,
  Tag,
  TagTopValue,
} from './utils';
import {MODAL_QUERY_KEYS} from './data';
import EventView from './eventView';

type Props = {
  api: Client;
  organization: Organization;
  eventView: EventView;
  location: Location;
};

type State = {
  tags: {[key: string]: Tag};
  totalValues: null | number;
};

class Tags extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    eventView: PropTypes.object.isRequired,
  };

  state: State = {
    tags: {},
    totalValues: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    // Do not update if we are just opening/closing the modal
    const locationHasChanged = !isEqual(
      omit(prevProps.location.query, MODAL_QUERY_KEYS),
      omit(this.props.location.query, MODAL_QUERY_KEYS)
    );

    const tagsChanged = !isEqual(
      new Set(this.props.eventView.tags),
      new Set(prevProps.eventView.tags)
    );

    if (locationHasChanged && tagsChanged) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    const {api, organization, eventView, location} = this.props;

    this.setState({tags: {}, totalValues: null});

    eventView.tags.forEach(async tag => {
      try {
        const val = await fetchTagDistribution(
          api,
          organization.slug,
          tag,
          eventView.getEventsAPIPayload(location)
        );

        this.setState(state => ({tags: {...state.tags, [tag]: val}}));
      } catch (err) {
        Sentry.captureException(err);
      }
    });

    try {
      const totalValues = await fetchTotalCount(
        api,
        organization.slug,
        eventView.getEventsAPIPayload(location)
      );
      this.setState({totalValues});
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  renderTag(tag) {
    const {location} = this.props;
    const {tags, totalValues} = this.state;
    const isLoading = !tags[tag] || totalValues === null;

    let segments: Array<TagTopValue> = [];

    if (!isLoading) {
      segments = tags[tag].topValues;
    }

    segments.forEach(segment => {
      segment.url = getEventTagSearchUrl(tag, segment.value, location);
    });

    return (
      <TagDistributionMeter
        key={tag}
        title={tag}
        segments={segments}
        totalValues={totalValues}
        isLoading={isLoading}
        renderLoading={() => <StyledPlaceholder height="16px" />}
      />
    );
  }

  render() {
    return <div>{this.props.eventView.tags.map(tag => this.renderTag(tag))}</div>;
  }
}

const StyledPlaceholder = styled(Placeholder)`
  border-radius: ${p => p.theme.borderRadius};
`;

export {Tags};
export default withApi(Tags);
