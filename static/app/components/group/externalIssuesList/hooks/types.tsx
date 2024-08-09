interface BaseIssueAction {
  displayName: string;
  key: string;
  disabled?: boolean;
  displayIcon?: React.ReactNode;
}

/**
 * Linked issues that are already created
 */
interface LinkedIssue extends BaseIssueAction {
  /**
   * The only action external issues have is unlinking them
   */
  onUnlink: () => void;
  /**
   * The title used when creating the linked issue
   */
  title: string;
  url: string;
}

export interface ExternalIssueAction {
  name: string;
  /**
   * Usually opens a modal to create an external issue
   */
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
}

/**
 * Integrations, apps, or plugins that can create external issues.
 * Each integration can have one or more configurations.
 */
interface ExternalIssueIntegration extends BaseIssueAction {
  actions: ExternalIssueAction[];
}

/**
 * Each integration type will have a set of integrations and linked issues
 * eg - Sentry Apps, Integrations, Plugins each have a set of integrations and linked issues
 */
export interface IntegrationResult {
  integrations: ExternalIssueIntegration[];
  linkedIssues: LinkedIssue[];
  isLoading?: boolean;
}
