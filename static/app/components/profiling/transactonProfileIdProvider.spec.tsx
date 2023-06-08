import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useProfileEventsModule from 'sentry/utils/profiling/hooks/useProfileEvents';
import * as useApiModule from 'sentry/utils/useApi';

import * as TransactionProfileIdProviderModule from './transactionProfileIdProvider';

const useApiSpy = jest.spyOn(useApiModule, 'default');

// this order matters; create the spy before dereferencing below
const useTransactionProfileIdSpy = jest.spyOn(
  TransactionProfileIdProviderModule,
  'useTransactionProfileId'
);

const {TransactionProfileIdProvider, useTransactionProfileId} =
  TransactionProfileIdProviderModule;

const useProfileEventsSpy = jest.spyOn(useProfileEventsModule, 'useProfileEvents');

function MockComponent() {
  const profileId = useTransactionProfileId();
  return <div data-test-id={profileId} />;
}

const MOCK_TRX_ID = '123';
const MOCK_PROFILE_ID = '456';

describe('TransactionProfileIdProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('provides default profileId state as null', () => {
    render(
      <TransactionProfileIdProvider transactionId={undefined} timestamp={undefined}>
        <MockComponent />
      </TransactionProfileIdProvider>
    );

    expect(useProfileEventsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
    expect(useTransactionProfileIdSpy).toHaveReturnedWith(null);
  });

  it('does not query the events endpoint when transactionId is undefined', () => {
    const requestPromiseMock = jest.fn();
    // @ts-expect-error
    useApiSpy.mockReturnValueOnce({
      requestPromise: requestPromiseMock,
    });
    render(
      <TransactionProfileIdProvider transactionId={undefined} timestamp={undefined}>
        <MockComponent />
      </TransactionProfileIdProvider>
    );

    expect(useProfileEventsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
    expect(requestPromiseMock).not.toHaveBeenCalled();
    expect(useTransactionProfileIdSpy).toHaveReturnedWith(null);
  });

  it('queries the events endpoint for a profile id when given a transactionId', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            id: MOCK_PROFILE_ID,
          },
        ],
      },
    });

    render(
      <TransactionProfileIdProvider
        transactionId={MOCK_TRX_ID}
        timestamp="2022-12-19T16:00:00.000Z"
      >
        <MockComponent />
      </TransactionProfileIdProvider>
    );

    await waitFor(() => screen.findAllByTestId(MOCK_PROFILE_ID));

    expect(useProfileEventsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'trace.transaction:' + MOCK_TRX_ID,
        datetime: {
          end: new Date('2022-12-20T04:00:00.000Z'),
          period: null,
          start: new Date('2022-12-19T04:00:00.000Z'),
          utc: true,
        },
      })
    );
    expect(useTransactionProfileIdSpy).toHaveReturnedWith(MOCK_PROFILE_ID);
  });
});
