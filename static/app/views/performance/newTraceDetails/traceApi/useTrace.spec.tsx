import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useTrace} from './useTrace';

const organization = OrganizationFixture();
const queryClient = makeTestQueryClient();

describe('useTrace', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  describe('tracing endpoint query params', () => {
    const validUUid = '550e8400e29b41d4a716446655440000';
    const invalidUUid = 'notAuuid';

    it.each([
      [`?targetId=${invalidUUid}`],
      ['?targetId='],
      ['?someOtherParam=foo'],
      [`?eventId=${invalidUUid}`],
      [`?node=txn-${invalidUUid}`],
      [`?node=span-${invalidUUid}`],
      [`?node=error-${invalidUUid}`],
    ])('does NOT call EAP endpoint with errorId when URL has %s', async search => {
      // Set up mocked URL before hook runs
      window.history.pushState({}, '', `/some-path${search}`);

      const eapTraceMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/trace/test-trace-id/`,
        method: 'GET',
        body: [],
      });

      renderHookWithProviders(() =>
        useTrace({
          traceSlug: 'test-trace-id',
        })
      );

      // Wait for the hook to make the API call
      await waitFor(() => {
        expect(eapTraceMock).toHaveBeenCalled();
      });

      // Verify the API was called without errorId in the query params
      expect(eapTraceMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/trace/test-trace-id/`,
        expect.objectContaining({
          query: expect.not.objectContaining({
            errorId: expect.anything(),
          }),
        })
      );
    });

    it.each([
      {
        search: `?targetId=${validUUid}`,
        expectedParamKey: 'errorId',
      },
      {
        search: `?eventId=${validUUid}`,
        expectedParamKey: 'errorId',
      },
      {
        search: `?node=error-${validUUid}`,
        expectedParamKey: 'errorId',
      },
      {
        search: `?node=txn-${validUUid}`,
        expectedParamKey: 'errorId',
      },
    ])(
      'calls tracing endpoint with query param options %s',
      async ({search, expectedParamKey}) => {
        // Mock URL before hook runs
        window.history.pushState({}, '', `/some-path${search}`);

        const eapTraceMock = MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/trace/trace-test-id/`,
          method: 'GET',
          body: [],
        });

        renderHookWithProviders(() =>
          useTrace({
            traceSlug: 'trace-test-id',
          })
        );

        await waitFor(() => {
          expect(eapTraceMock).toHaveBeenCalled();
        });

        expect(eapTraceMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/trace/trace-test-id/`,
          expect.objectContaining({
            query: expect.objectContaining({
              [expectedParamKey]: validUUid,
            }),
          })
        );
      }
    );
  });
});
