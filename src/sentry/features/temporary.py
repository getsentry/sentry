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

    # Enables user registration.
    manager.add("auth:register", SystemFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable creating organizations within sentry (if SENTRY_SINGLE_ORGANIZATION is not enabled).
    manager.add("organizations:create", SystemFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Controls whether or not the relocation endpoints can be used.
    manager.add("relocation:enabled", SystemFeature, FeatureHandlerStrategy.INTERNAL)

    # Organization scoped features that are in development or in customer trials. #
    ###############################################################################

    # Enables activated alert rules
    manager.add("organizations:activated-alert-rules", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables IS_IN for issue alerts
    manager.add("organizations:issues-alerts-is-in", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enables alert creation on indexed events in UI (use for PoC/testing only)
    manager.add("organizations:alert-allow-indexed", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Use metrics as the dataset for crash free metric alerts
    manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:alert-filters", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables the migration of alerts (checked in a migration script).
    manager.add("organizations:alerts-migration-enabled", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable anomaly detection alerts
    manager.add("organizations:anomaly-detection-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable anr frame analysis
    manager.add("organizations:anr-analyze-frames", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable anr improvements ui
    manager.add("organizations:anr-improvements", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable auth provider configuration through api
    manager.add("organizations:api-auth-provider", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    manager.add("organizations:api-keys", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False)
    # Rollout of the new API rate limits for organization events
    manager.add("organizations:api-organization_events-rate-limit-reduced-rollout", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables the cron job to auto-enable codecov integrations.
    manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Autofix use new strategy without codebase indexing
    manager.add("organizations:autofix-disable-codebase-indexing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False)
    # Enables getting commit sha from git blame for codecov.
    manager.add("organizations:codecov-commit-sha-from-git-blame", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Disables legacy cron ingest endpoints
    manager.add("organizations:crons-disable-ingest-endpoints", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Disables legacy cron ingest endpoints
    manager.add("organizations:crons-write-user-feedback", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable daily summary
    manager.add("organizations:daily-summary", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable dashboard widget indicators.
    manager.add("organizations:dashboard-widget-indicators", OrganizationFeature, FeatureHandlerStrategy.REMOTE, default=True, api_expose=True)
    # Enables import/export functionality for dashboards
    manager.add("organizations:dashboards-import", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable metrics enhanced performance in dashboards
    manager.add("organizations:dashboards-mep", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable release health widget in dashboards
    manager.add("organizations:dashboards-rh-widget", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:dashboards-span-metrics", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable the dev toolbar PoC code for employees
    manager.add("organizations:devtoolbar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False)
    # Delightful Developer Metrics (DDM):
    # Enables experimental WIP custom metrics related features
    manager.add("organizations:custom-metrics-experimental", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables generation of custom metrics extraction rules
    manager.add("organizations:custom-metrics-extraction-rule", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enables UI for creation of custom metrics extraction rules
    manager.add("organizations:custom-metrics-extraction-rule-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enables metrics extrapolation feature
    manager.add("organizations:metrics-extrapolation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable the default alert at project creation to be the high priority alert
    manager.add("organizations:default-high-priority-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables automatically deriving of code mappings
    manager.add("organizations:derive-code-mappings", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enables synthesis of device.class in ingest
    manager.add("organizations:device-class-synthesis", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable device.class as a selectable column
    manager.add("organizations:device-classification", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable the 'discover' interface. (might be unused)
    manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable the org recalibration
    manager.add("organizations:ds-org-recalibration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables data secrecy mode
    manager.add("organizations:enterprise-data-secrecy", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable archive/escalating issue workflow features in v2
    manager.add("organizations:escalating-issues-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable emiting escalating data to the metrics backend
    manager.add("organizations:escalating-metrics-backend", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable disabling gitlab integrations when broken is detected
    manager.add("organizations:gitlab-disable-on-broken", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable experimental new version of stacktrace component where additional
    # data related to grouping is shown on each frame
    manager.add("organizations:grouping-stacktrace-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable only calculating a secondary hash when needed
    manager.add("organizations:grouping-suppress-unnecessary-secondary-hash", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable tweaks to group title in relation to hierarchical grouping.
    manager.add("organizations:grouping-title-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Allows an org to have a larger set of project ownership rules per project
    manager.add("organizations:higher-ownership-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable increased issue_owners rate limit for auto-assignment
    manager.add("organizations:increased-issue-owners-rate-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Starfish: extract metrics from the spans
    manager.add("organizations:indexed-spans-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable custom alert priorities for Pagerduty and Opsgenie
    manager.add("organizations:integrations-custom-alert-priorities", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable integration functionality to work deployment integrations like Vercel
    manager.add("organizations:integrations-deployment", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    manager.add("organizations:integrations-feature-flag-integration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Allow tenant type installations through issue alert actions
    manager.add("organizations:integrations-msteams-tenant", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable inviting members to organizations.
    manager.add("organizations:invite-members", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable rate limits for inviting members.
    manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enables the UI for Autofix in issue details
    manager.add("organizations:issue-details-autofix-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables a toggle for entering the new issue details UI
    manager.add("organizations:issue-details-new-experience-toggle", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables access to the streamlined issue details UI
    manager.add("organizations:issue-details-streamline", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Whether to allow issue only search on the issue list
    manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Whether to make a side/parallel query against events -> group_attributes when searching issues
    manager.add("organizations:issue-search-group-attributes-side-query", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable custom views features in the issue stream
    manager.add("organizations:issue-stream-custom-views", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable the updated empty state for issues
    manager.add("organizations:issue-stream-empty-state", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable additional platforms for issue stream empty state
    manager.add("organizations:issue-stream-empty-state-additional-platforms", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable issue stream performance improvements
    manager.add("organizations:issue-stream-performance", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:issue-search-snuba", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable the new issue stream search bar UI
    manager.add("organizations:issue-stream-search-query-builder", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:large-debug-files", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable v8 support for the Loader Script
    manager.add("organizations:js-sdk-loader-v8", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enabled latest adopted release filter for issue alerts
    manager.add("organizations:latest-adopted-release-filter", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    manager.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:mep-use-default-tags", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable messaging integration onboarding when setting up alerts
    manager.add("organizations:messaging-integration-onboarding", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable metric alert charts in email/slack
    manager.add("organizations:metric-alert-chartcuterie", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable load shedding for newly created metric alerts
    manager.add("organizations:metric-alert-load-shedding", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable threshold period in metric alert rule builder
    manager.add("organizations:metric-alert-threshold-period", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables the search bar for metrics samples list
    manager.add("organizations:metrics-samples-list-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable Session Stats down to a minute resolution
    manager.add("organizations:minute-resolution-sessions", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Display CPU and memory metrics in transactions with profiles
    manager.add("organizations:mobile-cpu-memory-in-transactions", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Adds the ttid & ttfd vitals to the frontend
    manager.add("organizations:mobile-vitals", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables higher limit for alert rules
    manager.add("organizations:more-fast-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:more-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:new-page-filter", OrganizationFeature, FeatureHandlerStrategy.REMOTE, default=True, api_expose=True)
    manager.add("organizations:new-weekly-report", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Display warning banner for every event issue alerts
    manager.add("organizations:noisy-alert-warning", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Notify all project members when fallthrough is disabled, instead of just the auto-assignee
    manager.add("organizations:notification-all-recipients", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Drop obsoleted status changes in occurence consumer
    manager.add("organizations:occurence-consumer-prune-status-changes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable User Feedback v1
    manager.add("organizations:old-user-feedback", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Extract on demand metrics
    manager.add("organizations:on-demand-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Extract on demand metrics (experimental features)
    manager.add("organizations:on-demand-metrics-extraction-experimental", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Extract on demand metrics (widget extraction)
    manager.add("organizations:on-demand-metrics-extraction-widgets", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # This spec version includes the environment in the query hash
    manager.add("organizations:on-demand-metrics-query-spec-version-two", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Display metrics components with a new design
    manager.add("organizations:metrics-new-inputs", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Display on demand metrics related UI elements
    manager.add("organizations:on-demand-metrics-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Display on demand metrics related UI elements, for dashboards and widgets. The other flag is for alerts.
    manager.add("organizations:on-demand-metrics-ui-widgets", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Only enabled in sentry.io to enable onboarding flows.
    manager.add("organizations:onboarding", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable the SDK selection feature in the onboarding
    manager.add("organizations:onboarding-sdk-selection", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable views for anomaly detection
    manager.add("organizations:performance-anomaly-detection-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable mobile performance score calculation for transactions in relay
    manager.add("organizations:performance-calculate-mobile-perf-score-relay", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable performance change explorer panel on trends page
    manager.add("organizations:performance-change-explorer", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable interpolation of null data points in charts instead of zerofilling in performance
    manager.add("organizations:performance-chart-interpolation", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable consecutive http performance issue type
    manager.add("organizations:performance-consecutive-http-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable database view powered by span metrics
    manager.add("organizations:performance-database-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable database view percentile graphs
    manager.add("organizations:performance-database-view-percentiles", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    manager.add("organizations:performance-db-main-thread-detector", OrganizationFeature)
    # Enable Discover Saved Query dataset selector
    manager.add("organizations:performance-discover-dataset-selector", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable backend overriding and always making a fresh split decision
    manager.add("organizations:performance-discover-widget-split-override-save", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable UI sending a discover split for widget
    manager.add("organizations:performance-discover-widget-split-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:performance-file-io-main-thread-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables updated all events tab in a performance issue
    manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable performance issues dev options, includes changing parts of issues that we're using for development.
    manager.add("organizations:performance-issues-dev", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Temporary flag to test search performance that's running slow in S4S
    manager.add("organizations:performance-issues-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enables a longer stats period for the performance landing page
    manager.add("organizations:performance-landing-page-stats-period", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable consecutive http performance issue type
    manager.add("organizations:performance-large-http-payload-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable internal view for bannerless MEP view
    manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Re-enable histograms for Metrics Enhanced Performance Views
    manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable metrics-backed transaction summary view
    manager.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable the UI for displaying mobile performance score
    manager.add("organizations:performance-mobile-perf-score-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable new trends
    manager.add("organizations:performance-new-trends", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable updated landing page widget designs
    manager.add("organizations:performance-new-widget-designs", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable performance on-boarding checklist
    manager.add("organizations:performance-onboarding-checklist", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable removing the fallback for metrics compatibility
    manager.add("organizations:performance-remove-metrics-compatibility-fallback", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable span search bar in Insights module sample panels
    manager.add("organizations:performance-sample-panel-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable platform selector for screens flow
    manager.add("organizations:performance-screens-platform-selector", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable screens view powered by span metrics
    manager.add("organizations:performance-screens-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable histogram view in span details
    manager.add("organizations:performance-span-histogram-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable trace details page with embedded spans
    manager.add("organizations:performance-trace-details", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable trace explorer features
    manager.add("organizations:performance-trace-explorer", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable trace explorer sorting by newest
    manager.add("organizations:performance-trace-explorer-sorting", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable linking to trace explorer from metrics
    manager.add("organizations:performance-trace-explorer-with-metrics", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable FE/BE for tracing without performance
    manager.add("organizations:performance-tracing-without-performance", OrganizationFeature, FeatureHandlerStrategy.REMOTE, default=True, api_expose=True)
    # Enable transaction name only search
    manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable transaction name only search on indexed
    manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Hides some fields and sections in the transaction summary page that are being deprecated
    manager.add("organizations:performance-transaction-summary-cleanup", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables the new UI for span summary and the spans tab
    manager.add("organizations:performance-spans-new-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Experimental performance issue for streamed spans - ingestion
    manager.add("organizations:performance-streamed-spans-exp-ingest", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Experimental performance issue for streamed spans - UI
    manager.add("organizations:performance-streamed-spans-exp-visible", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable processing slow issue alerts
    manager.add("organizations:process-slow-alerts", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enabled creating issues out of trends
    manager.add("organizations:performance-trends-issues", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Bypass 30 day date range selection when fetching new trends data
    manager.add("organizations:performance-trends-new-data-date-range-default", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    manager.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable showing INP web vital in default views
    manager.add("organizations:performance-vitals-inp", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable profiling
    manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enabled for those orgs who participated in the profiling Beta program
    manager.add("organizations:profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables production profiling in sentry browser application
    manager.add("organizations:profiling-browser", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables separate differential flamegraph page
    manager.add("organizations:profiling-differential-flamegraph-page", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable global suspect functions in profiling
    manager.add("organizations:profiling-global-suspect-functions", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable profiling summary redesign view
    manager.add("organizations:profiling-summary-redesign", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable the transactions backed profiling views
    manager.add("organizations:profiling-using-transactions", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable continuous profiling
    manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable continuous profiling ui
    manager.add("organizations:continuous-profiling-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Display profile durations on the stats page
    manager.add("organizations:continuous-profiling-stats", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable the continuous profiling compatible redesign
    manager.add("organizations:continuous-profiling-compat", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable asking for feedback after project-create when replay is disabled
    manager.add("organizations:project-create-replay-feedback", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Limit project events endpoint to only query back a certain number of days
    manager.add("organizations:project-event-date-limit", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable the new Related Events feature
    manager.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable related issues feature
    manager.add("organizations:related-issues", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Metrics cardinality limiter in Relay
    manager.add("organizations:relay-cardinality-limiter", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable the release details performance section
    manager.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable new release UI
    manager.add("organizations:releases-v2", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    manager.add("organizations:releases-v2-banner", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:releases-v2-internal", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    manager.add("organizations:releases-v2-st", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable playing replays from the replay tab
    manager.add("organizations:replay-play-from-replay-tab", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable version 2 of reprocessing (completely distinct from v1)
    manager.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("organizations:required-email-verification", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable resolve in upcoming release
    manager.add("organizations:resolve-in-upcoming-release", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable post create/edit rule confirmation notifications
    manager.add("organizations:rule-create-edit-confirm-notification", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    manager.add("organizations:sandbox-kill-switch", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable team member role provisioning through scim
    manager.add("organizations:scim-team-roles", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable the Replay Details > Accessibility tab
    manager.add("organizations:session-replay-a11y-tab", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable the accessibility issues endpoint
    manager.add("organizations:session-replay-accessibility-issues", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable combined envelope Kafka items in Relay
    manager.add("organizations:session-replay-combined-envelope-items", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable canvas recording
    manager.add("organizations:session-replay-enable-canvas", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable canvas replaying
    manager.add("organizations:session-replay-enable-canvas-replayer", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable Hydration Error Issue Creation In Recording Consumer
    manager.add("organizations:session-replay-hydration-error-issue-creation", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable linking from 'new issue' email notifs to the issue replay list
    manager.add("organizations:session-replay-issue-emails", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable queries to materialized view from replay index endpoint
    manager.add("organizations:session-replay-materialized-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False)
    # Enable mobile replay player
    manager.add("organizations:session-replay-mobile-player", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Disable select orgs from ingesting mobile replay events.
    manager.add("organizations:session-replay-video-disabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable replay player timeline gaps
    manager.add("organizations:session-replay-timeline-gap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False)
    # Enable the new event linking columns to be queried
    manager.add("organizations:session-replay-new-event-counts", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable Rage Click Issue Creation In Recording Consumer
    manager.add("organizations:session-replay-rage-click-issue-creation", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable data scrubbing of replay recording payloads in Relay.
    manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable core Session Replay SDK for recording on sentry.io
    manager.add("organizations:session-replay-sdk", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable core Session Replay SDK for recording onError events on sentry.io
    manager.add("organizations:session-replay-sdk-errors-only", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable linking from 'new issue' slack notifs to the issue replay list
    manager.add("organizations:session-replay-slack-new-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable core Session Replay link in the sidebar
    manager.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable replay web vital breadcrumbs
    manager.add("organizations:session-replay-web-vitals", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False)
    # Lets organizations manage grouping configs
    manager.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable description field in Slack metric alerts
    manager.add("organizations:slack-metric-alert-description", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable improvements to Slack notifications
    manager.add("organizations:slack-improvements", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Feature flags for migrating to the Slack SDK WebClient
    # Use new Slack SDK Client in get_channel_id_with_timeout
    manager.add("organizations:slack-sdk-get-channel-id", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Add regression chart as image to slack message
    manager.add("organizations:slack-endpoint-regression-image", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    manager.add("organizations:slack-function-regression-image", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    manager.add("organizations:email-performance-regression-image", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    manager.add("organizations:stacktrace-processing-caching", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Show links and upsells to Insights modules
    manager.add("organizations:insights-entry-points", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable access to initial Insights modules (Queries, Requests, Vitals, App Starts, Page Loads, Resources)
    manager.add("organizations:insights-initial-modules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable access to newer Insights modules (Caches, Queues, LLMs, Mobile UI)
    manager.add("organizations:insights-addon-modules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Use static web vital performance scoring weights
    manager.add("organizations:insights-browser-webvitals-static-weights", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Sets all web vitals to optional when calculating performance scores
    manager.add("organizations:insights-browser-webvitals-optional-components", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Add default browser performance score profile for fallback when no or unknown browser name is provided
    manager.add("organizations:insights-default-performance-score-profiles", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enable standalone span ingestion
    manager.add("organizations:standalone-span-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable the aggregate span waterfall view
    manager.add("organizations:starfish-aggregate-span-waterfall", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable bundle analysis ui and endpoint
    manager.add("organizations:starfish-browser-resource-module-bundle-analysis", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enables the resource module ui
    manager.add("organizations:starfish-browser-resource-module-image-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enables the resource module ui
    manager.add("organizations:starfish-browser-resource-module-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable mobile starfish app start module view
    manager.add("organizations:starfish-mobile-appstart", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable mobile starfish ui module view
    manager.add("organizations:starfish-mobile-ui-module", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable starfish endpoint that's used for regressing testing purposes
    manager.add("organizations:starfish-test-endpoint", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable the new experimental starfish view
    manager.add("organizations:starfish-view", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable UI for regression issues RCA using spans data
    manager.add("organizations:statistical-detectors-rca-spans-only", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable starfish dropdown on the webservice view for switching chart visualization
    manager.add("organizations:starfish-wsv-chart-dropdown", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Allow organizations to configure all symbol sources.
    manager.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable team workflow notifications
    manager.add("organizations:team-workflow-notifications", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable feature to load more than 100 rows in performance trace view.
    manager.add("organizations:trace-view-load-more", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable feature to load new trace view.
    manager.add("organizations:trace-view-v1", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable feature to load new trace view in replay trace tab.
    manager.add("organizations:replay-trace-view-v1", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable feature to use span only trace endpoint.
    manager.add("organizations:trace-spans-format", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Extraction metrics for transactions during ingestion.
    manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Mark URL transactions scrubbed by regex patterns as "sanitized".
    # NOTE: This flag does not concern transactions rewritten by clusterer rules.
    # Those are always marked as "sanitized".
    manager.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Normalize URL transaction names during ingestion.
    manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Sanitize transaction names in the ingestion pipeline. # Deprecated
    manager.add("organizations:transaction-name-sanitization", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enables automatic hostname detection in uptime
    manager.add("organizations:uptime-automatic-hostname-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enables automatic subscription creation in uptime
    manager.add("organizations:uptime-automatic-subscription-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enabled returning uptime monitors from the rule api
    manager.add("organizations:uptime-rule-api", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    # Enables uptime related settings for projects and orgs
    manager.add('organizations:uptime-settings', OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE)
    manager.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.REMOTE)
    # Enable User Feedback v2 ingest
    manager.add("organizations:user-feedback-ingest", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Use ReplayClipPreview inside the User Feedback Details panel
    manager.add("organizations:user-feedback-replay-clip", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable User Feedback spam auto filtering feature ingest
    manager.add("organizations:user-feedback-spam-filter-ingest", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable User Feedback spam auto filtering feature actions
    manager.add("organizations:user-feedback-spam-filter-actions", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable User Feedback v2 UI
    manager.add("organizations:user-feedback-ui", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # User Feedback Error Link Ingestion Changes
    manager.add("organizations:user-feedback-event-link-ingestion-changes", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable view hierarchies options
    manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enable minimap in the widget viewer modal in dashboards
    manager.add("organizations:widget-viewer-modal-minimap", OrganizationFeature, FeatureHandlerStrategy.REMOTE, api_expose=True)
    # Enabled unresolved issue webhook for organization
    manager.add("organizations:webhooks-unresolved", OrganizationFeature, FeatureHandlerStrategy.OPTIONS)
    manager.add("organizations:project-templates", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)
    # NOTE: Don't add features down here! Add them to their specific group and sort
    #       them alphabetically! The order features are registered is not important.

    # Project scoped features #
    ###########################
    # Enable AI Autofix feture on the Issue Details page.
    manager.add("projects:ai-autofix", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # Adds additional filters and a new section to issue alert rules.
    manager.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    manager.add("projects:discard-transaction", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable calculating a severity score for events which create a new group
    manager.add("projects:first-event-severity-calculation", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable escalation detection for new issues
    manager.add("projects:first-event-severity-new-escalation", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable severity alerts for new issues based on severity and escalation
    manager.add("projects:high-priority-alerts", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # Enable functionality for attaching  minidumps to events and displaying
    # then in the group UI.
    manager.add("projects:minidump", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable alternative version of group creation that is supposed to be less racy.
    manager.add("projects:race-free-group-creation", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enable similarity embeddings API call
    manager.add("projects:similarity-embeddings", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False)
    # Enable similarity embeddings backfill
    manager.add("projects:similarity-embeddings-backfill", ProjectFeature, FeatureHandlerStrategy.OPTIONS)
    manager.add("projects:similarity-embeddings-delete-by-hash", ProjectFeature, FeatureHandlerStrategy.OPTIONS)
    # Enable similarity embeddings grouping
    manager.add("projects:similarity-embeddings-grouping", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False)
    # Enable adding seer grouping metadata to new groups
    manager.add("projects:similarity-embeddings-metadata", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False)
    manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    # Starfish: extract metrics from the spans
    manager.add("projects:span-metrics-extraction", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:span-metrics-extraction-addons", ProjectFeature, FeatureHandlerStrategy.INTERNAL)
    manager.add("projects:relay-otel-endpoint", ProjectFeature, FeatureHandlerStrategy.OPTIONS)

    # Project plugin features
    manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL, default=True)

    manager.add("projects:profiling-ingest-unsampled-profiles", ProjectFeature, FeatureHandlerStrategy.REMOTE)
    # fmt: on
