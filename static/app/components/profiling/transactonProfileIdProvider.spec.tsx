import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useProfileEventsModule from 'sentry/utils/profiling/hooks/useProfileEvents';

import * as TransactionProfileIdProviderModule from './transactionProfileIdProvider';

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
  it('provides default profileId state as null', () => {
    render(
      <TransactionProfileIdProvider transactionId={undefined}>
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
      <TransactionProfileIdProvider transactionId={MOCK_TRX_ID}>
        <MockComponent />
      </TransactionProfileIdProvider>
    );

    await waitFor(() => screen.findAllByTestId(MOCK_PROFILE_ID));
    expect(useProfileEventsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'trace.transaction:' + MOCK_TRX_ID,
      })
    );
    expect(useTransactionProfileIdSpy).toHaveReturnedWith(MOCK_PROFILE_ID);
  });
});
