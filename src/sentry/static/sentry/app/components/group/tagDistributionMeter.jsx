import PropTypes from 'prop-types';
import React from 'react';

import {deviceNameMapper, loadDeviceListModule} from 'app/components/deviceName';
import SentryTypes from 'app/sentryTypes';
import TagDistributionMeter from 'app/components/tagDistributionMeter';

class GroupTagDistributionMeter extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    tag: PropTypes.string.isRequired,
    name: PropTypes.string,
    organization: SentryTypes.Organization.isRequired,
    totalValues: PropTypes.number,
    topValues: PropTypes.array,
  };

  state = {
    loading: true,
    error: false,
  };

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.loading !== nextState.loading ||
      this.state.error !== nextState.error ||
      this.props.tag !== nextProps.tag ||
      this.props.name !== nextProps.name ||
      this.props.totalValues !== nextProps.totalValues ||
      this.props.topValues !== nextProps.topValues
    );
  }

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    loadDeviceListModule()
      .then(iOSDeviceList => {
        this.setState({
          iOSDeviceList,
          error: false,
          loading: false,
        });
      })
      .catch(() => {
        this.setState({
          error: true,
          loading: false,
        });
      });
  }

  render() {
    const {organization, group, tag, totalValues, topValues} = this.props;
    const {loading, error} = this.state;

    const url = `/organizations/${organization.slug}/issues/${group.id}/tags/${tag}/`;

    let segments = [];

    if (topValues) {
      segments = this.state.iOSDeviceList
        ? topValues.map(value => ({
            ...value,
            name: deviceNameMapper(value.name || '', this.state.iOSDeviceList) || '',
            url,
          }))
        : topValues.map(value => ({
            ...value,
            url,
          }));
    }

    return (
      <TagDistributionMeter
        title={tag}
        totalValues={totalValues}
        isLoading={loading}
        hasError={error}
        segments={segments}
      />
    );
  }
}

export default GroupTagDistributionMeter;
