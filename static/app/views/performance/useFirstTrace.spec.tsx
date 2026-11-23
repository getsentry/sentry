import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, cleanup, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {useFirstTrace} from './useFirstTrace';

describe('useFirstTrace', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({firstTransactionEvent: true});
  const tracesUrl = `/organizations/${organization.slug}/traces/`;

  async function advance(ms: number) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  }

  function renderUseFirstTrace(onReady: () => void) {
    return renderHookWithProviders(
      () => useFirstTrace({organization, project, onReady}),
      {organization}
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    PageFiltersStore.init();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
    MockApiClient.addMockResponse({url: tracesUrl, body: {data: [], meta: {}}});
  });

  afterEach(async () => {
    try {
      cleanup();
      await act(() => jest.runOnlyPendingTimersAsync());
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls onReady once the first trace can be queried', async () => {
    const onReady = jest.fn();
    const {result} = renderUseFirstTrace(onReady);

    await advance(1);
    await advance(1);
    expect(result.current.received).toBe(true);
    expect(onReady).not.toHaveBeenCalled();

    MockApiClient.addMockResponse({
      url: tracesUrl,
      body: {data: [{trace: 'abc'}], meta: {}},
    });
    await advance(5_000);

    expect(result.current.traceId).toBe('abc');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('calls onReady when no trace can be queried within the wait limit', async () => {
    const onReady = jest.fn();
    const {result} = renderUseFirstTrace(onReady);

    await advance(1);
    await advance(2 * 60 * 1000);

    expect(result.current.traceId).toBeUndefined();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
