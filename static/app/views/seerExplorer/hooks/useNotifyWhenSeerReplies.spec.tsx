import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import {useNotifyWhenSeerReplies} from 'sentry/views/seerExplorer/hooks/useNotifyWhenSeerReplies';

// The context reads browser support once at import time, and jsdom has no
// service worker, so the real provider can never report support.
jest.mock('sentry/serviceWorker/client/serviceWorkerContext');

const mockUseServiceWorker = jest.mocked(useServiceWorker);
const postMessage = jest.fn();

describe('useNotifyWhenSeerReplies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    postMessage.mockResolvedValue(undefined);
    mockUseServiceWorker.mockReturnValue({
      isServiceWorkerSupported: true,
      controller: {postMessage} as unknown as ReturnType<
        typeof useServiceWorker
      >['controller'],
    });
  });

  it('asks the worker to watch the run', () => {
    const organization = OrganizationFixture({
      features: ['seer-explorer-browser-notifications'],
    });

    const {result} = renderHookWithProviders(() => useNotifyWhenSeerReplies(), {
      organization,
    });

    result.current('run-42', '  why is checkout slow?  ');

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'event',
        name: 'seerExplorer.sendMessage',
        data: expect.objectContaining({
          organizationIdOrSlug: organization.slug,
          runId: 'run-42',
          notification: expect.objectContaining({
            body: expect.objectContaining({success: 'why is checkout slow?'}),
            navigateTo: expect.objectContaining({query: {explorerRunId: 'run-42'}}),
          }),
        }),
      })
    );
  });

  it('does nothing without the feature', () => {
    const {result} = renderHookWithProviders(() => useNotifyWhenSeerReplies(), {
      organization: OrganizationFixture({features: []}),
    });

    result.current(42, 'why is checkout slow?');

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no service worker', () => {
    mockUseServiceWorker.mockReturnValue({
      isServiceWorkerSupported: false,
      controller: {postMessage} as unknown as ReturnType<
        typeof useServiceWorker
      >['controller'],
    });

    const {result} = renderHookWithProviders(() => useNotifyWhenSeerReplies(), {
      organization: OrganizationFixture({
        features: ['seer-explorer-browser-notifications'],
      }),
    });

    result.current(42, 'why is checkout slow?');

    expect(postMessage).not.toHaveBeenCalled();
  });
});
