import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLogsTotalPayload} from 'sentry/views/explore/logs/useLogsTotalPayload';

describe('useLogsTotalPayload', () => {
  it('returns undefined when disabled', () => {
    const {result} = renderHookWithProviders(
      () => useLogsTotalPayload({enabled: false}),
      {
        organization: OrganizationFixture(),
      }
    );

    expect(result.current).toBeUndefined();
  });

  it('returns the sum(payload_size) value from the API when enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{'sum(payload_size)': 1_200_000_000_000}],
        meta: {
          fields: {'sum(payload_size)': 'size'},
          units: {'sum(payload_size)': 'byte'},
        },
      },
    });

    const {result} = renderHookWithProviders(() => useLogsTotalPayload({enabled: true}), {
      organization: OrganizationFixture(),
    });

    await waitFor(() => expect(result.current).toBe(1_200_000_000_000));
  });

  it('returns undefined when the API returns no data rows', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
        meta: {
          fields: {'sum(payload_size)': 'size'},
          units: {'sum(payload_size)': 'byte'},
        },
      },
    });

    const {result} = renderHookWithProviders(() => useLogsTotalPayload({enabled: true}), {
      organization: OrganizationFixture(),
    });

    await waitFor(() => expect(result.current).toBeUndefined());
  });
});
