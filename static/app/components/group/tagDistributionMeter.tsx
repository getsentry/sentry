import {Component} from 'react';

import {deviceNameMapper} from 'sentry/components/deviceName';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {Group, Organization, TagWithTopValues} from 'sentry/types';

type Props = {
  group: Group;
  name: string;
  onTagClick: React.ComponentProps<typeof TagDistributionMeter>['onTagClick'];
  organization: Organization;
  projectId: string;
  tag: string;
  topValues: TagWithTopValues['topValues'];
  totalValues: number;
};

class GroupTagDistributionMeter extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return (
      this.props.tag !== nextProps.tag ||
      this.props.name !== nextProps.name ||
      this.props.totalValues !== nextProps.totalValues ||
      this.props.topValues !== nextProps.topValues
    );
  }

  render() {
    const {organization, group, tag, totalValues, topValues, onTagClick} = this.props;
    const url = `/organizations/${organization.slug}/issues/${group.id}/tags/${tag}/?referrer=tag-distribution-meter`;

    const segments = topValues
      ? topValues.map(value => ({
          ...value,
          name: deviceNameMapper(value.name || '') || value.name,
          url,
        }))
      : [];

    return (
      <TagDistributionMeter
        title={tag}
        totalValues={totalValues}
        isLoading={false}
        hasError={false}
        segments={segments}
        onTagClick={onTagClick}
      />
    );
  }
}

export default GroupTagDistributionMeter;
