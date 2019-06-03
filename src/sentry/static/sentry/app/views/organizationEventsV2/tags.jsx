import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {isEqual} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import TagDistributionMeter from 'app/components/tagDistributionMeter';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {fetchTags, getEventTagSearchUrl} from './utils';

class Tags extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
    selection: SentryTypes.GlobalSelection.isRequired,
    location: PropTypes.object.isRequired,
  };

  state = {
    isLoading: true,
    tags: {},
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.view.id !== prevProps.view.id ||
      !isEqual(this.props.selection, prevProps.selection)
    ) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    const {api, organization, view} = this.props;

    try {
      const tags = await fetchTags(api, organization.slug, view.tags);
      this.setState({tags, isLoading: false});
    } catch (err) {
      this.setState({tags: {}, isLoading: false});
    }
  };

  renderTag(tag) {
    const {location} = this.props;
    const {isLoading, tags} = this.state;
    let segments = [];
    let totalValues = 0;
    if (!isLoading && tags[tag] && tags[tag]) {
      totalValues = tags[tag].totalValues;
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
export default withApi(withGlobalSelection(Tags));
