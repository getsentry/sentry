import {
  act,
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {OnboardingDrawerStore} from 'sentry/stores/onboardingDrawerStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {OnboardingSkipButton} from 'sentry/views/onboarding/components/onboardingSkipButton';
import {OnboardingStepId} from 'sentry/views/onboarding/types';

jest.mock('sentry/utils/analytics');

type MappedCase = {
  referrer: string;
  sidebarSource: string;
  stepId: OnboardingStepId;
};

const MAPPED_CASES: MappedCase[] = [
  {
    stepId: OnboardingStepId.WELCOME,
    sidebarSource: 'targeted_onboarding_welcome_skip',
    referrer: 'onboarding-welcome-skip',
  },
  {
    stepId: OnboardingStepId.SCM_CONNECT,
    sidebarSource: 'targeted_onboarding_scm_connect_skip',
    referrer: 'onboarding-scm-connect-skip',
  },
  {
    stepId: OnboardingStepId.SCM_PLATFORM_FEATURES,
    sidebarSource: 'targeted_onboarding_scm_platform_features_skip',
    referrer: 'onboarding-scm-platform-features-skip',
  },
  {
    stepId: OnboardingStepId.SCM_MESSAGING,
    sidebarSource: 'onboarding_sidebar',
    referrer: 'onboarding-scm-messaging-skip',
  },
  {
    stepId: OnboardingStepId.SETUP_DOCS,
    sidebarSource: 'targeted_onboarding_first_event_footer_skip',
    referrer: 'onboarding-first-event-footer-skip',
  },
];

describe('OnboardingSkipButton', () => {
  afterEach(async () => {
    try {
      cleanup();
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
    } finally {
      jest.useRealTimers();
      jest.clearAllMocks();
    }
  });

  it.each(MAPPED_CASES)(
    'renders and fires the expected analytics for $stepId',
    async ({stepId, sidebarSource, referrer}) => {
      jest.useFakeTimers();
      const openSpy = jest.spyOn(OnboardingDrawerStore, 'open');

      try {
        renderGlobalModal();
        const {router} = render(<OnboardingSkipButton stepId={stepId} />);

        const button = screen.getByRole('button', {name: 'Skip setup'});
        await userEvent.click(button, {delay: null});

        expect(trackAnalytics).toHaveBeenCalledWith(
          'onboarding.scm_header_skip_clicked',
          expect.objectContaining({opens_modal: true, step: stepId})
        );

        const dialog = within(screen.getByRole('dialog'));
        expect(openSpy).not.toHaveBeenCalled();
        await userEvent.click(
          dialog.getByRole('button', {
            name: "I'll read the docs myself",
          }),
          {delay: null}
        );

        expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
        expect(router.location.query.referrer).toBe(referrer);
        expect(trackAnalytics).toHaveBeenCalledWith(
          'onboarding.skip_reason_submitted',
          expect.objectContaining({step: stepId, reason: 'docs'})
        );

        jest.runAllTimers();

        expect(trackAnalytics).toHaveBeenCalledWith(
          'quick_start.opened',
          expect.objectContaining({source: sidebarSource})
        );
        expect(openSpy).toHaveBeenCalled();
      } finally {
        openSpy.mockRestore();
      }
    }
  );
});
