import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';

import {useReplayTraces} from './useReplayTraces';

const queryClient = makeTestQueryClient();
const replayRecord = ReplayRecordFixture();
const organization = OrganizationFixture();

const wrapper = ({children}: {children: React.ReactNode}) => (
  <OrganizationContext value={organization}>{children}</OrganizationContext>
);

describe('useTraceMeta', () => {
  beforeEach(function () {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('Returns replay traces', async () => {
    const pageLinks =
      '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/fake/next>; rel="next"; results="false"; cursor="0:20:0"';

    // Mock the API calls
    MockApiClient.addMockResponse({
      method: 'GET',
      headers: {Link: pageLinks},
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            trace: 'trace1',
            'min(timestamp)': 1,
          },
          {
            trace: 'trace2',
            'min(timestamp)': 2,
          },
        ],
      },
    });

    const {result} = renderHook(() => useReplayTraces({replayRecord}), {
      wrapper,
    });

    expect(result.current.indexComplete).toBe(false);

    await waitFor(() => expect(result.current.indexComplete).toBe(true));

    expect(result.current.indexComplete).toBe(true);
    expect(result.current.replayTraces).toEqual([
      {traceSlug: 'trace1', timestamp: 1},
      {traceSlug: 'trace2', timestamp: 2},
    ]);
  });

  it('Collects errors', async () => {
    const pageLinks =
      '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/fake/next>; rel="next"; results="false"; cursor="0:20:0"';

    // Mock the API calls
    const mockedResponse = MockApiClient.addMockResponse({
      method: 'GET',
      headers: {Link: pageLinks},
      url: '/organizations/org-slug/events/',
      statusCode: 400,
    });

    const {result} = renderHook(() => useReplayTraces({replayRecord}), {
      wrapper,
    });

    expect(result.current.indexComplete).toBe(false);

    await waitFor(() => expect(result.current.indexComplete).toBe(true));

    expect(result.current.indexComplete).toBe(true);
    expect(result.current.replayTraces).toBeUndefined();
    expect(result.current.indexError as Error).toEqual(
      expect.objectContaining({status: 400})
    );
    expect(mockedResponse).toHaveBeenCalledTimes(1);
  });
});
