import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useChonkPrompt} from './useChonkPrompt';

const queryClient = new QueryClient();
function makeWrapper(organization: Organization) {
  return function ({children}: {children: React.ReactNode}) {
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  };
}

describe('useChonkPrompt', () => {
  beforeEach(() => {
    ConfigStore.loadInitialData(ConfigFixture());
    MockApiClient.clearMockResponses();
  });

  it('org without chonk-ui does not show prompts', () => {
    const {result} = renderHook(() => useChonkPrompt(), {
      wrapper: makeWrapper(OrganizationFixture({features: []})),
    });

    expect(result.current.showbannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });

  it('org with chonk-ui shows tooltip prompt', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });

    const {result} = renderHook(() => useChonkPrompt(), {
      wrapper: makeWrapper(OrganizationFixture({features: ['chonk-ui']})),
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

    const {result} = renderHook(() => useChonkPrompt(), {
      wrapper: makeWrapper(OrganizationFixture({features: ['chonk-ui']})),
    });

    expect(result.current.showbannerPrompt).toBe(true);
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
      body: {data: {dismissed_ts: Date.now()}},
    });

    const dismissMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });

    const {result} = renderHook(() => useChonkPrompt(), {
      wrapper: makeWrapper(OrganizationFixture({features: ['chonk-ui']})),
    });

    expect(result.current.showbannerPrompt).toBe(false);
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

    const {result} = renderHook(() => useChonkPrompt(), {
      wrapper: makeWrapper(OrganizationFixture({features: ['chonk-ui']})),
    });

    expect(result.current.showbannerPrompt).toBe(false);
    expect(result.current.showDotIndicatorPrompt).toBe(false);
  });
});
