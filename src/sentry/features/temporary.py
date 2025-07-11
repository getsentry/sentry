from .base import (
    FeatureHandlerStrategy,
    OrganizationFeature,
    ProjectFeature,
    ProjectPluginFeature,
    SystemFeature,
)
from .manager import FeatureManager

# XXX: See `features/__init__.py` for documentation on how to use feature flags


def register_temporary_features(manager: FeatureManager):
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
    # Use metrics as the dataset for crash free metric alerts
    manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anomaly detection feature for rollout
    manager.add("organizations:anomaly-detection-rollout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anomaly detection feature for EAP spans
    manager.add("organizations:anomaly-detection-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anr frame analysis
    manager.add("organizations:anr-analyze-frames", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Rollout of the new API rate limits for organization events
    manager.add("organizations:api-organization_events-rate-limit-reduced-rollout", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables the cron job to auto-enable codecov integrations.
    manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable greater query details in issues api for seer
    manager.add("organizations:detailed-data-for-seer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:autofix-seer-preferences", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Chonk UI
    manager.add("organizations:chonk-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Chonk UI Feedback button
    manager.add("organizations:chonk-ui-feedback", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Codecov UI
    manager.add("organizations:codecov-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the improved command menu (Cmd+K)
    manager.add("organizations:command-menu-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable C# support for Open PR Comments feature
    manager.add("organizations:csharp-open-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Go support for Open PR Comments feature
    manager.add("organizations:go-open-pr-comments", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable continuous profiling
    manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enabled for beta orgs
    manager.add("organizations:continuous-profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enabled ui for beta orgs
    manager.add("organizations:continuous-profiling-beta-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display profile durations on the stats page
    manager.add("organizations:continuous-profiling-stats", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable profile chunks processing with vroomrs
    manager.add("projects:continuous-profiling-vroomrs-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable transaction profiles processing with vroomrs
    manager.add("projects:transaction-profiling-vroomrs-processing", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable daily summary
    manager.add("organizations:daily-summary", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
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
    # Enable dashboard table widget visualization component to replace current widget tables
    manager.add("organizations:dashboards-use-widget-table-visualization", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy
    manager.add("organizations:data-secrecy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Data Secrecy v2 (with Break the Glass feature)
    manager.add("organizations:data-secrecy-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables synthesis of device.class in ingest
    manager.add("organizations:device-class-synthesis", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable device.class as a selectable column
    manager.add("organizations:device-classification", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'discover' interface. (might be unused)
    manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable the discover saved queries deprecation warnings
    manager.add("organizations:discover-saved-queries-deprecation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the org recalibration
    manager.add("organizations:ds-org-recalibration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable custom dynamic sampling rates
    manager.add("organizations:dynamic-sampling-custom", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable dynamic sampling minimum sample rate
    manager.add("organizations:dynamic-sampling-minimum-sample-rate", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable archive/escalating issue workflow features in v2
    manager.add("organizations:escalating-issues-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable emiting escalating data to the metrics backend
    manager.add("organizations:escalating-metrics-backend", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:gen-ai-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'generate me a query' functionality on the explore > traces page
    manager.add("organizations:gen-ai-explore-traces", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable GenAI consent
    manager.add("organizations:gen-ai-consent", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable disabling gitlab integrations when broken is detected
    manager.add("organizations:gitlab-disable-on-broken", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable increased issue_owners rate limit for auto-assignment
    manager.add("organizations:increased-issue-owners-rate-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Starfish: extract metrics from the spans
    manager.add("organizations:indexed-spans-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable integration functionality to work deployment integrations like Vercel
    manager.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    manager.add("organizations:integrations-feature-flag-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
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
    # Whether to make a side/parallel query against events -> group_attributes when searching issues
    manager.add("organizations:issue-search-group-attributes-side-query", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable custom views features in the issue stream
    manager.add("organizations:issue-stream-custom-views", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable issue stream performance improvements
    manager.add("organizations:issue-search-snuba", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the new issue category mapping
    manager.add("organizations:issue-taxonomy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:metric-issue-poc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("projects:metric-issue-creation", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:issue-open-periods", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable access to Laravel specific insights
    manager.add("organizations:laravel-insights", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-use-default-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:disable-clustering-setting", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True, default=False)
    # Migrate Orgs to new Azure DevOps Integration
    manager.add("organizations:migrate-azure-devops-integration", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Session Stats down to a minute resolution
    manager.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Display CPU and memory metrics in transactions with profiles
    manager.add("organizations:mobile-cpu-memory-in-transactions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Adds the ttid & ttfd vitals to the frontend
    manager.add("organizations:mobile-vitals", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables higher limit for alert rules
    manager.add("organizations:more-fast-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:more-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable higher limit for workflows
    manager.add("organizations:more-workflows", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:navigation-sidebar-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:navigation-sidebar-v2-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:new-page-filter", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=True, api_expose=True)
    # Enable access to NextJS specific insights
    manager.add("organizations:nextjs-insights", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI Agents specific insights
    manager.add("organizations:agents-insights", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable MCP specific insights
    manager.add("organizations:mcp-insights", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable mobile performance score calculation for transactions in relay
    manager.add("organizations:performance-calculate-mobile-perf-score-relay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable performance change explorer panel on trends page
    manager.add("organizations:performance-change-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable interpolation of null data points in charts instead of zerofilling in performance
    manager.add("organizations:performance-chart-interpolation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enables updated all events tab in a performance issue
    manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable performance on-boarding checklist
    manager.add("organizations:performance-onboarding-checklist", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable MongoDB support for the Queries module
    manager.add("organizations:performance-queries-mongodb-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable removing the fallback for metrics compatibility
    manager.add("organizations:performance-remove-metrics-compatibility-fallback", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable histogram view in span details
    manager.add("organizations:performance-span-histogram-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace details page with embedded spans
    manager.add("organizations:performance-trace-details", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace explorer features
    manager.add("organizations:performance-trace-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable sentry convention fields
    manager.add("organizations:performance-sentry-conventions-fields", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable querying spans fields stats from comparative workflows project
    manager.add("organizations:performance-spans-fields-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable FE/BE for tracing without performance
    manager.add("organizations:performance-tracing-without-performance", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=True, api_expose=True)
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
    # Enable default explore queries in the new side nav
    manager.add("organizations:performance-default-explore-queries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect attributes feature
    manager.add("organizations:performance-spans-suspect-attributes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Transaction alert deprecation
    manager.add("organizations:performance-transaction-deprecation-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod artifact assembly endpointAdd commentMore actions
    manager.add("organizations:preprod-artifact-assemble", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable preprod frontend routes
    manager.add("organizations:preprod-frontend-routes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the playstation ingestion in relay
    manager.add("organizations:relay-playstation-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enables production profiling in sentry browser application
    manager.add("organizations:profiling-browser", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables separate differential flamegraph page
    manager.add("organizations:profiling-differential-flamegraph-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables ability usage of direct profile chunks all the time
    manager.add("organizations:profiling-flamegraph-always-use-direct-chunks", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable global suspect functions in profiling
    manager.add("organizations:profiling-global-suspect-functions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable profiling summary redesign view
    manager.add("organizations:profiling-summary-redesign", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Limit project events endpoint to only query back a certain number of days
    manager.add("organizations:project-event-date-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:project-templates", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the new Related Events feature
    manager.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable related issues feature
    manager.add("organizations:related-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the release details performance section
    manager.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay AI summaries
    manager.add("organizations:replay-ai-summaries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay list selection
    manager.add("organizations:replay-list-select", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable version 2 of reprocessing (completely distinct from v1)
    manager.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable resolve in upcoming release
    # TODO(steve): Remove when we remove the feature from the UI
    manager.add("organizations:resolve-in-upcoming-release", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable revocation of org auth keys when a user renames an org slug
    manager.add("organizations:revoke-org-auth-on-slug-rename", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable search query builder raw search replacement
    manager.add("organizations:search-query-builder-raw-search-replacement", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new search query builder wildcard operators
    manager.add("organizations:search-query-builder-wildcard-operators", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable the rendering of @sentry/toolbar inside the sentry app. See `useInitSentryToolbar()`
    manager.add("organizations:init-sentry-toolbar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable Sentry Toolbar settings for customers (ex: project settings page)
    manager.add("organizations:sentry-toolbar-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable feature flag CTA on issue details page
    manager.add("organizations:feature-flag-cta", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature flag distribution flyout in issue details
    manager.add("organizations:feature-flag-distribution-flyout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect feature flags endpoint.
    manager.add("organizations:feature-flag-suspect-flags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect feature tags endpoint.
    manager.add("organizations:issues-suspect-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable suspect score display in distributions drawer (internal only)
    manager.add("organizations:suspect-scores-sandbox-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new release insights charts
    manager.add("organizations:insights-session-health-tab-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Lets organizations manage grouping configs
    manager.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable the split enhancements experiment
    manager.add("organizations:run-split-enhancements", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable SAML2 Single-logout
    manager.add("organizations:sso-saml2-slo", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Show links and upsells to Insights modules
    manager.add("organizations:insights-entry-points", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable access to initial Insights modules (Queries, Requests, Vitals, App Starts, Page Loads, Resources)
    manager.add("organizations:insights-initial-modules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable access to newer Insights modules (Caches, Queues, LLMs, Mobile UI)
    manager.add("organizations:insights-addon-modules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Make insights modules restrict queries to 14 days
    manager.add("organizations:insights-query-date-range-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Make LLM monitoring module use eap instead of metrics
    manager.add("organizations:insights-use-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Make Insights modules (except llm) use EAP instead of metrics
    manager.add("organizations:insights-modules-use-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Make insights overview module use EAP instead of metrics
    manager.add("organizations:insights-overview-use-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable open in explore and create alert actions inside insight charts
    manager.add("organizations:insights-chart-actions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to insights metrics alerts
    manager.add("organizations:insights-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Related Issues table in Insights modules
    manager.add("organizations:insights-related-issues-table", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to Mobile Screens insights module
    manager.add("organizations:insights-mobile-screens-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Removes performance landing page from sidebar and updates transaction summary breadcrumbs for insights
    manager.add("organizations:insights-performance-landing-removal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable team workflow notifications
    manager.add("organizations:team-workflow-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable feature to load more than 100 rows in performance trace view.
    manager.add("organizations:trace-view-load-more", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new trace view.
    manager.add("organizations:trace-view-v1", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to show link to previous/next traces
    manager.add("organizations:trace-view-linked-traces", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new tracing onboarding ui
    manager.add("organizations:tracing-onboarding-new-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Mark URL transactions scrubbed by regex patterns as "sanitized".
    # NOTE: This flag does not concern transactions rewritten by clusterer rules.
    # Those are always marked as "sanitized".
    manager.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Normalize URL transaction names during ingestion.
    manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables automatically triggering autofix on issue summary
    manager.add("organizations:trigger-autofix-on-issue-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables unlimited auto-triggered autofix runs
    manager.add("organizations:unlimited-auto-triggered-autofix-runs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables automatic hostname detection in uptime
    manager.add("organizations:uptime-automatic-hostname-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables automatic subscription creation in uptime
    manager.add("organizations:uptime-automatic-subscription-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables view hierarchy attachment scrubbing
    manager.add("organizations:view-hierarchy-scrubbing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable creating issues via the issue platform
    manager.add("organizations:uptime-create-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables detailed logging for uptime results
    manager.add("organizations:uptime-detailed-logging", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable processing uptime results via the detector handler
    manager.add("organizations:uptime-detector-handler", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:uptime-detector-create-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable sending uptime results to EAP (Events Analytics Platform)
    manager.add("organizations:uptime-eap-results", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable querying uptime data from EAP uptime_results instead of uptime_checks
    manager.add("organizations:uptime-eap-uptime-results-query", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:user-feedback-ai-summaries", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable auto spam classification at User Feedback ingest time
    manager.add("organizations:user-feedback-spam-ingest", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable auto spam filtering at User Feedback ingest time, if spam-ingest is also enabled
    manager.add("organizations:user-feedback-spam-filter-actions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable User Feedback v2 UI
    manager.add("organizations:user-feedback-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # User Feedback Error Link Ingestion Changes
    manager.add("organizations:user-feedback-event-link-ingestion-changes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable view hierarchies options
    manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable aggregates table editor on the new explore page
    manager.add("organizations:visibility-explore-aggregate-editor", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable equations feature on the new explore page
    manager.add("organizations:visibility-explore-equations", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new explore page
    manager.add("organizations:visibility-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable high date range options on new explore page
    manager.add("organizations:visibility-explore-range-high", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable medium date range options on new explore page
    manager.add("organizations:visibility-explore-range-medium", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enforce stacked navigation feature (with ability to opt out)
    manager.add("organizations:enforce-stacked-navigation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable processing activity updates in workflow engine
    manager.add("organizations:workflow-engine-process-activity", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable dual writing for issue alert issues (see: alerts create issues)
    manager.add("organizations:workflow-engine-issue-alert-dual-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable workflow processing for metric issues
    manager.add("organizations:workflow-engine-process-metric-issue-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable workflow engine for issue alerts
    manager.add("organizations:workflow-engine-process-workflows", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable logging to debug workflow engine process workflows
    manager.add("organizations:workflow-engine-process-workflows-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable firing actions for workflow engine issue alerts
    manager.add("organizations:workflow-engine-trigger-actions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable logs to debug metric alert dual processing
    manager.add("organizations:workflow-engine-metric-alert-dual-processing-logs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable sending test notifications from the workflow_engine
    manager.add("organizations:workflow-engine-test-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable dual writing for metric alert issues (see: alerts create issues)
    manager.add("organizations:workflow-engine-metric-alert-dual-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Processing for Metric Alerts in the workflow_engine
    manager.add("organizations:workflow-engine-metric-alert-processing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable ingestion through trusted relays only
    manager.add("organizations:ingest-through-trusted-relays-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable new workflow_engine UI (see: alerts create issues)
    manager.add("organizations:workflow-engine-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Create links to the new UI when sending notifications in the workflow_engine
    manager.add("organizations:workflow-engine-ui-links", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use workflow engine serializers to return data for old rule / incident endpoints
    manager.add("organizations:workflow-engine-rule-serializers", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable async processing of event workflows in a task rather than as part of post_process.
    manager.add("organizations:workflow-engine-post-process-async", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable async processing of actions in a task rather than as part of post_process.
    manager.add("organizations:workflow-engine-action-trigger-async", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable EventUniqueUserFrequencyConditionWithConditions special alert condition
    manager.add("organizations:event-unique-user-frequency-condition-with-conditions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use spans instead of transactions for dynamic sampling calculations. This will become the new default.
    manager.add("organizations:dynamic-sampling-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable our logs product (known internally as ourlogs) in UI and backend
    manager.add("organizations:ourlogs-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable our logs product to be ingested via Relay.
    manager.add("organizations:ourlogs-ingestion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable calculated byte counts on ingested logs.
    manager.add("organizations:ourlogs-calculated-byte-count", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable extraction of meta attributes for logs.
    manager.add("organizations:ourlogs-meta-attributes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable our logs stats to be displayed in the UI.
    manager.add("organizations:ourlogs-stats", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the visualize sidebar in the logs UI.
    manager.add("organizations:ourlogs-visualize-sidebar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable logs in the dashboards UI.
    manager.add("organizations:ourlogs-dashboards", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable alerting on logs.
    manager.add("organizations:ourlogs-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable live refresh in the logs UI.
    manager.add("organizations:ourlogs-live-refresh", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable infinite scroll in the logs UI.
    manager.add("organizations:ourlogs-infinite-scroll", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable replay logs UI.
    manager.add("organizations:ourlogs-replay-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable per-project selection for Jira integration
    manager.add("organizations:jira-per-project-statuses", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable using paginated projects endpoint for Jira integration
    manager.add("organizations:jira-paginated-projects", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable single trace summary
    manager.add("organizations:single-trace-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable users to connect many Sentry orgs to a single Github org
    manager.add("organizations:github-multi-org", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable seeing upsell modal when clicking upgrade for multi-org
    manager.add("organizations:github-multi-org-upsell-modal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables quick testing of disabling transaction name clustering for a project.
    manager.add("projects:transaction-name-clustering-disabled", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False, default=False)

    # NOTE: Don't add features down here! Add them to their specific group and sort
    #       them alphabetically! The order features are registered is not important.

    # Project scoped features #
    ###########################
    # Adds additional filters and a new section to issue alert rules.
    manager.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    manager.add("projects:discard-transaction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable calculating a severity score for events which create a new group
    manager.add("projects:first-event-severity-calculation", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable similarity embeddings API call
    # This feature is only available on the frontend using project details since the handler gets
    # project options and this is slow in the project index endpoint feature flag serialization
    manager.add("projects:similarity-embeddings", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=True)
    manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Starfish: extract metrics from the spans
    manager.add("projects:span-metrics-extraction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    manager.add("projects:span-metrics-extraction-addons", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:relay-otel-endpoint", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # EAP: extremely experimental flag that makes DDM page use EAP tables
    manager.add("projects:use-eap-spans-for-metrics-explorer", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable num events in an issue debugging
    manager.add("projects:num-events-issue-debugging", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Project plugin features
    manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)

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

    # Controls access to tempest features
    manager.add(
        "organizations:tempest-access",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=True,
    )
