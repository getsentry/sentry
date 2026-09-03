import {useEffect, useState} from 'react';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {useTraceQueryParamStateSync} from './useTraceQueryParamStateSync';

// Mounts with no search, then transitions to one — the shape the waterfall produces when
// somebody types into the trace search box.
function Probe({disabled}: {disabled?: boolean}) {
  const [search, setSearch] = useState<string | undefined>(undefined);
  useTraceQueryParamStateSync({search}, {disabled});

  useEffect(() => {
    setSearch('db');
  }, []);

  return null;
}

describe('useTraceQueryParamStateSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('syncs changed state into the query string', async () => {
    const {router} = render(<Probe />);

    await act(() => jest.runAllTimersAsync());

    expect(router.location.query).toEqual(expect.objectContaining({search: 'db'}));
  });

  it('does not touch the query string when disabled', async () => {
    // Embedded waterfalls opt out so they cannot rewrite the host page's URL.
    const {router} = render(<Probe disabled />);

    await act(() => jest.runAllTimersAsync());

    expect(router.location.query).not.toHaveProperty('search');
  });
});
