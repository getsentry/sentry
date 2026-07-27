import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSectionRuns} from './useSectionRuns';

describe('useSectionRuns', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function makeRun(groupId: string, overrides: Record<string, unknown> = {}) {
    return {
      id: `run-${groupId}`,
      groupId,
      source: 'autofix',
      lastTriggeredAt: '2026-07-14T09:00:00Z',
      outputs: [],
      ...overrides,
    };
  }

  it('fires no request and returns an empty map for no group ids', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [],
    });

    const {result} = renderHookWithProviders(() => useSectionRuns([]), {organization});

    expect(request).not.toHaveBeenCalled();
    expect(result.current.runMap.size).toBe(0);
    expect(result.current.runsPending).toBe(false);
  });

  it('batches group ids into one request and maps runs by groupId', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [makeRun('1'), makeRun('2')],
    });

    const {result} = renderHookWithProviders(() => useSectionRuns(['1', '2']), {
      organization,
    });

    await waitFor(() => expect(result.current.runMap.size).toBe(2));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/runs/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'type:explorer source:autofix group:[1, 2]',
          per_page: 2,
        }),
      })
    );
    expect(result.current.runMap.get('1')?.id).toBe('run-1');
    expect(result.current.runMap.get('2')?.id).toBe('run-2');
  });

  it('keeps the newest run when a group has more than one', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        makeRun('1', {id: 'old', lastTriggeredAt: '2026-07-10T00:00:00Z'}),
        makeRun('1', {id: 'new', lastTriggeredAt: '2026-07-14T00:00:00Z'}),
      ],
    });

    const {result} = renderHookWithProviders(() => useSectionRuns(['1']), {organization});

    await waitFor(() => expect(result.current.runMap.size).toBe(1));
    expect(result.current.runMap.get('1')?.id).toBe('new');
  });
});
