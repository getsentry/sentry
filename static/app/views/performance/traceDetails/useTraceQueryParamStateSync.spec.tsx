import {useEffect, useState} from 'react';

import {act, cleanup, render} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {useTraceQueryParamStateSync} from './useTraceQueryParamStateSync';

// Mounts with no search, then transitions to one — the shape the waterfall produces when
// somebody types into the trace search box.
function Probe({disabled}: {disabled?: boolean}) {
  const [search, setSearch] = useState<string | undefined>(undefined);
  useTraceQueryParamStateSync({search}, {disabled});

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setSearch('db');
  }, []);

  return null;
}

function ClearingProbe() {
  const [search, setSearch] = useState<string | undefined>('db');
  useTraceQueryParamStateSync({search});

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setSearch(undefined);
  }, []);

  return null;
}

describe('useTraceQueryParamStateSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setWindowLocation('http://localhost/');
  });

  afterEach(() => {
    try {
      cleanup();
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
    }
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

  it('removes the key and keeps other params when the state is cleared', async () => {
    setWindowLocation('http://localhost/trace/?search=db&keep=1');
    const {router} = render(<ClearingProbe />);

    await act(() => jest.runAllTimersAsync());

    expect(router.location.pathname).toBe('/trace/');
    expect(router.location.query).toEqual({keep: '1'});
  });
});
