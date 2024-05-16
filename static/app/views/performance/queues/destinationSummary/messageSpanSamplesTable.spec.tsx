import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import useOrganization from 'sentry/utils/useOrganization';
import {MessageSpanSamplesTable} from 'sentry/views/performance/queues/destinationSummary/messageSpanSamplesTable';
import {MessageActorType} from 'sentry/views/performance/queues/settings';

jest.mock('sentry/utils/useOrganization');

describe('messageSpanSamplesTable', () => {
  const organization = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(organization);

  beforeEach(() => {});
  it('renders consumer samples table', () => {
    render(
      <MessageSpanSamplesTable
        data={[]}
        isLoading={false}
        type={MessageActorType.CONSUMER}
      />
    );
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Span ID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Message ID'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Processing Time'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Retries'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
  });
  it('renders producer samples table', () => {
    render(
      <MessageSpanSamplesTable
        data={[]}
        isLoading={false}
        type={MessageActorType.PRODUCER}
      />
    );
    expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Span ID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Message ID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Message Size'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
  });
});
