export type OnboardingEventParameters = {
  'onboarding.back_button_clicked': {
    from: string;
    to: string;
  };
  'onboarding.explore_sentry_button_clicked': {
    platform: string;
    project_id: string;
  };
  'onboarding.first_error_processed': {
    new_organization: boolean;
    platform: string;
    project_id: string;
  };
  'onboarding.first_error_received': {
    new_organization: boolean;
    platform: string;
    project_id: string;
  };
  'onboarding.view_error_button_clicked': {
    new_organization: boolean;
    platform: string;
    project_id: string;
  };
  'onboarding.view_sample_error_button_clicked': {
    new_organization: boolean;
    platform: string;
    project_id: string;
  };
};

export const onboardingEventMap: Record<keyof OnboardingEventParameters, string> = {
  'onboarding.explore_sentry_button_clicked': 'Onboarding: Explore Sentry Button Clicked',
  'onboarding.first_error_received': 'Onboarding: First Error Received',
  'onboarding.first_error_processed': 'Onboarding: First Error Processed',
  'onboarding.view_error_button_clicked': 'Onboarding: Go To Issues Button Clicked',
  'onboarding.view_sample_error_button_clicked':
    'Onboarding: View Sample Error Button Clicked',
  'onboarding.back_button_clicked': 'Onboarding: Back Button Clicked',
};
