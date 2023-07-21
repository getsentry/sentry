import {renderHook} from '@testing-library/react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import SampleTable from './sampleTable';

describe('SampleTable', function () {
  const api = new MockApiClient();
  const organization = TestStubs.Organization();
  let eventsMock: jest.Mock;

  it('renders doc correctly', async () => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {data: []},
    });

    const container = render(
      <SampleTable
        groupId="groupId123"
        transactionMethod="GET"
        transactionName="/endpoint"
      />
    );

    expect(eventsMock).toHaveBeenCalledWith(3);

    const loadingIndicator = await container.findByTestId('loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });
});
