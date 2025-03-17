import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getOperatingSystemContextData,
  type OperatingSystemContext,
} from 'sentry/components/events/contexts/knownContext/os';

const MOCK_OS_CONTEXT: OperatingSystemContext = {
  name: 'Linux',
  version: '6.1.82',
  build: '20C69',
  kernel_version: '99.168.amzn2023.x86_64',
  rooted: true,
  theme: 'dark',
  raw_description: '',
  distribution: {
    name: 'amzn',
    version: '2023',
    pretty_name: 'Amazon Linux 2023.4.20240401',
  },
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  raw_description: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('OperatingSystemContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getOperatingSystemContextData({data: MOCK_OS_CONTEXT})).toEqual([
      {key: 'name', subject: 'Name', value: 'Linux'},
      {key: 'version', subject: 'Version', value: '6.1.82'},
      {key: 'build', subject: 'Build', value: '20C69'},
      {
        key: 'kernel_version',
        subject: 'Kernel Version',
        value: '99.168.amzn2023.x86_64',
      },
      {key: 'rooted', subject: 'Rooted', value: 'yes'},
      {key: 'theme', subject: 'Theme', value: 'dark'},
      {key: 'raw_description', subject: 'Raw Description', value: ''},
      {
        key: 'distribution',
        subject: 'Distro',
        value: 'Amazon Linux 2023.4.20240401',
      },
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
        meta: undefined,
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
        meta: undefined,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {os: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'os'}
        alias={'os'}
        value={{...MOCK_OS_CONTEXT, raw_description: ''}}
      />
    );

    expect(screen.getByText('Operating System')).toBeInTheDocument();
    expect(screen.getByText('Distro')).toBeInTheDocument();
    expect(screen.getByText('Amazon Linux 2023.4.20240401')).toBeInTheDocument();
    expect(screen.getByText('Raw Description')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
