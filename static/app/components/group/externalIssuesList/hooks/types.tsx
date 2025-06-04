interface BaseIssueAction {
  displayName: string;
  key: string;
  disabled?: boolean;
  disabledText?: string;
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
  id: string;
  name: string;
  /**
   * Usually opens a modal to create an external issue
   */
  onClick: () => void;
  disabled?: boolean;
  disabledText?: string;
  /**
   * Used with pluginActions to link to specific url
   * This is an external link
   */
  href?: string;
  /**
   * Optional subtext to display in the dropdown
   * Helps differentiate between actions with the same name
   */
  nameSubText?: string;
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
 */
export interface GroupIntegrationIssueResult {
  integrations: ExternalIssueIntegration[];
  linkedIssues: LinkedIssue[];
  isLoading?: boolean;
}
