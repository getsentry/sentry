import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerEnableNotifications} from 'sentry/components/events/autofix/v3/seerEnableNotifications';

// Service workers and the Notification API do not exist in jsdom, and
// `supportsNotifications` is read once at module scope, so there is no store or
// fixture that can put this component into its eligible state. Standing in the
// two capability hooks is the only way to exercise the branch at all.
jest.mock('sentry/serviceWorker/client/serviceWorkerContext', () => ({
  ...jest.requireActual('sentry/serviceWorker/client/serviceWorkerContext'),
  useServiceWorker: () => ({
    isServiceWorkerSupported: true,
    controller: {postMessage: jest.fn()},
  }),
}));

jest.mock('sentry/serviceWorker/client/useNotificationPermission', () => ({
  ...jest.requireActual('sentry/serviceWorker/client/useNotificationPermission'),
  useNotificationPermission: () => ({
    permission: 'default',
    supportsNotifications: true,
    askNotificationPermission: jest.fn(),
  }),
}));

const NOTIFY_BUTTON = "Notify me when it's ready";

describe('SeerEnableNotifications', () => {
  let promptsRequest: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    promptsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {}},
    });
  });

  it('offers to notify while a run is processing', async () => {
    render(<SeerEnableNotifications status="processing" />, {
      organization: OrganizationFixture({features: ['autofix-browser-notifications']}),
    });

    expect(await screen.findByRole('button', {name: NOTIFY_BUTTON})).toBeInTheDocument();
    expect(promptsRequest).toHaveBeenCalled();
  });

  it('stays quiet in code mode, where the agent owns the run', () => {
    render(<SeerEnableNotifications status="processing" />, {
      // Code mode needs the Explorer's own prerequisites alongside its flag,
      // since a run can only move to chat when chat is reachable.
      organization: OrganizationFixture({
        features: [
          'autofix-browser-notifications',
          'seer-explorer-code-mode-tools',
          'seer-explorer',
          'gen-ai-features',
        ],
        openMembership: true,
        hideAiFeatures: false,
      }),
    });

    // Being ineligible short-circuits the prompt lookup, so nothing can arrive
    // late and render the button after this assertion.
    expect(promptsRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: NOTIFY_BUTTON})).not.toBeInTheDocument();
  });
});
