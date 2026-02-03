import type {ReactNode} from 'react';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function makeInitialRouterConfig({table}: {table: string}) {
  return {
    location: {
      pathname: `/organizations/org-slug/explore/traces/`,
      query: {table},
    },
  };
}

describe('useTab', () => {
  it('uses spans as default tab', () => {
    const {result} = renderHookWithProviders(useTab, {additionalWrapper: Wrapper});
    expect(result.current[0]).toEqual(Tab.SPAN);
  });

  it('uses span tab', () => {
    const {result} = renderHookWithProviders(useTab, {additionalWrapper: Wrapper});
    expect(result.current[0]).toEqual(Tab.SPAN);
  });

  it('uses trace tab', () => {
    const {result} = renderHookWithProviders(useTab, {
      additionalWrapper: Wrapper,
      initialRouterConfig: makeInitialRouterConfig({table: 'trace'}),
    });
    expect(result.current[0]).toEqual(Tab.TRACE);
  });

  it('sets span tab', () => {
    const {result} = renderHookWithProviders(useTab, {
      additionalWrapper: Wrapper,
      initialRouterConfig: makeInitialRouterConfig({table: 'trace'}),
    });
    expect(result.current[0]).toEqual(Tab.TRACE);
    act(() => result.current[1](Tab.SPAN));
    expect(result.current[0]).toEqual(Tab.SPAN);
  });

  it('sets trace tab', () => {
    const {result} = renderHookWithProviders(useTab, {additionalWrapper: Wrapper});
    expect(result.current[0]).toEqual(Tab.SPAN);
    act(() => result.current[1](Tab.TRACE));
    expect(result.current[0]).toEqual(Tab.TRACE);
  });
});
