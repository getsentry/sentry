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

    # Enables the AI generations page
    manager.add("organizations:ai-insights-generations-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables alert creation on indexed events in UI (use for PoC/testing only)
    manager.add("organizations:alert-allow-indexed", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables flag for org specific runs on alerts comparison script for spans migration
    manager.add("organizations:alerts-timeseries-comparison", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable anomaly detection feature for EAP spans
    manager.add("organizations:anomaly-detection-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anomaly detection threshold data endpoint
    manager.add("organizations:anomaly-detection-threshold-data", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anr frame analysis
    manager.add("organizations:anr-analyze-frames", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Gate the changes to the ask seer consent flow
    manager.add("organizations:ask-seer-consent-flow-update", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the endpoint to merge user accounts with the same email address
    manager.add("organizations:auth-v2-merge-users", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the cron job to auto-enable codecov integrations.
    manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable greater query details in issues api for seer
    manager.add("organizations:detailed-data-for-seer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:autofix-seer-preferences", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Route Preloading
    manager.add("organizations:route-intent-preloading", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Prevent AI code review to run per commit
    manager.add("organizations:code-review-run-per-commit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enabled for orgs that participated in the code review beta
    manager.add("organizations:code-review-beta", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Prevent Test Analytics
    manager.add("organizations:prevent-test-analytics", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the improved command menu (Cmd+K)
    manager.add("organizations:command-menu-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable daily summary
    manager.add("organizations:daily-summary", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables read only dashboards
    manager.add("organizations:dashboards-basic", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enables custom editable dashboards
    manager.add("organizations:dashboards-edit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=True)
    # Enables global filters for dashboards
    manager.add("organizations:dashboards-global-filters", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables favourite and duplicate controls for prebuilt dashboards
    manager.add("organizations:dashboards-prebuilt-controls", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables import/export functionality for dashboards
    manager.add("organizations:dashboards-import", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics enhanced performance in dashboards
    manager.add("organizations:dashboards-mep", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics enhanced performance for AM2+ customers as they transition from AM2 to AM3
    manager.add("organizations:dashboards-metrics-transition", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable starred dashboards with reordering
    manager.add("organizations:dashboards-starred-reordering", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the dashboard widget builder redesign UI
    manager.add("organizations:dashboards-widget-builder-redesign", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable drilldown flow for dashboards
    manager.add("organizations:dashboards-drilldown-flow", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable prebuilt dashboards for insights modules
    manager.add("organizations:dashboards-prebuilt-insights-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new timeseries visualization for dashboard widgets
    manager.add("organizations:dashboards-widget-timeseries-visualization", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the details widget for dashboards
    manager.add("organizations:dashboards-details-widget", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable series display type for issue widgets
    manager.add("organizations:dashboards-issue-widget-series-display-type", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy
    manager.add("organizations:data-secrecy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy v2 (with Break the Glass feature)
    manager.add("organizations:data-secrecy-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable default anomaly detection metric monitor for new projects
    manager.add("organizations:default-anomaly-detector", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables access to the global data forwarding features
    # Note: organizations:data-forwarding is a permanent, plan-based flag that enables access to the actual feature.
    #       This flag will only be used to access the new UI/UX and endpoints before release.
    manager.add("organizations:data-forwarding-revamp-access", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables synthesis of device.class in ingest
    manager.add("organizations:device-class-synthesis", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable device.class as a selectable column
    manager.add("organizations:device-classification", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'discover' interface. (might be unused)
    manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable the discover saved queries deprecation warnings
    manager.add("organizations:discover-saved-queries-deprecation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable migration of transaction widgets and queries to spans
    manager.add("organizations:migrate-transaction-queries-to-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable migration of transaction alerts and queries to spans
    manager.add("organizations:migrate-transaction-alerts-to-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new cell actions styling and features for tables that use the component
    manager.add("organizations:discover-cell-actions-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace-based health checks rule in dynamic sampling
    manager.add("organizations:ds-health-checks-trace-based", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=False)
    # Enable custom dynamic sampling rates
    manager.add("organizations:dynamic-sampling-custom", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable dynamic sampling minimum sample rate
    manager.add("organizations:dynamic-sampling-minimum-sample-rate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables generation of dynamic sampling rules based on span data for span first
    manager.add(
        "organizations:dynamic-sampling-on-span-first",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=False,
    )
    # Enable logging project config for debugging
    manager.add("organizations:log-project-config", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable archive/escalating issue workflow features in v2
    manager.add("organizations:escalating-issues-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable emiting escalating data to the metrics backend
    manager.add("organizations:escalating-metrics-backend", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable returning the migrated discover queries in explore saved queries
    manager.add("organizations:expose-migrated-discover-queries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:gen-ai-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'generate me a query' functionality on the explore > traces page
    manager.add("organizations:gen-ai-explore-traces", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the GenAI consent UI on the explore > traces page
    manager.add("organizations:gen-ai-explore-traces-consent-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'translate' functionality for GenAI on the explore > traces page
    manager.add("organizations:gen-ai-search-agent-translate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI consent
    manager.add("organizations:gen-ai-consent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable granular permissions for replay features
    manager.add("organizations:granular-replay-permissions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable increased issue_owners rate limit for auto-assignment
    manager.add("organizations:increased-issue-owners-rate-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Starfish: extract metrics from the spans
    manager.add("organizations:indexed-spans-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable integration functionality to work deployment integrations like Vercel
    manager.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    manager.add("organizations:integrations-feature-flag-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:integrations-cursor", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:integrations-perforce", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Async lookup for integration external projects
    manager.add("organizations:integrations-external-projects-async-lookup", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Project Management Integrations Feature Parity Flags
    manager.add("organizations:integrations-github-project-management", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable inviting billing members to organizations at the member limit.
    manager.add("organizations:invite-billing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=False)
    # Enable inviting members to organizations.
    manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable rate limits for inviting members.
    manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables lifetime stats on issue details
    manager.add("organizations:issue-details-lifetime-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables streamlined issue details UI for all users of an organization without opt-out
    manager.add("organizations:issue-details-streamline-enforce", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables sorting spans for issue detection
    manager.add("organizations:issue-detection-sort-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Whether to allow issue only search on the issue list
    manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enabling this will remove the consent flow for free generative AI features such as issue feedback summaries
    manager.add("organizations:gen-ai-consent-flow-removal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:metric-issue-poc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("projects:metric-issue-creation", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Large HTTP Payload Detector Improvements
    manager.add("organizations:large-http-payload-detector-improvements", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-use-default-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:disable-clustering-setting", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=False)
    # Migrate Orgs to new Azure DevOps Integration
    manager.add("organizations:migrate-azure-devops-integration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Session Stats down to a minute resolution
    manager.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Display CPU and memory metrics in transactions with profiles
    manager.add("organizations:mobile-cpu-memory-in-transactions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables higher limit for alert rules
    manager.add("organizations:more-fast-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:more-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable higher limit for workflows
    manager.add("organizations:more-workflows", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Generate charts using detector/open period payload
    manager.add("organizations:new-metric-issue-charts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable large ownership rule file size limit
    manager.add("organizations:ownership-size-limit-large", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable xlarge ownership rule file size limit
    manager.add("organizations:ownership-size-limit-xlarge", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable games tab in the project creation component
    manager.add("organizations:project-creation-games-tab", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=True, api_expose=True)
    # Enable mobile performance score calculation for transactions in relay
    manager.add("organizations:performance-calculate-mobile-perf-score-relay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable Discover Saved Query dataset selector
    manager.add("organizations:performance-discover-dataset-selector", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable deprecate discover widget type
    manager.add("organizations:deprecate-discover-widget-type", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable backend overriding and always making a fresh split decision
    manager.add("organizations:performance-discover-widget-split-override-save", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable UI sending a discover split for widget
    manager.add("organizations:performance-discover-widget-split-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable metrics-backed transaction summary view
    manager.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new trends
    manager.add("organizations:performance-new-trends", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable updated landing page widget designs
    manager.add("organizations:performance-new-widget-designs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable MongoDB support for the Queries module
    manager.add("organizations:performance-queries-mongodb-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable removing the fallback for metrics compatibility
    manager.add("organizations:performance-remove-metrics-compatibility-fallback", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace explorer features
    manager.add("organizations:performance-trace-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable session health overview to dashboard platform migration
    manager.add("organizations:performance-session-health-dashboard-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable queries module dashboard on dashboards platform
    manager.add("organizations:insights-queries-dashboard-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable http module dashboard on dashboards platform
    manager.add("organizations:insights-http-dashboard-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Mobile Vitals Insights module on dashboards platform
    manager.add("organizations:insights-mobile-vitals-dashboard-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable web vitals module dashboard on dashboards platform
    manager.add("organizations:insights-web-vitals-dashboard-migration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable all registered prebuilt dashboards to be synced to the database
    manager.add("organizations:dashboards-sync-all-registered-prebuilt-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable sentry convention fields
    manager.add("organizations:performance-sentry-conventions-fields", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable querying spans fields stats from comparative workflows project
    manager.add("organizations:performance-spans-fields-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable transaction name only search
    manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable transaction name only search on indexed
    manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Hides some fields and sections in the transaction summary page that are being deprecated
    manager.add("organizations:performance-transaction-summary-cleanup", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the EAP-powered transactions summary view
    manager.add("organizations:performance-transaction-summary-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable OTel-friendly UI. Updates copy and small UI elements to align closer with OTel definitions and concepts
    manager.add("organizations:performance-otel-friendly-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the new UI for span summary and the spans tab
    manager.add("organizations:performance-spans-new-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable standalone cls and lcp in the web vitals module
    manager.add("organizations:performance-vitals-standalone-cls-lcp", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Web Vital links to Performance Issues
    manager.add("organizations:performance-web-vitals-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Suggestions for Web Vitals Module
    manager.add("organizations:performance-web-vitals-seer-suggestions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable default explore queries in the new side nav
    manager.add("organizations:performance-default-explore-queries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect attributes feature
    manager.add("organizations:performance-spans-suspect-attributes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Transaction alert deprecation
    manager.add("organizations:performance-transaction-deprecation-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the warning banner to inform users of pending deprecation of the transactions dataset
    manager.add("organizations:performance-transaction-deprecation-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod build distribution
    manager.add("organizations:preprod-build-distribution", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod frontend routes
    manager.add("organizations:preprod-frontend-routes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod issue reporting
    manager.add("organizations:preprod-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable flag for internal distribution features
    manager.add("organizations:preprod-internal-build-distribution", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable writing preprod size metrics to EAP for querying
    manager.add("organizations:preprod-size-metrics-eap-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable writing preprod build distribution data to EAP for querying
    manager.add("organizations:preprod-build-distribution-eap-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables PR page
    manager.add("organizations:pr-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the playstation ingestion in relay
    manager.add("organizations:relay-playstation-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables OTLP Trace ingestion in Relay for an entire org.
    manager.add("organizations:relay-otlp-traces-endpoint", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables OTLP Log ingestion in Relay for an entire org.
    manager.add("organizations:relay-otel-logs-endpoint", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Prevent AI in the Sentry UI
    manager.add("organizations:prevent-ai", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Prevent team Replay Assertions (Flows) POC
    manager.add("organizations:prevent-flows-poc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable profiling
    manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enabled for those orgs who participated in the profiling Beta program
    manager.add("organizations:profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enables monitoring for latest profiling sdk used
    manager.add("organizations:profiling-sdks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables dropping of deprecated profiling sdks used
    manager.add("organizations:profiling-deprecate-sdks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables dropping of profiles that may come from buggy sdks
    manager.add("organizations:profiling-reject-sdks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables production profiling in sentry browser application
    manager.add("organizations:profiling-browser", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables separate differential flamegraph page
    manager.add("organizations:profiling-differential-flamegraph-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables ability usage of direct profile chunks all the time
    manager.add("organizations:profiling-flamegraph-always-use-direct-chunks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable global suspect functions in profiling
    manager.add("organizations:profiling-global-suspect-functions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable function trends widgets in profiling
    manager.add("organizations:profiling-function-trends", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:project-templates", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the new Related Events feature
    manager.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the release details performance section
    manager.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay AI summaries for mobile replays
    manager.add("organizations:replay-ai-summaries-mobile", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay AI summaries for web replays
    manager.add("organizations:replay-ai-summaries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable reading replay details using EAP query
    manager.add("organizations:replay-details-eap-query", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable version 2 of release serializer
    manager.add("organizations:releases-serializer-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable version 2 of reprocessing (completely distinct from v1)
    manager.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable issue resolve in current semver release
    manager.add("organizations:resolve-in-semver-release", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable revocation of org auth keys when a user renames an org slug
    manager.add("organizations:revoke-org-auth-on-slug-rename", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable coding agent integrations for AI-powered code fixes
    manager.add("organizations:seer-coding-agent-integrations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Explorer panel for AI-powered data exploration
    manager.add("organizations:seer-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable streaming responses for Seer Explorer
    manager.add("organizations:seer-explorer-streaming", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Autofix to use Seer Explorer instead of legacy Celery pipeline
    manager.add("organizations:autofix-on-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Seer Workflows in Slack
    manager.add("organizations:seer-slack-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder boolean operator select feature
    manager.add("organizations:search-query-builder-add-boolean-operator-select", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder conditionals in combobox menus
    manager.add("organizations:search-query-builder-conditionals-combobox-menus", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder input flow changes
    manager.add("organizations:search-query-builder-input-flow-changes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder raw search replacement
    manager.add("organizations:search-query-builder-raw-search-replacement", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable search query builder to use conventions package field defs
    manager.add("organizations:search-query-builder-use-conventions-field-defs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Seer Autopilot
    manager.add("organizations:seer-autopilot", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Seer Autopilot in dry-run mode
    manager.add("organizations:seer-autopilot-dry-run", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable linking from 'new issue' email notifs to the issue replay list
    manager.add("organizations:session-replay-issue-emails", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Disable select orgs from ingesting mobile replay events.
    manager.add("organizations:session-replay-video-disabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable data scrubbing of replay recording payloads in Relay.
    manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable linking from 'new issue' slack notifs to the issue replay list
    manager.add("organizations:session-replay-slack-new-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable core Session Replay link in the sidebar
    manager.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable new UI for replay details page
    manager.add("organizations:replay-details-new-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable playlist view in replay details page
    manager.add("organizations:replay-playlist-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the rendering of @sentry/toolbar inside the sentry app. See `useInitSentryToolbar()`
    manager.add("organizations:init-sentry-toolbar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable Sentry Toolbar settings for customers (ex: project settings page)
    manager.add("organizations:sentry-toolbar-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable suspect feature flags endpoint.
    manager.add("organizations:feature-flag-suspect-flags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect commit information in workflow notification emails
    manager.add("organizations:suspect-commits-in-emails", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=False)
    # Enable suspect feature tags endpoint.
    manager.add("organizations:issues-suspect-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect score display in distributions drawer (internal only)
    manager.add("organizations:suspect-scores-sandbox-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable open in explore and create alert actions inside insight charts
    manager.add("organizations:insights-chart-actions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to insights metrics alerts
    manager.add("organizations:insights-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to Mobile Screens insights module
    manager.add("organizations:insights-mobile-screens-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Seer Webhooks to be sent and listened to
    manager.add("organizations:seer-webhooks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable mobile starfish app start module view
    manager.add("organizations:starfish-mobile-appstart", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable mobile starfish ui module view
    manager.add("organizations:starfish-mobile-ui-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new experimental starfish view
    manager.add("organizations:starfish-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for regression issues RCA using spans data
    manager.add("organizations:statistical-detectors-rca-spans-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Allow organizations to configure all symbol sources.
    manager.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable tracking of tombstone hits. When enabled, the feature increments the times_seen column and updates the last_seen timestamp
    manager.add("organizations:grouptombstones-hit-counter", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable static ClickHouse sampling for `OrganizationTagsEndpoint`
    manager.add("organizations:tag-key-sample-n", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable dynamic grouping UI (top issues)
    manager.add("organizations:top-issues-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new trace view.
    manager.add("organizations:trace-view-v1", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to show link to previous/next traces
    manager.add("organizations:trace-view-linked-traces", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable organization-level Triage signals V0 for Seer Automation page
    manager.add("organizations:triage-signals-v0-org", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new tracing onboarding ui
    manager.add("organizations:tracing-onboarding-new-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to expose export csv button in trace explorer
    manager.add("organizations:tracing-export-csv", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load quota exceeded banner in new trace view.
    manager.add("organizations:trace-view-quota-exceeded-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to use span only trace endpoint.
    manager.add("organizations:trace-spans-format", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to use trace admin ui.
    manager.add("organizations:trace-view-admin-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to use trace tabs layout ui
    manager.add("organizations:trace-tabs-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new traces onboarding guide.
    manager.add("organizations:traces-onboarding-guide", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load traces schema hints.
    manager.add("organizations:traces-schema-hints", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extraction metrics for transactions during ingestion.
    manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable feature to load explore link for transaction widgets
    manager.add("organizations:transaction-widget-deprecation-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Mark URL transactions scrubbed by regex patterns as "sanitized".
    # NOTE: This flag does not concern transactions rewritten by clusterer rules.
    # Those are always marked as "sanitized".
    manager.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Normalize URL transaction names during ingestion.
    manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables unlimited auto-triggered autofix runs
    manager.add("organizations:unlimited-auto-triggered-autofix-runs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables view hierarchy attachment scrubbing
    manager.add("organizations:view-hierarchy-scrubbing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable email notifications when auto-detected uptime monitors graduate from onboarding
    manager.add("organizations:uptime-auto-detected-monitor-emails", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable endpoint and frontend for AI-powered UF summaries
    manager.add("organizations:user-feedback-ai-summaries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable org-level caching for user feedback summaries and categorization
    manager.add("organizations:user-feedback-ai-summaries-cache", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable label generation at ingest time for user feedbacks
    manager.add("organizations:user-feedback-ai-categorization", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the backend endpoint and frontend for categorizing user feedbacks
    manager.add("organizations:user-feedback-ai-categorization-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI-powered title generation for user feedback
    manager.add("organizations:user-feedback-ai-titles", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable auto spam classification at User Feedback ingest time
    manager.add("organizations:user-feedback-spam-ingest", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable User Feedback v2 UI
    manager.add("organizations:user-feedback-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable view hierarchies options
    manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable equations feature on the new explore page
    manager.add("organizations:visibility-explore-equations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable equations feature in dashboards
    manager.add("organizations:visibility-dashboards-equations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable an async queue for dashboard widget queries
    manager.add("organizations:visibility-dashboards-async-queue", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new explore page
    manager.add("organizations:visibility-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable high date range options on new explore page
    manager.add("organizations:visibility-explore-range-high", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable medium date range options on new explore page
    manager.add("organizations:visibility-explore-range-medium", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Update action status when integration is installed/deleted
    manager.add("organizations:update-action-status", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable single processing through workflow engine for issue alerts
    manager.add("organizations:workflow-engine-single-process-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable logging to debug workflow engine process workflows
    manager.add("organizations:workflow-engine-process-workflows-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable logging workflow evaluations (bypasses sample rate when enabled)
    manager.add("organizations:workflow-engine-log-evaluations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable logs to debug various metric issue things
    manager.add("organizations:workflow-engine-metric-alert-dual-processing-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Creation of Metric Alerts that use the `group_by` field in the workflow_engine
    manager.add("organizations:workflow-engine-metric-alert-group-by-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable ingestion through trusted relays only
    manager.add("organizations:ingest-through-trusted-relays-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new workflow_engine UI (see: alerts create issues)
    manager.add("organizations:workflow-engine-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable redirects from alert rules to the new workflow_engine UI
    manager.add("organizations:workflow-engine-redirect-opt-out", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Create links to the new UI when sending notifications in the workflow_engine
    manager.add("organizations:workflow-engine-ui-links", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine serializers to return data for old rule / incident endpoints
    manager.add("organizations:workflow-engine-rule-serializers", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable metric detector limits by plan type
    manager.add("organizations:workflow-engine-metric-detector-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable EventUniqueUserFrequencyConditionWithConditions special alert condition
    manager.add("organizations:event-unique-user-frequency-condition-with-conditions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use spans instead of transactions for dynamic sampling calculations. This will become the new default.
    manager.add("organizations:dynamic-sampling-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable our logs product (known internally as ourlogs) in UI and backend
    manager.add("organizations:ourlogs-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product to be ingested via Relay.
    manager.add("organizations:ourlogs-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs stats to be displayed in the UI.
    manager.add("organizations:ourlogs-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay logs UI.
    manager.add("organizations:ourlogs-replay-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for logs pinning
    manager.add("organizations:ourlogs-pinning", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for logs export
    manager.add("organizations:ourlogs-export", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for interleaved errors in logs
    manager.add("organizations:ourlogs-interleaved-errors", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for log tags
    manager.add("organizations:ourlogs-tags-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable service hooks outbox
    manager.add("organizations:service-hooks-outbox", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable alerting on trace metrics
    manager.add("organizations:tracemetrics-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics in dashboards UI
    manager.add("organizations:tracemetrics-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable data scrubbing UI for trace metrics
    manager.add("organizations:tracemetrics-datascrubbing-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics product (known internally as tracemetrics) in UI and backend
    manager.add("organizations:tracemetrics-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for trace metrics export
    manager.add("organizations:tracemetrics-export", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics product to be ingested via Relay
    manager.add("organizations:tracemetrics-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics in replays UI
    manager.add("organizations:tracemetrics-replay-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics saved queries
    manager.add("organizations:tracemetrics-saved-queries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics stats to be displayed in the UI
    manager.add("organizations:tracemetrics-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace metrics in trace view UI
    manager.add("organizations:tracemetrics-traceview-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable traces page cross event querying
    manager.add("organizations:traces-page-cross-event-querying", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable downsampled date page filter
    manager.add("organizations:downsampled-date-page-filter", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

    # Enable feature flag to send expanded sentry apps webhooks (issue.created for all group categories)
    manager.add("organizations:expanded-sentry-apps-webhooks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable using paginated projects endpoint for Jira integration
    manager.add("organizations:jira-paginated-projects", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable single trace summary
    manager.add("organizations:single-trace-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable seeing upsell modal when clicking upgrade for multi-org
    manager.add("organizations:github-multi-org-upsell-modal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables new checkout UI
    manager.add("organizations:checkout-v3", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Stripe components in UI
    manager.add("organizations:stripe-components", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables new Subscription UI
    manager.add("organizations:subscriptions-v3", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables new grace period behavior
    manager.add("organizations:disable-grace-period", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables CMD+K supercharged (omni search)
    manager.add("organizations:cmd-k-supercharged", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Conversation focused views in AI Insights
    manager.add("organizations:gen-ai-conversations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:on-demand-gen-metrics-deprecation-prefill", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:on-demand-gen-metrics-deprecation-query-prefill", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable manual token refresh for Sentry apps
    manager.add("organizations:sentry-app-manual-token-refresh", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable num events in an issue debugging
    manager.add("projects:num-events-issue-debugging", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Project plugin features
    manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enables experimental span v2 processing in Relay.
    manager.add("projects:span-v2-experimental-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables experimental span attachment processing in Relay.
    manager.add("projects:span-v2-attachment-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables experimental trace attachment processing in Relay.
    manager.add("projects:trace-attachment-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Triage signals V0 for AI powered issue classification in sentry
    manager.add("projects:triage-signals-v0", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("projects:profiling-ingest-unsampled-profiles", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    manager.add("projects:project-detail-apple-app-hang-rate", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # fmt: on

    # Partner oauth
    manager.add(
        "organizations:scoped-partner-oauth",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=False,
    )

    # Control access to a new debug files role management
    manager.add(
        "organizations:debug-files-role-management",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=True,
    )
