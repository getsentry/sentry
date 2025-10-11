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

    expect(result.current.showbannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });

  it('org with chonk-ui shows tooltip prompt', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    await waitFor(() => expect(result.current.showbannerPrompt).toBe(true));
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
    });

    const {result} = renderHookWithProviders(() => useChonkPrompt(), {
      organization: OrganizationFixture({features: ['chonk-ui']}),
    });

    await waitFor(() => expect(result.current.showbannerPrompt).toBe(true));
    expect(result.current.showDotIndicatorPrompt).toBe(false);

    result.current.dismissBannerPrompt();

    expect(dismissMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'chonk_ui_banner',
          status: 'dismissed',
        }),
      })
    );

    await waitFor(() => expect(result.current.showbannerPrompt).toBe(false));
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

    await waitFor(() => expect(result.current.showbannerPrompt).toBe(false));
    expect(result.current.showDotIndicatorPrompt).toBe(true);

    result.current.dismissDotIndicatorPrompt();

    expect(dismissMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'chonk_ui_dot_indicator',
          status: 'dismissed',
        }),
      })
    );

    await waitFor(() => expect(result.current.showbannerPrompt).toBe(false));
    await waitFor(() => expect(result.current.showDotIndicatorPrompt).toBe(false));
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

    expect(result.current.showbannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });
});
