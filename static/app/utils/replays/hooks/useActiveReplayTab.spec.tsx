import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: false,
          userHasAcknowledged: false,
        },
      }),
    });
  });

  describe('when AI features are allowed', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/seer/setup-check/',
        body: AutofixSetupFixture({
          setupAcknowledgement: {
            orgHasAcknowledged: true,
            userHasAcknowledged: true,
          },
        }),
      });
    });

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

      it('should set the default tab if the name is invalid', () => {
        const {result, router} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          organization: OrganizationFixture({
            features: ['gen-ai-features', 'replay-ai-summaries'],
          }),
        });
        expect(result.current.getActiveTab()).toBe(TabKey.AI);

        act(() => result.current.setActiveTab('foo bar'));
        expect(router.location.query).toEqual({query: 'click.tag:button', t_main: 'ai'});
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
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/seer/setup-check/',
        body: AutofixSetupFixture({
          setupAcknowledgement: {
            orgHasAcknowledged: false,
            userHasAcknowledged: false,
          },
        }),
      });
    });

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

      it('should set the default tab if the name is invalid', () => {
        const {result, router} = renderHookWithProviders(useActiveReplayTab, {
          initialProps: {},
          organization: OrganizationFixture({features: []}),
        });
        expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

        act(() => result.current.setActiveTab('foo bar'));
        expect(router.location.query).toEqual({
          query: 'click.tag:button',
          t_main: 'breadcrumbs',
        });
      });
    });
  });

  it('should allow case-insensitive tab names', () => {
    const {result, router} = renderHookWithProviders(useActiveReplayTab, {
      initialProps: {},
      organization: OrganizationFixture({features: []}),
    });
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    act(() => result.current.setActiveTab('nEtWoRk'));

    expect(router.location.query).toEqual({
      query: 'click.tag:button',
      t_main: 'network',
    });
  });
});
