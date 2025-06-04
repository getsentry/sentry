import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import type {CloudResourceContext} from 'sentry/components/events/contexts/knownContext/cloudResource';
import {getCloudResourceContextData} from 'sentry/components/events/contexts/knownContext/cloudResource';

const MOCK_CLOUD_RESOURCE: CloudResourceContext = {
  'cloud.provider': 'aws',
  'cloud.platform': 'aws_ec2',
  'cloud.account.id': '499517922981',
  'cloud.region': 'us-east-1',
  'cloud.availability_zone': 'us-east-1e',
  'host.id': 'i-07d3301208fe0a55a',
  'host.type': 't2.large',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  ['host.id']: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 19,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

describe('CloudResourceContext', function () {
  it('returns formatted data correctly', function () {
    expect(getCloudResourceContextData({data: MOCK_CLOUD_RESOURCE})).toEqual([
      {
        key: 'cloud.provider',
        subject: 'Provider',
        value: 'Amazon Web Services',
      },
      {key: 'cloud.platform', subject: 'Platform', value: 'aws_ec2'},
      {
        key: 'cloud.account.id',
        subject: 'Account ID',
        value: '499517922981',
      },
      {key: 'cloud.region', subject: 'Region', value: 'us-east-1'},
      {
        key: 'cloud.availability_zone',
        subject: 'Availability Zone',
        value: 'us-east-1e',
      },
      {key: 'host.id', subject: 'Host ID', value: 'i-07d3301208fe0a55a'},
      {key: 'host.type', subject: 'Host Type', value: 't2.large'},
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {cloud_resource: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'cloud_resource'}
        alias={'cloud_resource'}
        value={{...MOCK_CLOUD_RESOURCE, ['host.id']: ''}}
      />
    );

    expect(screen.getByText('Cloud Resource')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByText('Host ID')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
