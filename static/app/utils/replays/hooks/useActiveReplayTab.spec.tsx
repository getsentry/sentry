import * as qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {browserHistory} from 'sentry/utils/browserHistory';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {OrganizationContext} from 'sentry/views/organizationContext';

function mockLocation(query = '') {
  window.location.search = qs.stringify({query});
}

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    setWindowLocation('http://localhost/');
  });

  describe('without replay-ai-summaries feature flag', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: OrganizationFixture({
          features: [], // No replay-ai-summaries feature
        }),
      });
    });

    it('should use Breadcrumbs as a default', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext value={OrganizationFixture({features: []})}>
            {children}
          </OrganizationContext>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
    });

    it('should use Breadcrumbs as a default, when there is a click search in the url', () => {
      setWindowLocation('http://localhost/?query=click.tag:button');

      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext value={OrganizationFixture({features: []})}>
            {children}
          </OrganizationContext>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
    });

    it('should set the default tab if the name is invalid', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext value={OrganizationFixture({features: []})}>
            {children}
          </OrganizationContext>
        ),
      });
      expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

      result.current.setActiveTab('foo bar');
      expect(browserHistory.push).toHaveBeenLastCalledWith({
        pathname: '/',
        query: {t_main: TabKey.BREADCRUMBS},
      });
    });

    it('should allow case-insensitive tab names', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext value={OrganizationFixture({features: []})}>
            {children}
          </OrganizationContext>
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
  });

  describe('with replay-ai-summaries feature flag', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: OrganizationFixture({
          features: ['replay-ai-summaries'],
        }),
      });
    });

    it('should use AI as a default', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext
            value={OrganizationFixture({features: ['replay-ai-summaries']})}
          >
            {children}
          </OrganizationContext>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.AI);
    });

    it('should use AI as a default, when there is a click search in the url', () => {
      mockLocation('click.tag:button');

      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext
            value={OrganizationFixture({features: ['replay-ai-summaries']})}
          >
            {children}
          </OrganizationContext>
        ),
      });

      expect(result.current.getActiveTab()).toBe(TabKey.AI);
    });

    it('should set the default tab if the name is invalid', () => {
      const {result} = renderHook(useActiveReplayTab, {
        initialProps: {},
        wrapper: ({children}) => (
          <OrganizationContext
            value={OrganizationFixture({features: ['replay-ai-summaries']})}
          >
            {children}
          </OrganizationContext>
        ),
      });
      expect(result.current.getActiveTab()).toBe(TabKey.AI);

      result.current.setActiveTab('foo bar');
      expect(browserHistory.push).toHaveBeenLastCalledWith({
        pathname: '/',
        query: {t_main: TabKey.AI},
      });
    });
  });
});
