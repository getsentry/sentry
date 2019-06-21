import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {isEqual, omit} from 'lodash';
import * as Sentry from '@sentry/browser';

import SentryTypes from 'app/sentryTypes';
import TagDistributionMeter from 'app/components/tagDistributionMeter';
import withApi from 'app/utils/withApi';
import {fetchTagDistribution, fetchTotalCount, getEventTagSearchUrl} from './utils';
import {MODAL_QUERY_KEYS} from './data';

class Tags extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
    location: PropTypes.object.isRequired,
  };

  state = {
    tags: {},
    totalValues: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    // Do not update if we are just opening/closing the modal
    const locationHasChanged = !isEqual(
      omit(prevProps.location.query, MODAL_QUERY_KEYS),
      omit(this.props.location.query, MODAL_QUERY_KEYS)
    );

    if (this.props.view.id !== prevProps.view.id || locationHasChanged) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    const {api, organization, view, location} = this.props;

    this.setState({tags: {}, totalValues: null});

    view.tags.forEach(async tag => {
      try {
        const val = await fetchTagDistribution(
          api,
          organization.slug,
          tag,
          location.query
        );

        this.setState(state => ({tags: {...state.tags, [tag]: val}}));
      } catch (err) {
        Sentry.captureException(err);
      }
    });

    try {
      const totalValues = await fetchTotalCount(api, organization.slug, location.query);
      this.setState({totalValues});
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  renderTag(tag) {
    const {location} = this.props;
    const {tags, totalValues} = this.state;
    const isLoading = !tags[tag] || totalValues === null;
    let segments = [];

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
        renderLoading={() => <Placeholder />}
      />
    );
  }

  render() {
    return <div>{this.props.view.tags.map(tag => this.renderTag(tag))}</div>;
  }
}

const Placeholder = styled('div')`
  height: 16px;
  width: 100%;
  display: inline-block;
  border-radius: ${p => p.theme.borderRadius};
  background-color: #dad9ed;
`;

export {Tags};
export default withApi(Tags);
