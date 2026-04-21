import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
    stepId: OnboardingStepId.SCM_PROJECT_DETAILS,
    sidebarSource: 'targeted_onboarding_scm_project_details_skip',
    referrer: 'onboarding-scm-project-details-skip',
  },
  {
    stepId: OnboardingStepId.SETUP_DOCS,
    sidebarSource: 'targeted_onboarding_first_event_footer_skip',
    referrer: 'onboarding-first-event-footer-skip',
  },
];

describe('OnboardingSkipButton', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each(MAPPED_CASES)(
    'renders and fires the expected analytics for $stepId',
    async ({stepId, sidebarSource, referrer}) => {
      jest.useFakeTimers();
      const openSpy = jest.spyOn(OnboardingDrawerStore, 'open');

      try {
        render(<OnboardingSkipButton stepId={stepId} />);

        const button = screen.getByRole('button', {name: 'Skip setup'});
        expect(button).toHaveAttribute(
          'href',
          `/organizations/org-slug/issues/?referrer=${referrer}`
        );

        await userEvent.click(button, {delay: null});

        expect(trackAnalytics).toHaveBeenCalledWith(
          'onboarding.scm_header_skip_clicked',
          expect.objectContaining({step: stepId})
        );

        jest.runAllTimers();

        expect(trackAnalytics).toHaveBeenCalledWith(
          'quick_start.opened',
          expect.objectContaining({source: sidebarSource})
        );
        expect(openSpy).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
        openSpy.mockRestore();
      }
    }
  );

  it('renders nothing for unmapped steps', () => {
    const {container} = render(
      <OnboardingSkipButton stepId={OnboardingStepId.SELECT_PLATFORM} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
