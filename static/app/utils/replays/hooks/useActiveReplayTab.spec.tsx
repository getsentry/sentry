import {MockApiClient} from 'sentry-test/api';
import {renderHook} from 'sentry-test/reactTestingLibrary';
import {TestStubs} from 'sentry-test/testStubs';
import {setWindowLocation} from 'sentry-test/utils';

import {OrganizationContext} from 'sentry/contexts/organizationContext';
import {browserHistory} from 'sentry/utils/browserHistory';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    setWindowLocation('http://localhost/');
  });

  describe('without replay-ai-summaries feature flag', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: TestStubs.Organization({
          features: [], // No replay-ai-summaries feature
        }),
      });
    });

    it('should use Breadcrumbs as a default', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext.Provider value={TestStubs.Organization({features: []})}>
            {children}
          </OrganizationContext.Provider>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
    });

    it('should use Breadcrumbs as a default, when there is a click search in the url', () => {
      setWindowLocation('http://localhost/?query=click.tag:button');

      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext.Provider value={TestStubs.Organization({features: []})}>
            {children}
          </OrganizationContext.Provider>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
    });

    it('should set the default tab if the name is invalid', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext.Provider value={TestStubs.Organization({features: []})}>
            {children}
          </OrganizationContext.Provider>
        ),
      });
      expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

      result.current.setActiveTab('foo bar');
      expect(browserHistory.push).toHaveBeenLastCalledWith({
        pathname: '/',
        query: {query: '', t_main: TabKey.BREADCRUMBS},
      });
    });
  });

  describe('with replay-ai-summaries feature flag', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: TestStubs.Organization({
          features: ['replay-ai-summaries'],
        }),
      });
    });

    it('should use AI as a default', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext.Provider
            value={TestStubs.Organization({features: ['replay-ai-summaries']})}
          >
            {children}
          </OrganizationContext.Provider>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.AI);
    });

    it('should use AI as a default, when there is a click search in the url', () => {
      mockLocation('click.tag:button');

      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext.Provider
            value={TestStubs.Organization({features: ['replay-ai-summaries']})}
          >
            {children}
          </OrganizationContext.Provider>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.AI);
    });

    it('should set the default tab if the name is invalid', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext.Provider
            value={TestStubs.Organization({features: ['replay-ai-summaries']})}
          >
            {children}
          </OrganizationContext.Provider>
        ),
      });
      expect(result.current.getActiveTab()).toBe(TabKey.AI);

      result.current.setActiveTab('foo bar');
      expect(browserHistory.push).toHaveBeenLastCalledWith({
        pathname: '/',
        query: {query: '', t_main: TabKey.AI},
      });
    });
  });

  it('should allow case-insensitive tab names', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {},
      wrapper: ({children}) => (
        <OrganizationContext.Provider value={TestStubs.Organization({features: []})}>
          {children}
        </OrganizationContext.Provider>
      ),
    });
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab('nEtWoRk');
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      state: undefined,
      query: {t_main: TabKey.NETWORK},
    });
  });

  it('should set the default tab if the name is invalid', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {},
    });
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab('foo bar');
    expect(browserHistory.push).toHaveBeenLastCalledWith({
      pathname: '/',
      query: {t_main: TabKey.BREADCRUMBS},
    });
  });
});
