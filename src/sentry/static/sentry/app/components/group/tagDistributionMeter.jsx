import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import {deviceNameMapper, loadDeviceListModule} from 'app/components/deviceName';
import SentryTypes from 'app/sentryTypes';
import withEnvironment from 'app/utils/withEnvironment';

import TagDistributionMeter from 'app/components/tagDistributionMeter';

const GroupTagDistributionMeter = createReactClass({
  displayName: 'TagDistributionMeter',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    tag: PropTypes.string.isRequired,
    name: PropTypes.string,
    organization: SentryTypes.Organization.isRequired,
    environment: SentryTypes.Environment,
    totalValues: PropTypes.number,
    topValues: PropTypes.array,
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.loading !== nextState.loading ||
      this.state.error !== nextState.error ||
      this.props.tag !== nextProps.tag ||
      this.props.name !== nextProps.name ||
      this.props.environment !== nextProps.environment ||
      this.props.totalValues !== nextProps.totalValues ||
      this.props.topValues !== nextProps.topValues
    );
  },

  componentDidUpdate(prevProps) {
    if (prevProps.environment !== this.props.environment) {
      this.fetchData();
    }
  },

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
  },

  render() {
    const {organization, group, tag, totalValues, topValues} = this.props;
    const {loading, error} = this.state;

    const url = `/organizations/${organization.slug}/issues/${group.id}/tags/${tag}/`;

    let segments = [];

    if (topValues) {
      const totalVisible = topValues.reduce((sum, value) => sum + value.count, 0);
      const hasOther = totalVisible < totalValues;

      if (hasOther) {
        topValues.push({
          value: 'other',
          name: t('Other'),
          count: totalValues - totalVisible,
        });
      }

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
  },
});

export {GroupTagDistributionMeter};
export default withEnvironment(GroupTagDistributionMeter);
