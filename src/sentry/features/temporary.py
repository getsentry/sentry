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
    # Auto-link repos to projects by matching repo name suffix to project slug
    manager.add("organizations:auto-link-repos-by-name", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enabled for orgs that participated in the code review beta
    manager.add("organizations:code-review-beta", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable continuous profiling
    manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable storing and downloading attachments (e.g. Perfetto traces) on profile chunks
    manager.add("organizations:continuous-profiling-perfetto", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the ingestion of profile functions metrics into EAP
    manager.add("projects:profile-functions-metrics-eap-ingestion", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables read only dashboards
    manager.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enables custom editable dashboards
    manager.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enable metrics enhanced performance for AM2+ customers as they transition from AM2 to AM3
    manager.add("organizations:dashboards-metrics-transition", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

    # Enable prebuilt dashboards for insights modules
    manager.add("organizations:dashboards-prebuilt-insights-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the details widget for dashboards
    manager.add("organizations:dashboards-details-widget", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Insights to Dashboards UI migration
    manager.add("organizations:insights-to-dashboards-ui-rollout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered dashboard generation via Seer
    manager.add("organizations:dashboards-ai-generate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered dashboard editing via Seer
    manager.add("organizations:dashboards-ai-generate-edit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables starred dashboards functionality
    manager.add("organizations:dashboards-starred", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy
    manager.add("organizations:data-secrecy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy v2 (with Break the Glass feature)
    manager.add("organizations:data-secrecy-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable defaulting to ask seer from free text search
    manager.add("organizations:gen-ai-default-to-ask-seer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable ask seer ux rework
    manager.add("organizations:gen-ai-ask-seer-ux-rework", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI search bar on the issues page
    manager.add("organizations:gen-ai-issues-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI consent
    manager.add("organizations:gen-ai-consent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable LLM-generated title and description for external issue details
    manager.add("organizations:external-issues-ai-generate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:inbound-filters-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable increased issue_owners rate limit for auto-assignment
    manager.add("organizations:increased-issue-owners-rate-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Starfish: extract metrics from the spans
    manager.add("organizations:indexed-spans-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:integrations-github-platform-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-github-multi-platform-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-slack-staging", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-vercel-upsert-env-var", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:integrations-datadog", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:slack-reinstall-nudge-on-issue-alert", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable GitHub Enterprise to accept github.com as a valid Installation URL
    manager.add("organizations:github-enterprise-github-com-source", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # API-driven integration setup pipeline (per-provider rollout)
    # ...
    # Project Management Integrations Feature Parity Flags
    manager.add("organizations:integrations-github-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-gitlab-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Temporary: log full Jira Cloud `issue.updated` webhook payloads so we can design project-change link rewriting.
    manager.add("organizations:jira-issue-updated-payload-logging", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use the paginated project endpoint in Jira org config to avoid timeouts on large instances.
    manager.add("organizations:jira-paginated-project-config", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable inviting billing members to organizations at the member limit.
    manager.add("organizations:invite-billing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Enable inviting members to organizations.
    manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable rate limits for inviting members.
    manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables higher limit for alert rules
    manager.add("organizations:more-fast-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:more-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable higher limit for workflows
    manager.add("organizations:more-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:mcp-issue-view-attribution", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Extract on demand metrics
    manager.add("organizations:on-demand-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

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
    # Experiment: SCM-first project creation wizard A/B test (project creation flow, not new-org onboarding)
    manager.add("organizations:onboarding-scm-project-creation-experiment", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Double-write newly created debug files to Objectstore.
    manager.add("organizations:objectstore-debugfiles-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=False)
    # Read debug files from Objectstore when an Objectstore copy is available.
    manager.add("organizations:objectstore-debugfiles-read", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=False)
    # Redirect debug file download requests to read directly from Objectstore, instead of proxying file contents through Sentry.
    manager.add("organizations:objectstore-debugfiles-direct-read", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=False)
    # Enable large ownership rule file size limit
    manager.add("organizations:ownership-size-limit-large", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable xlarge ownership rule file size limit
    manager.add("organizations:ownership-size-limit-xlarge", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables setting the fetch all custom measurements request time range to match the user selected time range instead of 90 days
    manager.add("organizations:performance-discover-get-custom-measurements-reduced-range", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Detect performance issues in the new standalone spans pipeline instead of on transactions
    manager.add("organizations:performance-issues-spans", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Enable all registered prebuilt dashboards to be synced to the database
    manager.add("organizations:dashboards-sync-all-registered-prebuilt-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Seer Suggestions for Web Vitals Module
    manager.add("organizations:performance-web-vitals-seer-suggestions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the warning banner to inform users of pending deprecation of the transactions dataset
    manager.add("organizations:performance-transaction-deprecation-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Create issue activities for pull request lifecycle events
    manager.add("organizations:pr-lifecycle-activity", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Write PullRequestActivity rows from GitHub PR lifecycle webhooks
    manager.add("organizations:pr-metrics-activity", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Record PullRequestAttribution from webhook and seer.pr_created events
    manager.add("organizations:pr-metrics-attribution", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Emit the BigQuery row on a tracked PR's close/merge (PR Merge Live Metrics rollout)
    manager.add("organizations:pr-metrics-emit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Forward a terminal PR event that needs a judge to Seer (PR Merge Live Metrics judge path)
    manager.add("organizations:pr-metrics-judge", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable preprod_artifact webhook subscription UI in Sentry App settings
    manager.add("organizations:preprod-artifact-webhooks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod PR comments for build distribution
    manager.add("organizations:preprod-build-distribution-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable enforcement of preprod distribution quota checks (when disabled, distribution quota checks always return True)
    manager.add("organizations:preprod-enforce-distribution-quota", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable preprod PR comments for size analysis
    manager.add("organizations:preprod-size-analysis-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod size monitors frontend
    manager.add("organizations:preprod-size-monitors-frontend", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the playstation ingestion in relay
    manager.add("organizations:relay-playstation-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the new apiFetch implementation that uses cell fetch.
    manager.add("organizations:api-fetch-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    manager.add("organizations:sourcemap-issue-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable profiling
    manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
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
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Seer Agent panel for AI-powered data exploration
    manager.add("organizations:seer-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Agent Index job
    manager.add("organizations:seer-explorer-index", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Night Shift nightly autofix cron
    manager.add("organizations:seer-night-shift", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Run the Seer smart assignment feature (predictions + ground truth) on issues
    manager.add("organizations:seer-smart-assignment-run", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Send notifications for Seer smart assignment predictions
    manager.add("organizations:seer-smart-assignment-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display nightshift settings
    manager.add("organizations:seer-night-shift-settings", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Roll out structured LLM page context on STRUCTURED_CONTEXT_ROUTES to all orgs
    manager.add("organizations:seer-explorer-structured-context-rollout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable context engine experimental contexts
    manager.add("organizations:context-engine-experiments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable frontend override for context engine (only for AI/ML/Reasoning platform team)
    manager.add("organizations:seer-explorer-context-engine-allow-fe-override", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable frontend override UI component for context engine (only for AI/ML/Reasoning platform team)
    manager.add("organizations:seer-explorer-context-engine-fe-override-ui-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code editing tools in Seer Agent chat
    manager.add("organizations:seer-explorer-chat-coding", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable sentry source code search tool
    manager.add("organizations:seer-agent-source-code-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code mode tools (sentry_api_search/execute) in Seer Agent
    manager.add("organizations:seer-explorer-code-mode-tools", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code mode tools for Slack-initiated Explorer sessions
    manager.add("organizations:seer-slack-code-mode", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the thinking blocks toggle in the Seer Agent top bar
    manager.add("organizations:seer-explorer-thinking-blocks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable client-side UI tools for Seer Agent
    manager.add("organizations:seer-explorer-ui-tools", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Explorer to generate rich component embeds from an adjusted prompt
    manager.add("organizations:seer-explorer-embeds", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable thinking + tool-call summaries in Seer Agent
    manager.add("organizations:seer-explorer-thinking-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:seer-explorer-stream", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable structured LLM context (JSON snapshot) instead of ASCII DOM snapshot
    manager.add("organizations:context-engine-structured-page-context", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable browser notifications for autofix runs
    manager.add("organizations:autofix-browser-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Show the "Open in Seer Agent (debug)" button in the autofix drawer
    manager.add("organizations:autofix-seer-agent-debug", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable autofix introspection for early stopping of autofix runs
    manager.add("organizations:seer-autofix-introspection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the PR iteration feedback flow in the explorer autofix drawer
    manager.add("organizations:autofix-pr-iteration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Expose one-shot question answers on the Seer runs list (?expand=questions)
    manager.add("organizations:seer-run-questions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable showing seer in a persistent sidebar
    manager.add("organizations:seer-explorer-persistent-sidebar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Show Seer run ID in Slack notification footers
    manager.add("organizations:seer-run-id-in-slack", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Gate display of Seer action events in the issue activity timeline
    # https://linear.app/getsentry/project/add-seer-actions-to-issue-activityaction-log-0e641e1f5dac/overview
    manager.add("organizations:display-seer-actions-as-issue-activities", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Gate infra telemetry provider connections (Datadog MCP, GCP MCP)
    manager.add("organizations:seer-infra-telemetry", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disables the enableSeerCoding setting, preventing orgs from changing code generation behavior
    manager.add("organizations:seer-disable-coding-setting", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GitLab as a supported SCM provider for Seer
    manager.add("organizations:seer-gitlab-support", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Run Seer agents inside the sandbox execution environment
    manager.add("organizations:seer-use-agent-sandbox", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Append a "text" summary to SentryApp webhooks sent to Claude Code routine fire URLs
    manager.add("organizations:sentry-apps-claude-routine-webhooks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable delivery of custom webhook headers configured on a SentryApp
    manager.add("organizations:sentry-apps-custom-webhook-headers", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Allow SentryApps to subscribe to individual webhook events instead of whole resources
    manager.add("organizations:sentry-apps-granular-events", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable select orgs from ingesting mobile replay events.
    # Enable double-read from EAP for session health data validation
    manager.add("organizations:session-health-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:session-replay-video-disabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable data scrubbing of replay recording payloads in Relay.
    manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable core Session Replay link in the sidebar
    manager.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable v2 issue activity feed UI
    manager.add("organizations:issue-activity-feed-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new stack trace component for issue details
    manager.add("organizations:issue-details-new-stack-trace", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable invalidating group derived data when groups are merged
    manager.add("organizations:hard-delete-derived-data-invalidation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable double-reading from EAP for issue feed search queries
    manager.add("organizations:issue-feed.eap-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Remove trace and breadcrumbs from issue summary input
    manager.add("organizations:issue-summary-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new issue stream progress views
    manager.add("organizations:issue-stream-progress-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Show the "recommended" sort as an option in the issue stream sort dropdown
    manager.add("organizations:issue-stream-recommended-sort", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Make the "recommended" sort the default sort in the issue stream
    manager.add("organizations:issue-stream-recommended-sort-default", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Serve the recommended_v2 scorer behind the issue stream's "recommended" sort
    manager.add("organizations:issue-stream-recommended-sort-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the "progress" sort option (by issue fix-cycle progress) in the issue stream
    manager.add("organizations:issue-stream-progress-sort", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use GroupDerivedData as the source for issue progress instead of activity-based heuristics
    manager.add("projects:issue-stream-derived-progress", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

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
    # Enable attribute context in data browsing
    manager.add("organizations:data-browsing-attribute-context", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable public RPC endpoint for local seer development
    manager.add("organizations:seer-public-rpc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Organizations on the old usage-based (v0) Seer plan
    manager.add("organizations:seer-added", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enables auto-conversion of number operators for search query builder
    manager.add("organizations:search-query-builder-number-operator-conversion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Organizations on the new seat-based Seer plan
    manager.add("organizations:seat-based-seer-enabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Render Sentry App schema-backed forms using the backend JSON form adapter.
    manager.add("organizations:sentry-app-schema-form-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enable new SentryApp webhook request endpoint
    # Enable static ClickHouse sampling for `OrganizationTagsEndpoint`
    manager.add("organizations:tag-key-sample-n", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable dynamic grouping UI (top issues)
    manager.add("organizations:top-issues-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to use span only trace endpoint.
    manager.add("organizations:trace-spans-format", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extraction metrics for transactions during ingestion.
    manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Normalize URL transaction names during ingestion.
    manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables view hierarchy attachment scrubbing
    manager.add("organizations:view-hierarchy-scrubbing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the redesigned page breadcrumbs (BreadcrumbList) on migrated pages
    manager.add("organizations:ui-migration-breadcrumbs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered assertion suggestions for uptime monitors
    manager.add("organizations:uptime-ai-assertion-suggestions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable auto spam classification at User Feedback ingest time
    manager.add("organizations:user-feedback-spam-ingest", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

    # Enable the new explore page
    manager.add("organizations:visibility-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable high date range options on new explore page
    manager.add("organizations:visibility-explore-range-high", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

    # Show combined resolved "past issues" section instead of separate key errors / performance issues
    manager.add("organizations:weekly-report-past-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable week-over-week percentage change metric in weekly email reports
    manager.add("organizations:weekly-report-week-over-week-metric", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable logging to debug workflow engine process workflows
    manager.add("organizations:workflow-engine-process-workflows-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Disable issue stream detector notifications for metric issues
    manager.add("organizations:workflow-engine-metric-issue-disable-issue-detector-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new workflow_engine UI (see: alerts create issues)
    manager.add("organizations:workflow-engine-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use workflow engine serializers to return data for old rule / incident endpoints
    manager.add("organizations:workflow-engine-rule-serializers", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use workflow engine exclusively for legacy issue alert rule.post results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-issue-alert-endpoints-post", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for legacy issue alert rule.put results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-issue-alert-endpoints-put", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable metric detector limits by plan type
    manager.add("organizations:workflow-engine-metric-detector-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Switches remaining (non-logs) Explore data exports from one-click button to a the modal
    manager.add("organizations:explore-modal-export", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product (known internally as ourlogs) in UI and backend
    manager.add("organizations:ourlogs-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product to be ingested via Relay.
    manager.add("organizations:ourlogs-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable pinning logs to the top of the table in the logs UI and query parameters
    manager.add("organizations:ourlogs-pinning", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable alerting on trace metrics
    # Enable trace metrics product (known internally as tracemetrics) in UI and backend
    manager.add("organizations:tracemetrics-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable trace waterfall time compression
    manager.add("organizations:trace-waterfall-time-compression", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Conversation focused views in AI Insights
    manager.add("organizations:gen-ai-conversations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable selectable/filterable columns for the AI Conversations table
    manager.add("organizations:gen-ai-conversations-columns", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the redesigned Conversations product experience
    manager.add("organizations:gen-ai-conversations-redesign", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Conduit demo endpoint and UI
    manager.add("organizations:conduit-demo", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

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
    manager.add("projects:discard-transaction", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable error upsampling
    manager.add("projects:error-upsampling", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable calculating a severity score for events which create a new group
    manager.add("projects:first-event-severity-calculation", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable writing issue action log entries to the database
    manager.add("projects:issue-action-log-write-to-db", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("projects:issue-status-reconciliation", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable similarity embeddings API call
    # This feature is only available on the frontend using project details since the handler gets
    # project options and this is slow in the project index endpoint feature flag serialization
    manager.add("projects:similarity-embeddings", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=True)
    manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable next similarity grouping model rollout
    manager.add("projects:similarity-grouping-model-next", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Skip falling back to v1 model when v2 returns no matches
    manager.add("projects:similarity-grouping-skip-fallback", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enables the uploading of minidumps to the objectstore.
    manager.add("projects:relay-minidump-uploads", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the uploading of playstation attachments to the objectstore.
    manager.add("projects:relay-playstation-uploads", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables uploading streams to objectstore via multipart uploads.
    # See <https://getsentry.github.io/objectstore/rust/objectstore_service/multipart/>.
    manager.add("projects:relay-upload-multipart", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    # Enable lightweight RCA clustering write path (generate embeddings on new issues)
    manager.add("organizations:supergroups-lightweight-rca-clustering-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("projects:workflow-engine-performance-detectors", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("organizations:relay-generate-billing-outcome", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("organizations:claude-code-vault-reuse", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)


    # fmt: on
