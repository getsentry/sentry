import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {RUN_QUESTION_PROMPTS} from './runQuestions';
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
          question: RUN_QUESTION_PROMPTS,
          per_page: 2,
        }),
      })
    );
    expect(result.current.runMap.get('1')?.id).toBe('run-1');
    expect(result.current.runMap.get('2')?.id).toBe('run-2');
  });

  it('chunks more than ten group ids into separate capped requests', async () => {
    const groupIds = Array.from({length: 12}, (_, index) => String(index + 1));
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: groupIds.map(groupId => makeRun(groupId)),
    });

    renderHookWithProviders(() => useSectionRuns(groupIds), {organization});

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    const perPageValues = request.mock.calls.map(
      ([, options]: [string, {query: {per_page: number}}]) => options.query.per_page
    );
    expect(perPageValues).toEqual([10, 2]);
    perPageValues.forEach(perPage => expect(perPage).toBeLessThanOrEqual(10));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/runs/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: `type:explorer source:autofix group:[${groupIds.slice(0, 10).join(', ')}]`,
        }),
      })
    );
    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/runs/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'type:explorer source:autofix group:[11, 12]',
        }),
      })
    );
  });

  it('merges runs from every chunk into one map', async () => {
    const groupIds = Array.from({length: 12}, (_, index) => String(index + 1));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: groupIds.map(groupId => makeRun(groupId)),
    });

    const {result} = renderHookWithProviders(() => useSectionRuns(groupIds), {
      organization,
    });

    await waitFor(() => expect(result.current.runsPending).toBe(false));
    expect(result.current.runMap.get('1')?.id).toBe('run-1');
    expect(result.current.runMap.get('12')?.id).toBe('run-12');
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
