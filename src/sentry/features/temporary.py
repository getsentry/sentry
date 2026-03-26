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

    # Enables user registration.
    manager.add("auth:register", SystemFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable creating organizations within sentry (if SENTRY_SINGLE_ORGANIZATION is not enabled).
    manager.add("organizations:create", SystemFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Controls whether or not the relocation endpoints can be used.
    manager.add("relocation:enabled", SystemFeature, FeatureHandlerStrategy.INTERNAL)

    # Organization scoped features that are in development or in customer trials. #
    ###############################################################################

    # Enables alert creation on indexed events in UI (use for PoC/testing only)
    manager.add("organizations:alert-allow-indexed", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables flag for org specific runs on alerts comparison script for spans migration
    manager.add("organizations:alerts-timeseries-comparison", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable anomaly detection feature for EAP spans
    manager.add("organizations:anomaly-detection-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the cron job to auto-enable codecov integrations.
    manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enabled for orgs that participated in the code review beta
    manager.add("organizations:code-review-beta", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable A/B testing experiments for code review (org eligibility)
    manager.add("organizations:code-review-experiments-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable continuous profiling
    manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enabled for beta orgs
    manager.add("organizations:continuous-profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enabled ui for beta orgs
    manager.add("organizations:continuous-profiling-beta-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display profile durations on the stats page
    manager.add("organizations:continuous-profiling-stats", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable the ingestion of profile functions metrics into EAP
    manager.add("projects:profile-functions-metrics-eap-ingestion", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables read only dashboards
    manager.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enables custom editable dashboards
    manager.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enables import/export functionality for dashboards
    manager.add("organizations:dashboards-import", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable interval selection for dashboards
    manager.add("organizations:dashboards-interval-selection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics enhanced performance for AM2+ customers as they transition from AM2 to AM3
    manager.add("organizations:dashboards-metrics-transition", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable starred dashboards with reordering
    manager.add("organizations:dashboards-starred-reordering", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable drilldown flow for dashboards
    manager.add("organizations:dashboards-drilldown-flow", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable prebuilt dashboards for insights modules
    manager.add("organizations:dashboards-prebuilt-insights-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Replaces insights ui with prebuilt dashboards
    manager.add("organizations:insights-prebuilt-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the details widget for dashboards
    manager.add("organizations:dashboards-details-widget", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable text widgets for dashboards
    manager.add("organizations:dashboards-text-widgets", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered dashboard generation via Seer
    manager.add("organizations:dashboards-ai-generate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy
    manager.add("organizations:data-secrecy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy v2 (with Break the Glass feature)
    manager.add("organizations:data-secrecy-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Intercom support widget (replaces Zendesk when enabled)
    manager.add("organizations:intercom-support", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable default anomaly detection metric monitor for new projects
    manager.add("organizations:default-anomaly-detector", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables synthesis of device.class in ingest
    manager.add("organizations:device-class-synthesis", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the 'discover' interface. (might be unused)
    manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable the discover saved queries deprecation warnings
    manager.add("organizations:discover-saved-queries-deprecation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable migration of transaction widgets and queries to spans
    manager.add("organizations:migrate-transaction-queries-to-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable migration of transaction alerts and queries to spans
    manager.add("organizations:migrate-transaction-alerts-to-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable trace-based health checks rule in dynamic sampling
    manager.add("organizations:ds-health-checks-trace-based", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=False)
    # Enable custom dynamic sampling rates
    manager.add("organizations:dynamic-sampling-custom", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable dynamic sampling minimum sample rate
    manager.add("organizations:dynamic-sampling-minimum-sample-rate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable returning the migrated discover queries in explore saved queries
    manager.add("organizations:expose-migrated-discover-queries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:gen-ai-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'translate' functionality for GenAI on the explore > traces page
    manager.add("organizations:gen-ai-search-agent-translate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI consent
    manager.add("organizations:gen-ai-consent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable increased issue_owners rate limit for auto-assignment
    manager.add("organizations:increased-issue-owners-rate-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Starfish: extract metrics from the spans
    manager.add("organizations:indexed-spans-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable integration functionality to work deployment integrations like Vercel
    manager.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    manager.add("organizations:integrations-claude-code", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-cursor", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-github-copilot-agent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-github-platform-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-perforce", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Project Management Integrations Feature Parity Flags
    manager.add("organizations:integrations-github_enterprise-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-gitlab-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable inviting billing members to organizations at the member limit.
    manager.add("organizations:invite-billing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Enable inviting members to organizations.
    manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable rate limits for inviting members.
    manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enable rollout of launchpad taskbroker shadowing/usage
    manager.add("organizations:launchpad-taskbroker-rollout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-use-default-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable flamegraph visualization for MetricKit hang diagnostic stack traces
    manager.add("organizations:metrickit-flamegraph", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Session Stats down to a minute resolution
    manager.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enables higher limit for alert rules
    manager.add("organizations:more-fast-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:more-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable higher limit for workflows
    manager.add("organizations:more-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Normalize segment names during span enrichment
    manager.add("organizations:normalize_segment_names_in_span_enrichment", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Extract on demand metrics
    manager.add("organizations:on-demand-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics (experimental features)
    manager.add("organizations:on-demand-metrics-extraction-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics (widget extraction)
    manager.add("organizations:on-demand-metrics-extraction-widgets", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # This spec version includes the environment in the query hash
    manager.add("organizations:on-demand-metrics-query-spec-version-two", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use the new OrganizationMemberInvite endpoints
    manager.add("organizations:new-organization-member-invite", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use the OrganizationObjectstoreEndpoint
    manager.add("organizations:objectstore-endpoint", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable large ownership rule file size limit
    manager.add("organizations:ownership-size-limit-large", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable xlarge ownership rule file size limit
    manager.add("organizations:ownership-size-limit-xlarge", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables new page frame UI design
    manager.add("organizations:page-frame", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables setting the fetch all custom measurements request time range to match the user selected time range instead of 90 days
    manager.add("organizations:performance-discover-get-custom-measurements-reduced-range", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Temporary flag to test search performance that's running slow in S4S
    manager.add("organizations:performance-issues-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Detect performance issues in the new standalone spans pipeline instead of on transactions
    manager.add("organizations:performance-issues-spans", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Enable internal view for bannerless MEP view
    manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Re-enable histograms for Metrics Enhanced Performance Views
    manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable MongoDB support for the Queries module
    manager.add("organizations:performance-queries-mongodb-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable the EAP-powered transactions summary view
    manager.add("organizations:performance-transaction-summary-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable Seer Suggestions for Web Vitals Module
    manager.add("organizations:performance-web-vitals-seer-suggestions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the warning banner to inform users of pending deprecation of the transactions dataset
    manager.add("organizations:performance-transaction-deprecation-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod frontend routes
    manager.add("organizations:preprod-frontend-routes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod_artifact webhook subscription UI in Sentry App settings
    manager.add("organizations:preprod-artifact-webhooks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod issue reporting
    manager.add("organizations:preprod-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod PR comments for build distribution
    manager.add("organizations:preprod-build-distribution-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enables the playstation ingestion in relay
    manager.add("organizations:relay-playstation-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables OTLP Trace ingestion in Relay for an entire org.
    manager.add("organizations:relay-otlp-traces-endpoint", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables OTLP Log ingestion in Relay for an entire org.
    manager.add("organizations:relay-otel-logs-endpoint", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables new error processing pipeline in Relay.
    manager.add("organizations:relay-new-error-processing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enables separate differential flamegraph page
    manager.add("organizations:profiling-differential-flamegraph-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable global suspect functions in profiling
    manager.add("organizations:profiling-global-suspect-functions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable function trends widgets in profiling
    manager.add("organizations:profiling-function-trends", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:project-templates", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable replay AI summaries for mobile replays
    manager.add("organizations:replay-ai-summaries-mobile", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay AI summaries for web replays
    manager.add("organizations:replay-ai-summaries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable reading replay details using EAP query
    manager.add("organizations:replay-details-eap-query", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable version 2 of release serializer
    manager.add("organizations:releases-serializer-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Add build code and build number to semver ordering
    manager.add("organizations:semver-ordering-with-build-code", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable revocation of org auth keys when a user renames an org slug
    manager.add("organizations:revoke-org-auth-on-slug-rename", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the Seer Config Reminder in the primary nav
    manager.add("organizations:seer-config-reminder", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Explorer panel for AI-powered data exploration
    manager.add("organizations:seer-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Explorer Index job
    manager.add("organizations:seer-explorer-index", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable streaming responses for Seer Explorer
    manager.add("organizations:seer-explorer-streaming", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable context engine for Seer Explorer
    manager.add("organizations:seer-explorer-context-engine", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable frontend override for context engine (only for AI/ML/Reasoning platform team)
    manager.add("organizations:seer-explorer-context-engine-allow-fe-override", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable frontend override UI component for context engine (only for AI/ML/Reasoning platform team)
    manager.add("organizations:seer-explorer-context-engine-fe-override-ui-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable code editing tools in Seer Explorer chat
    manager.add("organizations:seer-explorer-chat-coding", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the Seer Overview sections for Seat-Based users
    manager.add("organizations:seer-overview", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the Seer Wizard and related prompts/links/banners
    manager.add("organizations:seer-wizard", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the Seer issues view
    manager.add("organizations:seer-issue-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Autofix to use Seer Explorer instead of legacy Celery pipeline
    manager.add("organizations:autofix-on-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Autofix to use Seer Explorer V2 designs
    manager.add("organizations:autofix-on-explorer-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Workflows in Slack
    manager.add("organizations:seer-slack-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new compact issue alert UI in Slack
    manager.add("organizations:slack-compact-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the Slack staging app
    manager.add("organizations:slack-staging-app", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Explorer in Slack via @mentions
    manager.add("organizations:seer-slack-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder to support explicit boolean filters
    manager.add("organizations:search-query-builder-explicit-boolean-filters", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder input flow changes
    manager.add("organizations:search-query-builder-input-flow-changes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable dual-write of Seer project preferences to Sentry DB and Seer API
    manager.add("organizations:seer-project-settings-dual-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable public RPC endpoint for local seer development
    manager.add("organizations:seer-public-rpc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Organizations on the old usage-based (v0) Seer plan
    manager.add("organizations:seer-added", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Organizations on the new seat-based Seer plan
    manager.add("organizations:seat-based-seer-enabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable new SentryApp webhook request endpoint
    manager.add("organizations:sentry-app-webhook-requests", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable standalone span ingestion
    manager.add("organizations:standalone-span-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable mobile starfish ui module view
    manager.add("organizations:starfish-mobile-ui-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new experimental starfish view
    manager.add("organizations:starfish-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Allow organizations to configure all symbol sources.
    manager.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
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
    # Enable email notifications when auto-detected uptime monitors graduate from onboarding
    manager.add("organizations:uptime-auto-detected-monitor-emails", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable logging workflow evaluations (bypasses sample rate when enabled)
    manager.add("organizations:workflow-engine-log-evaluations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable caching for workflow detector lookups
    manager.add("organizations:workflow-engine-process-workflows-cache", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable logs to debug various metric issue things
    manager.add("organizations:workflow-engine-metric-alert-dual-processing-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Creation of Metric Alerts that use the `group_by` field in the workflow_engine
    manager.add("organizations:workflow-engine-metric-alert-group-by-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable ingestion through trusted relays only
    manager.add("organizations:ingest-through-trusted-relays-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metric issue UI for issue alerts
    manager.add("organizations:workflow-engine-metric-issue-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable issue stream detector notifications for metric issues
    manager.add("organizations:workflow-engine-metric-issue-disable-issue-detector-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new workflow_engine UI (see: alerts create issues)
    manager.add("organizations:workflow-engine-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable redirects from alert rules to the new workflow_engine UI
    manager.add("organizations:workflow-engine-redirect-opt-out", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use workflow engine serializers to return data for old rule / incident endpoints
    manager.add("organizations:workflow-engine-rule-serializers", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use workflow engine exclusively for ProjectRulesEndpoint.get results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-projectrulesendpoint-get", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for ProjectRuleDetailsEndpoint.get results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-projectruledetailsendpoint-get", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine exclusively for OrganizationCombinedRuleIndexEndpoint.get results.
    # See src/sentry/workflow_engine/docs/legacy_backport.md for context.
    manager.add("organizations:workflow-engine-combinedruleindex-get", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable metric detector limits by plan type
    manager.add("organizations:workflow-engine-metric-detector-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable EventUniqueUserFrequencyConditionWithConditions special alert condition
    manager.add("organizations:event-unique-user-frequency-condition-with-conditions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product (known internally as ourlogs) in UI and backend
    manager.add("organizations:ourlogs-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product to be ingested via Relay.
    manager.add("organizations:ourlogs-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs stats to be displayed in the UI.
    manager.add("organizations:ourlogs-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable overlaying charts in logs
    manager.add("organizations:ourlogs-overlay-charts-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable alerting on trace metrics
    manager.add("organizations:tracemetrics-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable attributes dropdown side panel in trace metrics
    manager.add("organizations:tracemetrics-attributes-dropdown-side-panel", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics product (known internally as tracemetrics) in UI and backend
    manager.add("organizations:tracemetrics-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics product to be ingested via Relay
    manager.add("organizations:tracemetrics-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics multi-metric selection in dashboards
    manager.add("organizations:tracemetrics-multi-metric-selection-in-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics units in trace view UI
    manager.add("organizations:tracemetrics-units-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics UI refresh
    manager.add("organizations:tracemetrics-ui-refresh", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics showing stats bytes
    manager.add("organizations:tracemetrics-stats-bytes-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable traces page cross event querying
    manager.add("organizations:traces-page-cross-event-querying", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable overlaying charts in traces
    manager.add("organizations:traces-overlay-charts-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature flag to cache detectors by data source
    manager.add("organizations:cache-detectors-by-data-source", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable single trace summary
    manager.add("organizations:single-trace-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable seeing upsell modal when clicking upgrade for multi-org
    manager.add("organizations:github-multi-org-upsell-modal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables CMD+K supercharged (omni search)
    manager.add("organizations:cmd-k-supercharged", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables DSN lookup in CMD+K palette
    manager.add("organizations:cmd-k-dsn-lookup", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Conversation focused views in AI Insights
    manager.add("organizations:gen-ai-conversations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:on-demand-gen-metrics-deprecation-prefill", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:on-demand-gen-metrics-deprecation-query-prefill", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables Conduit demo endpoint and UI
    manager.add("organizations:conduit-demo", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable hard timeout alarm for webhooks
    manager.add("organizations:sentry-app-webhook-hard-timeout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

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
    # Adds additional filters and a new section to issue alert rules.
    manager.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    manager.add("projects:discard-transaction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable error upsampling
    manager.add("projects:error-upsampling", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable calculating a severity score for events which create a new group
    manager.add("projects:first-event-severity-calculation", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable similarity embeddings API call
    # This feature is only available on the frontend using project details since the handler gets
    # project options and this is slow in the project index endpoint feature flag serialization
    manager.add("projects:similarity-embeddings", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=True)
    manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable new similarity grouping model upgrade (version-agnostic rollout)
    manager.add("projects:similarity-grouping-model-upgrade", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable supergroup RCA embedding generation from autofix explorer runs
    manager.add("projects:supergroup-embeddings-explorer", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable lightweight Explorer RCA runs for supergroup quality evaluation
    manager.add("projects:supergroup-lightweight-rca", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("projects:workflow-engine-performance-detectors", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    # fmt: on

    # Partner oauth
    manager.add(
        "organizations:scoped-partner-oauth",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=False,
    )
