// https://github.com/getsentry/relay/blob/master/relay-common/src/constants.rs
// Note: the value of the enum on the frontend is plural,
// but the value of the enum on the backend is singular
export enum DataCategory {
  DEFAULT = 'default',
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  ATTACHMENTS = 'attachments',
  TRANSACTIONS_PROCESSED = 'transactions_processed',
}

export enum SentryInitRenderReactComponent {
  INDICATORS = 'Indicators',
  SETUP_WIZARD = 'SetupWizard',
  SYSTEM_ALERTS = 'SystemAlerts',
  U2F_SIGN = 'U2fSign',
  SU_ACCESS_FORM = 'SuperuserAccessForm',
}

export enum OnboardingTaskKey {
  FIRST_PROJECT = 'create_project',
  FIRST_EVENT = 'send_first_event',
  INVITE_MEMBER = 'invite_member',
  SECOND_PLATFORM = 'setup_second_platform',
  USER_CONTEXT = 'setup_user_context',
  RELEASE_TRACKING = 'setup_release_tracking',
  SOURCEMAPS = 'setup_sourcemaps',
  USER_REPORTS = 'setup_user_reports',
  ISSUE_TRACKER = 'setup_issue_tracker',
  ALERT_RULE = 'setup_alert_rules',
  FIRST_TRANSACTION = 'setup_transactions',
  METRIC_ALERT = 'setup_metric_alert_rules',
  USER_SELECTED_PROJECTS = 'setup_userselected_projects',
  /// Customized card that shows the selected integrations during onboarding
  INTEGRATIONS = 'integrations',
  /// Regular card that tells the user to setup integrations if no integrations were selected during onboarding
  FIRST_INTEGRATION = 'setup_integrations',
}

export enum SessionField {
  SESSION = 'session',
  SESSION_DURATION = 'session.duration',
  USER = 'user',
}
export enum SessionFieldWithOperation {
  SESSIONS = 'sum(session)',
  USERS = 'count_unique(user)',
  DURATION = 'p50(session.duration)',
}

export enum SessionStatus {
  HEALTHY = 'healthy',
  ABNORMAL = 'abnormal',
  ERRORED = 'errored',
  CRASHED = 'crashed',
}
