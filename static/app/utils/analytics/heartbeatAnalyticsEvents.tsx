export type HeartbeatEventParameters = {
  'heartbeat.onboarding_back_button_clicked': {
    from: string;
    to: string;
  };
  'heartbeat.onboarding_explore_sentry_button_clicked': {};
  'heartbeat.onboarding_first_error_received': {
    new_organization: boolean;
  };
  'heartbeat.onboarding_first_transaction_received': {
    new_organization: boolean;
  };
  'heartbeat.onboarding_go_to_issues_button_clicked': {};
  'heartbeat.onboarding_go_to_my_error_button_clicked': {
    new_organization: boolean;
  };
  'heartbeat.onboarding_go_to_performance_button_clicked': {};
  'heartbeat.onboarding_session_received': {
    new_organization: boolean;
  };
};

export const heartbeatEventMap: Record<keyof HeartbeatEventParameters, string> = {
  'heartbeat.onboarding_explore_sentry_button_clicked':
    'Heartbeat: Onboarding Explore Sentry Button Clicked',
  'heartbeat.onboarding_first_error_received':
    'Heartbeat: Onboarding First Error Received',
  'heartbeat.onboarding_first_transaction_received':
    'Heartbeat: Onboarding First Transaction Received',
  'heartbeat.onboarding_go_to_issues_button_clicked':
    'Heartbeat: Onboarding Go To Issues Button Clicked',
  'heartbeat.onboarding_go_to_my_error_button_clicked':
    'Heartbeat: Onboarding Go My Error Button Clicked',
  'heartbeat.onboarding_go_to_performance_button_clicked':
    'Heartbeat: Onboarding Go Performance Button Clicked',
  'heartbeat.onboarding_session_received': 'Heartbeat: Onboarding Session Received',
  'heartbeat.onboarding_back_button_clicked': 'Heartbeat: Onboarding Back Button Clicked',
};
