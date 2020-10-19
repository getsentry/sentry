import React from 'react';

import {Group, Organization, TagWithTopValues} from 'app/types';
import {IOSDeviceList} from 'app/types/iOSDeviceList';
import {deviceNameMapper, loadDeviceListModule} from 'app/components/deviceName';
import TagDistributionMeter from 'app/components/tagDistributionMeter';

type Props = {
  group: Group;
  tag: string;
  name: string;
  organization: Organization;
  totalValues: number;
  topValues: TagWithTopValues['topValues'];
  projectId: string;
};

type State = {
  loading: boolean;
  error: boolean;
  iOSDeviceList?: IOSDeviceList;
};

class GroupTagDistributionMeter extends React.Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
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
    const {loading, error, iOSDeviceList} = this.state;

    const url = `/organizations/${organization.slug}/issues/${group.id}/tags/${tag}/`;

    const segments = topValues
      ? topValues.map(value => ({
          ...value,
          name: iOSDeviceList
            ? deviceNameMapper(value.name || '', iOSDeviceList) || ''
            : value.name,
          url,
        }))
      : [];

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
