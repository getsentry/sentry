import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {useChonkPrompt} from './useChonkPrompt';

describe('useChonkPrompt', () => {
  beforeEach(() => {
    ConfigStore.loadInitialData(ConfigFixture());
    MockApiClient.clearMockResponses();
  });

  it('org without chonk-ui does not show prompts', () => {
    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: []}),
    });

    expect(result.current.showBannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });

  it('org with chonk-ui shows tooltip prompt', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    await waitFor(() => expect(result.current.showBannerPrompt).toBe(true));
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });

  it('org with chonk-ui-enforce does not show prompts', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui-enforce']}),
    });

    expect(result.current.showBannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });

  it('dismissing tooltip prompt shows dot indicator prompt', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });

    const dismissMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
      body: {
        data: {
          feature: 'chonk_ui_dot_indicator',
          status: 'snoozed',
        },
      },
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    await waitFor(() => expect(result.current.showBannerPrompt).toBe(true));
    expect(result.current.showDotIndicatorPrompt).toBe(false);

    result.current.snoozeBannerPrompt();

    expect(dismissMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'chonk_ui_banner',
          status: 'snoozed',
        }),
      })
    );

    await waitFor(() => expect(result.current.showBannerPrompt).toBe(false));
    await waitFor(() => expect(result.current.showDotIndicatorPrompt).toBe(true));
  });

  it('dismissing dot indicator prompt hides both prompts', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: Date.now() / 1000}},
      match: [MockApiClient.matchQuery({feature: 'chonk_ui_banner'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
      match: [MockApiClient.matchQuery({feature: 'chonk_ui_dot_indicator'})],
    });

    const dismissMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    await waitFor(() => expect(result.current.showBannerPrompt).toBe(false));
    expect(result.current.showDotIndicatorPrompt).toBe(true);

    result.current.snoozeDotIndicatorPrompt();

    expect(dismissMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'chonk_ui_dot_indicator',
          status: 'snoozed',
        }),
      })
    );

    await waitFor(() => expect(result.current.showBannerPrompt).toBe(false));
    await waitFor(() => expect(result.current.showDotIndicatorPrompt).toBe(false));
  });

  it('dismissed prompts more than 7 days ago are shown again', async () => {
    const oldTimestamp = Date.now() / 1000 - 8 * 24 * 60 * 60;

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/prompts-activity/',
      body: {
        data: {
          dismissed_ts: oldTimestamp,
        },
      },
      match: [MockApiClient.matchQuery({feature: 'chonk_ui_banner'})],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/prompts-activity/',
      body: {
        data: {
          dismissed_ts: oldTimestamp,
        },
      },
      match: [MockApiClient.matchQuery({feature: 'chonk_ui_dot_indicator'})],
    });

    const showPromptMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    await waitFor(() => {
      expect(showPromptMock.mock.calls[0][0]).toBe(
        '/organizations/org-slug/prompts-activity/'
      );
    });

    await waitFor(() => {
      expect(showPromptMock.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            feature: 'chonk_ui_banner',
            status: 'visible',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(showPromptMock.mock.calls[1][0]).toBe(
        '/organizations/org-slug/prompts-activity/'
      );
    });

    await waitFor(() => {
      expect(showPromptMock.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            feature: 'chonk_ui_dot_indicator',
            status: 'visible',
          }),
        })
      );
    });

    await waitFor(() => expect(result.current.showBannerPrompt).toBe(true));
    result.current.snoozeBannerPrompt();
    await waitFor(() => expect(result.current.showDotIndicatorPrompt).toBe(true));
  });

  it('user prefers chonk-ui does not show prompts', () => {
    ConfigStore.set(
      'user',
      UserFixture({
        options: {
          ...UserFixture().options,
          prefersChonkUI: true,
        },
      })
    );

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    expect(result.current.showBannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });
});
