import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {MessageSpanSamplesTable} from 'sentry/views/performance/queues/messageSpanSamplesTable';

jest.mock('sentry/utils/useOrganization');

describe('messageSpanSamplesTable', () => {
  const organization = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(organization);

  beforeEach(() => {});
  it('renders', () => {
    render(<MessageSpanSamplesTable data={[]} isLoading={false} />);
    screen.getByText('Span ID');
    screen.getByText('Message ID');
    screen.getByText('Processing Latency');
    screen.getByText('Message Size');
    screen.getByText('Status');
  });
});
