import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {TabKey, useActiveReplayTab} from 'sentry/utils/replays/hooks/useActiveReplayTab';

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({}),
    });
  });

  describe('when AI features are allowed', () => {
    describe('AI summary tab is default', () => {
      it('should use AI summary as a default', () => {
        const {result} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          organization: OrganizationFixture({
            features: ['gen-ai-features', 'replay-ai-summaries'],
          }),
        });

        expect(result.current.getActiveTab()).toBe(TabKey.AI);
      });

      it('should use Breadcrumbs as a default, when there is a click search in the url', () => {
        setWindowLocation('http://localhost/?query=click.tag:button');

        const {result} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          organization: OrganizationFixture({
            features: ['gen-ai-features', 'replay-ai-summaries'],
          }),
        });

        expect(result.current.getActiveTab()).toBe(TabKey.AI);
      });

      it('should set the default tab if the name is invalid', async () => {
        const {result, router} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          initialRouterConfig: {
            location: {pathname: '/mock-pathname/', query: {query: 'click.tag:button'}},
          },
          organization: OrganizationFixture({
            features: ['gen-ai-features', 'replay-ai-summaries'],
          }),
        });
        expect(result.current.getActiveTab()).toBe(TabKey.AI);

        act(() => result.current.setActiveTab('foo bar'));
        await waitFor(() => {
          expect(router.location.query).toEqual({
            query: 'click.tag:button',
            t_main: 'ai',
          });
        });
      });

      it('should use AI as default for video replays when replay-ai-summaries-mobile is enabled', () => {
        const {result} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {isVideoReplay: true},
          organization: OrganizationFixture({
            features: [
              'gen-ai-features',
              'replay-ai-summaries',
              'replay-ai-summaries-mobile',
            ],
          }),
        });

        expect(result.current.getActiveTab()).toBe(TabKey.AI);
      });

      it('should use Breadcrumbs as default for video replays when replay-ai-summaries-mobile is NOT enabled', () => {
        const {result} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {isVideoReplay: true},
          organization: OrganizationFixture({
            features: ['gen-ai-features', 'replay-ai-summaries'],
          }),
        });

        expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
      });
    });
  });

  describe('when AI features are not allowed', () => {
    describe('breadcrumbs tab is default', () => {
      it('should use Breadcrumbs as a default', () => {
        const {result} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          organization: OrganizationFixture({features: []}),
        });

        expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
      });

      it('should use Breadcrumbs as a default, when there is a click search in the url', () => {
        setWindowLocation('http://localhost/?query=click.tag:button');

        const {result} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          organization: OrganizationFixture({features: []}),
        });

        expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
      });

      it('should set the default tab if the name is invalid', async () => {
        const {result, router} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          initialRouterConfig: {
            location: {pathname: '/mock-pathname/', query: {query: 'click.tag:button'}},
          },
          organization: OrganizationFixture({features: []}),
        });
        expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

        act(() => result.current.setActiveTab('foo bar'));
        await waitFor(() => {
          expect(router.location.query).toEqual({
            query: 'click.tag:button',
            t_main: 'breadcrumbs',
          });
        });
      });
    });
  });

  it('should allow case-insensitive tab names', async () => {
    const {result, router} = renderHookWithProviders(useActiveReplayTab, {
      initialProps: {},
      initialRouterConfig: {
        location: {pathname: '/mock-pathname/', query: {query: 'click.tag:button'}},
      },
      organization: OrganizationFixture({features: []}),
    });
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    act(() => result.current.setActiveTab('nEtWoRk'));
    await waitFor(() => {
      expect(router.location.query).toEqual({
        query: 'click.tag:button',
        t_main: 'network',
      });
    });
  });

  it('should clear replay detail filters when changing tabs', async () => {
    const {result, router} = renderHookWithProviders(useActiveReplayTab, {
      initialProps: {},
      initialRouterConfig: {
        location: {
          pathname: '/mock-pathname/',
          query: {
            query: 'click.tag:button',
            f_c_logLevel: ['error'],
            f_n_search: 'pokemon',
            n_detail_row: '0',
            n_detail_tab: 'response',
          },
        },
      },
      organization: OrganizationFixture({features: []}),
    });

    act(() => result.current.setActiveTab('network'));

    await waitFor(() => {
      expect(router.location.query).toEqual({
        query: 'click.tag:button',
        t_main: 'network',
      });
    });
  });

  it('should update the tab query parameter shallowly', async () => {
    const onUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();

    const {result, router} = renderHookWithProviders(useActiveReplayTab, {
      initialProps: {},
      initialRouterConfig: {
        location: {pathname: '/mock-pathname/', query: {}},
      },
      organization: OrganizationFixture({features: []}),
      additionalWrapper: ({children}) => (
        <SentryNuqsTestingAdapter
          defaultOptions={{shallow: false}}
          onUrlUpdate={onUrlUpdate}
        >
          {children}
        </SentryNuqsTestingAdapter>
      ),
    });

    act(() => result.current.setActiveTab('network'));

    await waitFor(() => {
      expect(router.location.query.t_main).toBe('network');
    });

    expect(onUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryString: '?t_main=network',
        options: expect.objectContaining({shallow: true}),
      })
    );
  });
});
