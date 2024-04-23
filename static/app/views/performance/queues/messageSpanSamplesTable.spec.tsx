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
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Span ID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Message ID'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Processing Latency'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Message Size'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
  });
});
