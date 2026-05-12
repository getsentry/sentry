from .base import (
    FeatureHandlerStrategy,
    OrganizationFeature,
    ProjectFeature,
    ProjectPluginFeature,
    SystemFeature,
)
from .manager import FeatureManager

# XXX: See `features/__init__.py` for documentation on how to use feature flags


def register_temporary_features(manager: FeatureManager) -> None:
    """
    These flags are temporary. These flags exist as a way for us to gate newly
    developed features.

    [!!] THESE FLAGS ARE INTENDED TO BE REMOVED!

    [!!] Leaving around feature flags in the codebase introduces complexity
         that will constantly need to be understood! Complexity leads to longer
         times developing features, higher chance of introducing bugs, and
         overall less happiness working in sentry.

         CLEAN UP YOUR FEATURE FLAGS!
    """
    # No formatting so that we can keep them as single lines
    # fmt: off

    # NOTE: Please maintain alphabetical order when adding new feature flags

    # Features that don't use resource scoping #
    ############################################

    # FLAGPOLE NOTE:
    # You won't be able to control system feature flags with flagpole, as flagpole only handles
    # organization or project scoped features. You would need to use an option instead.

    # Enable creating organizations within sentry (if SENTRY_SINGLE_ORGANIZATION is not enabled).
    manager.add("organizations:create", SystemFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Controls whether or not the relocation endpoints can be used.
    manager.add("relocation:enabled", SystemFeature, FeatureHandlerStrategy.INTERNAL)

    # Organization scoped features that are in development or in customer trials. #
    ###############################################################################

    # Enables alert creation on indexed events in UI (use for PoC/testing only)
    manager.add("organizations:alert-allow-indexed", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-based issue detection for an organization
    manager.add("organizations:ai-issue-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anomaly detection feature for EAP spans
    manager.add("organizations:anomaly-detection-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable array fields in trace item details endpoint
    manager.add("organizations:trace-item-details-array-fields", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the cron job to auto-enable codecov integrations.
    manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enabled for orgs that participated in the code review beta
    manager.add("organizations:code-review-beta", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable A/B testing experiments for code review (org eligibility)
    manager.add("organizations:code-review-experiments-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable continuous profiling
    manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the ingestion of profile functions metrics into EAP
    manager.add("projects:profile-functions-metrics-eap-ingestion", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables read only dashboards
    manager.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enables custom editable dashboards
    manager.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enable unfurling of dashboard widgets in Slack
    manager.add("organizations:dashboards-widget-unfurl", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables import/export functionality for dashboards
    manager.add("organizations:dashboards-import", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics enhanced performance for AM2+ customers as they transition from AM2 to AM3
    manager.add("organizations:dashboards-metrics-transition", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable drilldown flow for dashboards
    manager.add("organizations:dashboards-drilldown-flow", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable prebuilt dashboards for insights modules
    manager.add("organizations:dashboards-prebuilt-insights-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the details widget for dashboards
    manager.add("organizations:dashboards-details-widget", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable text widgets for dashboards
    manager.add("organizations:dashboards-text-widgets", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Insights to Dashboards UI migration
    manager.add("organizations:insights-to-dashboards-ui-rollout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered dashboard generation via Seer
    manager.add("organizations:dashboards-ai-generate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered dashboard editing via Seer
    manager.add("organizations:dashboards-ai-generate-edit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable dashboard revisions (revision tracking and revert)
    manager.add("organizations:dashboards-revisions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy
    manager.add("organizations:data-secrecy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Defer issue resolution from commit push to release creation
    manager.add("organizations:defer-commit-resolution", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Data Secrecy v2 (with Break the Glass feature)
    manager.add("organizations:data-secrecy-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Intercom support widget (replaces Zendesk when enabled)
    manager.add("organizations:intercom-support", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable default anomaly detection metric monitor for new projects
    manager.add("organizations:default-anomaly-detector", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the discover saved queries deprecation warnings
    manager.add("organizations:discover-saved-queries-deprecation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable migration of transaction widgets and queries to spans
    manager.add("organizations:migrate-transaction-queries-to-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable migration of transaction alerts and queries to spans
    manager.add("organizations:migrate-transaction-alerts-to-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable migration of AM1 metrics alerts to transactions
    manager.add("organizations:migrate-am1-metrics-alerts-to-transactions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable trace-based health checks rule in dynamic sampling
    manager.add("organizations:ds-health-checks-trace-based", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=False)
    # Enable custom dynamic sampling rates
    manager.add("organizations:dynamic-sampling-custom", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable dynamic sampling minimum sample rate
    manager.add("organizations:dynamic-sampling-minimum-sample-rate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable explore -> errors ui
    manager.add("organizations:explore-errors", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable returning the migrated discover queries in explore saved queries
    manager.add("organizations:expose-migrated-discover-queries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:gen-ai-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'translate' functionality for GenAI on the explore > traces page
    manager.add("organizations:gen-ai-search-agent-translate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI search bar on the explore > metrics tab
    manager.add("organizations:gen-ai-explore-metrics-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI consent
    manager.add("organizations:gen-ai-consent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable LLM-generated title and description for external issue details
    manager.add("organizations:external-issues-ai-generate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable increased issue_owners rate limit for auto-assignment
    manager.add("organizations:increased-issue-owners-rate-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Starfish: extract metrics from the spans
    manager.add("organizations:indexed-spans-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # These flags follow the pattern expected by IntegrationProvider.requires_feature_flag's usage on the config endpoint
    manager.add("organizations:integrations-claude-code", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-github-copilot-agent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-github-platform-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:scm-repositories-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:github-repo-auto-sync-webhook", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:integrations-slack-staging", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # API-driven integration setup pipeline (per-provider rollout)
    # ...
    # Project Management Integrations Feature Parity Flags
    manager.add("organizations:integrations-github-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-github_enterprise-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-gitlab-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Temporary: log full Jira Cloud `issue.updated` webhook payloads so we can design project-change link rewriting.
    manager.add("organizations:jira-issue-updated-payload-logging", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable inviting billing members to organizations at the member limit.
    manager.add("organizations:invite-billing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Enable inviting members to organizations.
    manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable rate limits for inviting members.
    manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enable flamegraph visualization for MetricKit hang diagnostic stack traces
    manager.add("organizations:metrickit-flamegraph", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables higher limit for alert rules
    manager.add("organizations:more-fast-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:more-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable higher limit for workflows
    manager.add("organizations:more-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Extract on demand metrics
    manager.add("organizations:on-demand-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics (experimental features)
    manager.add("organizations:on-demand-metrics-extraction-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics (widget extraction)
    manager.add("organizations:on-demand-metrics-extraction-widgets", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Display on demand metrics related UI elements
    manager.add("organizations:on-demand-metrics-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display on demand metrics related UI elements, for dashboards and widgets. The other flag is for alerts.
    manager.add("organizations:on-demand-metrics-ui-widgets", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Only enabled in sentry.io to enable onboarding flows.
    manager.add("organizations:onboarding", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable copy setup instructions button on onboarding surfaces
    manager.add("organizations:onboarding-copy-setup-instructions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable copy setup instructions button on project creation getting-started page
    manager.add("organizations:onboarding-copy-setup-instructions-project-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new onboarding welcome and SDK setup UI
    manager.add("organizations:onboarding-new-welcome-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable SCM-first onboarding flow with provider connection, platform detection, and feature selection steps
    manager.add("organizations:onboarding-scm", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Experiment: SCM onboarding A/B test measuring conversion impact
    manager.add("organizations:onboarding-scm-experiment", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Experiment: SCM onboarding project details A/B test
    manager.add("organizations:onboarding-scm-project-details-experiment", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable large ownership rule file size limit
    manager.add("organizations:ownership-size-limit-large", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable xlarge ownership rule file size limit
    manager.add("organizations:ownership-size-limit-xlarge", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables new page frame UI design
    manager.add("organizations:page-frame", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables setting the fetch all custom measurements request time range to match the user selected time range instead of 90 days
    manager.add("organizations:performance-discover-get-custom-measurements-reduced-range", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Detect performance issues in the new standalone spans pipeline instead of on transactions
    manager.add("organizations:performance-issues-spans", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Re-enable histograms for Metrics Enhanced Performance Views
    manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable removing the fallback for metrics compatibility
    manager.add("organizations:performance-remove-metrics-compatibility-fallback", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI and MCP module dashboards on dashboards platform
    manager.add("organizations:insights-ai-and-mcp-dashboard-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable all registered prebuilt dashboards to be synced to the database
    manager.add("organizations:dashboards-sync-all-registered-prebuilt-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable sentry convention fields
    manager.add("organizations:performance-sentry-conventions-fields", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable querying spans fields stats from comparative workflows project
    manager.add("organizations:performance-spans-fields-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable transaction name only search
    manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Suggestions for Web Vitals Module
    manager.add("organizations:performance-web-vitals-seer-suggestions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the warning banner to inform users of pending deprecation of the transactions dataset
    manager.add("organizations:performance-transaction-deprecation-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod_artifact webhook subscription UI in Sentry App settings
    manager.add("organizations:preprod-artifact-webhooks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod PR comments for build distribution
    manager.add("organizations:preprod-build-distribution-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod PR comments for snapshots
    manager.add("organizations:preprod-snapshot-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable enforcement of preprod size quota checks (when disabled, size quota checks always return True)
    manager.add("organizations:preprod-enforce-size-quota", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable enforcement of preprod distribution quota checks (when disabled, distribution quota checks always return True)
    manager.add("organizations:preprod-enforce-distribution-quota", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable preprod size monitors frontend
    manager.add("organizations:preprod-size-monitors-frontend", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod snapshots product feature
    manager.add("organizations:preprod-snapshots", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables PR page
    manager.add("organizations:pr-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use ProjectRepository FK for code mapping and Seer repo queries
    manager.add("organizations:project-repository-fk-reads", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the playstation ingestion in relay
    manager.add("organizations:relay-playstation-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables new error processing pipeline in Relay.
    manager.add("organizations:relay-new-error-processing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Add a random trace ID to events that lack one in Relay.
    manager.add("organizations:relay-default-trace-id", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables recording processing errors to analytics for product validation
    manager.add("organizations:processing-error-analytics", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=True)
    manager.add("organizations:processing-errors-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:sourcemap-issue-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable profiling
    manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enabled for those orgs who participated in the profiling Beta program
    manager.add("organizations:profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enables dropping of profiles that may come from buggy sdks
    manager.add("organizations:profiling-reject-sdks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable global suspect functions in profiling
    manager.add("organizations:profiling-global-suspect-functions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable function trends widgets in profiling
    manager.add("organizations:profiling-function-trends", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay AI summaries for mobile replays
    manager.add("organizations:replay-ai-summaries-mobile", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay AI summaries for web replays
    manager.add("organizations:replay-ai-summaries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable reading replay details using EAP query
    manager.add("organizations:replay-details-eap-query", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable using the events replays dataset
    manager.add("organizations:events-use-replays-dataset", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable using the events api with a sql interface
    manager.add("organizations:events-sql-grammar-api", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Add build code and build number to semver ordering
    manager.add("organizations:semver-ordering-with-build-code", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable revocation of org auth keys when a user renames an org slug
    manager.add("organizations:revoke-org-auth-on-slug-rename", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Seer PR code review for GitHub Enterprise Server organizations
    manager.add("organizations:seer-code-review-github-enterprise", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the Seer Config Reminder in the primary nav
    manager.add("organizations:seer-config-reminder", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Agent panel for AI-powered data exploration
    manager.add("organizations:seer-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Agent Index job
    manager.add("organizations:seer-explorer-index", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Night Shift nightly autofix cron
    manager.add("organizations:seer-night-shift", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display nightshift settings
    manager.add("organizations:seer-night-shift-settings", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable context engine for Seer Agent
    manager.add("organizations:seer-explorer-context-engine", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable context engine experimental contexts
    manager.add("organizations:context-engine-experiments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable frontend override for context engine (only for AI/ML/Reasoning platform team)
    manager.add("organizations:seer-explorer-context-engine-allow-fe-override", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable frontend override UI component for context engine (only for AI/ML/Reasoning platform team)
    manager.add("organizations:seer-explorer-context-engine-fe-override-ui-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code editing tools in Seer Agent chat
    manager.add("organizations:seer-explorer-chat-coding", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code mode tools (sentry_api_search/execute) in Seer Agent
    manager.add("organizations:seer-explorer-code-mode-tools", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code mode tools for Slack-initiated Explorer sessions
    manager.add("organizations:seer-slack-code-mode", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the thinking blocks toggle in the Seer Agent top bar
    manager.add("organizations:seer-explorer-thinking-blocks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable client-side UI tools for Seer Agent
    manager.add("organizations:seer-explorer-ui-tools", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable structured LLM context (JSON snapshot) instead of ASCII DOM snapshot
    manager.add("organizations:context-engine-structured-page-context", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Allow root_cause as a valid automated run stopping point and org-level default
    manager.add("organizations:root-cause-stopping-point", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the Seer Wizard and related prompts/links/banners
    manager.add("organizations:seer-wizard", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the Seer issues view
    manager.add("organizations:seer-issue-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Autofix to use Seer Agent instead of legacy Celery pipeline
    manager.add("organizations:autofix-on-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable autofix introspection for early stopping of autofix runs
    manager.add("organizations:seer-autofix-introspection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Workflows in Slack
    manager.add("organizations:seer-slack-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Agent in Slack via @mentions
    manager.add("organizations:seer-slack-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Show Seer run ID in Slack notification footers
    manager.add("organizations:seer-run-id-in-slack", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Seer activity events in the issue activity timeline
    manager.add("organizations:seer-activity-timeline", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Gate outbox-based mirroring of SeerRun records to Seer
    manager.add("organizations:seer-run-mirror", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Gate outbox-based mirroring for autofix writes
    manager.add("organizations:seer-run-mirror-autofix", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Gate outbox-based mirroring for explorer writes
    manager.add("organizations:seer-run-mirror-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable search query attribute validation
    manager.add("organizations:search-query-attribute-validation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder raw search replacement
    manager.add("organizations:search-query-builder-raw-search-replacement", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:seer-agent-pr-consolidation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Seer Autopilot
    manager.add("organizations:seer-autopilot", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disables the enableSeerCoding setting, preventing orgs from changing code generation behavior
    manager.add("organizations:seer-disable-coding-setting", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GitLab as a supported SCM provider for Seer
    manager.add("organizations:seer-gitlab-support", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable select orgs from ingesting mobile replay events.
    # Enable double-read from EAP for session health data validation
    manager.add("organizations:session-health-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:session-replay-video-disabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable data scrubbing of replay recording payloads in Relay.
    manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable core Session Replay link in the sidebar
    manager.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable the rendering of @sentry/toolbar inside the sentry app. See `useInitSentryToolbar()`
    manager.add("organizations:init-sentry-toolbar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable new stack trace component for issue details
    manager.add("organizations:issue-details-new-stack-trace", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable double-reading from EAP for issue feed search queries
    manager.add("organizations:issue-feed.eap-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Remove trace and breadcrumbs from issue summary input
    manager.add("organizations:issue-summary-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable suspect feature tags endpoint.
    manager.add("organizations:issues-suspect-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Lets organizations manage grouping configs
    manager.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable SAML2 Single-logout
    manager.add("organizations:sso-saml2-slo", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable visibility and access to insight modules
    manager.add("organizations:insight-modules", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Make insights modules restrict queries to 30 days
    manager.add("organizations:insights-query-date-range-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Make Insights overview pages use EAP instead of transactions (because eap is not on AM1)
    manager.add("organizations:insights-modules-use-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to insights metrics alerts
    manager.add("organizations:insights-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable data browsing heat map widget
    manager.add("organizations:data-browsing-heat-map-widget", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable data browsing widget unfurl
    manager.add("organizations:data-browsing-widget-unfurl", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable public RPC endpoint for local seer development
    manager.add("organizations:seer-public-rpc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Organizations on the old usage-based (v0) Seer plan
    manager.add("organizations:seer-added", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Organizations on the new seat-based Seer plan
    manager.add("organizations:seat-based-seer-enabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Render Sentry App schema-backed forms using the backend JSON form adapter.
    manager.add("organizations:sentry-app-schema-form-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new SentryApp webhook request endpoint
    manager.add("organizations:sentry-app-webhook-requests", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable mobile starfish ui module view
    manager.add("organizations:starfish-mobile-ui-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable static ClickHouse sampling for `OrganizationTagsEndpoint`
    manager.add("organizations:tag-key-sample-n", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable dynamic grouping UI (top issues)
    manager.add("organizations:top-issues-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to use span only trace endpoint.
    manager.add("organizations:trace-spans-format", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extraction metrics for transactions during ingestion.
    manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable feature to load explore link for transaction widgets
    manager.add("organizations:transaction-widget-deprecation-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Normalize URL transaction names during ingestion.
    manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables view hierarchy attachment scrubbing
    manager.add("organizations:view-hierarchy-scrubbing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable AI-powered assertion suggestions for uptime monitors
    manager.add("organizations:uptime-ai-assertion-suggestions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable task-based retry for out-of-order uptime results
    manager.add("organizations:uptime-backlog-retry", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable storing HTTP response captures for uptime monitor failures
    manager.add("organizations:uptime-response-capture", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=True)
    # Enable auto spam classification at User Feedback ingest time
    manager.add("organizations:user-feedback-spam-ingest", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable view hierarchies options
    manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable an async queue for dashboard widget queries
    manager.add("organizations:visibility-dashboards-async-queue", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new explore page
    manager.add("organizations:visibility-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable high date range options on new explore page
    manager.add("organizations:visibility-explore-range-high", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Update action status when integration is installed/deleted
    manager.add("organizations:update-action-status", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable logging to debug workflow engine process workflows
    manager.add("organizations:workflow-engine-process-workflows-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Creation of Metric Alerts that use the `group_by` field in the workflow_engine
    manager.add("organizations:workflow-engine-metric-alert-group-by-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable ingestion through trusted relays only
    manager.add("organizations:ingest-through-trusted-relays-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable issue stream detector notifications for metric issues
    manager.add("organizations:workflow-engine-metric-issue-disable-issue-detector-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new workflow_engine UI (see: alerts create issues)
    manager.add("organizations:workflow-engine-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable redirects from alert rules to the new workflow_engine UI
    manager.add("organizations:workflow-engine-redirect-opt-out", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use workflow engine serializers to return data for old rule / incident endpoints
    manager.add("organizations:workflow-engine-rule-serializers", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use workflow engine exclusively for OrganizationCombinedRuleIndexEndpoint.get results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-combinedruleindex-get", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy issue alert rule.get results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-issue-alert-endpoints-get", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy issue alert rule.post results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-issue-alert-endpoints-post", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy issue alert rule.put results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-issue-alert-endpoints-put", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy metric alert rule.post results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-metric-alert-endpoints-post", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy metric alert rule.put results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-metric-alert-endpoints-put", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy metric alert rule.get results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-metric-alert-endpoints-get", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy metric alert endpoint DELETE.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-metric-alert-endpoints-delete", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy issue alert rule.delete
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-issue-alert-endpoints-delete", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for OrganizationAlertRuleDetailsEndpoint.delete.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-orgalertruledetails-delete", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable metric detector limits by plan type
    manager.add("organizations:workflow-engine-metric-detector-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product (known internally as ourlogs) in UI and backend
    manager.add("organizations:ourlogs-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product to be ingested via Relay.
    manager.add("organizations:ourlogs-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs stats to be displayed in the UI.
    manager.add("organizations:ourlogs-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the export modal (rather than direct button click) in the logs UI
    manager.add("organizations:ourlogs-modal-export", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable pinning logs to the top of the table in the logs UI and query parameters
    manager.add("organizations:ourlogs-pinning", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable removing the schema hints section to declutter the logs UI
    manager.add("organizations:ourlogs-schema-hints-removal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the expand/collapse table height toggle in the logs UI
    manager.add("organizations:ourlogs-table-expando", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable various explore related dev features, may be used by internal branches for testing.
    manager.add("organizations:explore-dev-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable alerting on trace metrics
    manager.add("organizations:tracemetrics-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics product (known internally as tracemetrics) in UI and backend
    manager.add("organizations:tracemetrics-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable equations for trace metrics in alerts
    manager.add("organizations:tracemetrics-equations-in-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable equations in trace metrics explore
    manager.add("organizations:tracemetrics-equations-in-explore", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable equations for trace metrics in dashboards
    manager.add("organizations:tracemetrics-equations-in-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics product to be ingested via Relay
    manager.add("organizations:tracemetrics-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics multi-metric selection in dashboards
    manager.add("organizations:tracemetrics-multi-metric-selection-in-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics units in trace view UI
    manager.add("organizations:tracemetrics-units-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics showing stats bytes
    manager.add("organizations:tracemetrics-stats-bytes-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics showing pii scrubbing
    manager.add("organizations:tracemetrics-pii-scrubbing-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable traces page cross event querying
    manager.add("organizations:traces-page-cross-event-querying", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Conversation focused views in AI Insights
    manager.add("organizations:gen-ai-conversations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Conduit demo endpoint and UI
    manager.add("organizations:conduit-demo", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable hard timeout alarm for webhooks
    manager.add("organizations:sentry-app-webhook-hard-timeout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable circuit breaker for webhook endpoint failure detection
    manager.add("organizations:sentry-app-webhook-circuit-breaker", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Override dry-run to enable real blocking per app-owner org during rollout
    manager.add("organizations:sentry-app-webhook-circuit-breaker-live-run", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    # Enables organization access to the new notification platform
    manager.add("organizations:notification-platform.internal-testing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:notification-platform.is-sentry", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:notification-platform.early-adopter", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:notification-platform.general-access", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

    # NOTE: Don't add features down here! Add them to their specific group and sort
    #       them alphabetically! The order features are registered is not important.

    # Project scoped features #
    ###########################
    # Enables quick testing of disabling transaction name clustering for a project.
    manager.add("projects:transaction-name-clustering-disabled", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=False)
    manager.add("projects:discard-transaction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable error upsampling
    manager.add("projects:error-upsampling", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable calculating a severity score for events which create a new group
    manager.add("projects:first-event-severity-calculation", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable similarity embeddings API call
    # This feature is only available on the frontend using project details since the handler gets
    # project options and this is slow in the project index endpoint feature flag serialization
    manager.add("projects:similarity-embeddings", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=True)
    manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable next similarity grouping model rollout
    manager.add("projects:similarity-grouping-model-next", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Starfish: extract metrics from the spans
    manager.add("projects:span-metrics-extraction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    manager.add("projects:span-metrics-extraction-addons", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Project plugin features
    manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enables experimental span v2 processing in Relay.
    manager.add("projects:span-v2-experimental-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables experimental span attachment processing in Relay.
    manager.add("projects:span-v2-attachment-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables experimental trace attachment processing in Relay.
    manager.add("projects:trace-attachment-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables experimental upload endpoint in Relay (streams to objectstore).
    manager.add("projects:relay-upload-endpoint", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the uploading of minidump attachments to the objectstore.
    manager.add("projects:relay-minidump-attachment-uploads", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the uploading of minidumps to the objectstore.
    manager.add("projects:relay-minidump-uploads", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the uploading of playstation attachments to the objectstore.
    manager.add("projects:relay-playstation-uploads", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    # Enable lightweight RCA clustering write path (generate embeddings on new issues)
    manager.add("organizations:supergroups-lightweight-rca-clustering-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("projects:workflow-engine-performance-detectors", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    # fmt: on

    # Partner oauth
    manager.add(
        "organizations:scoped-partner-oauth",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=False,
    )
