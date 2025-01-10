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
    manager.add("organizations:activated-alert-rules", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable AI Issue Summary feature on the Issue Details page.
    manager.add("organizations:ai-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables alert creation on indexed events in UI (use for PoC/testing only)
    manager.add("organizations:alert-allow-indexed", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use metrics as the dataset for crash free metric alerts
    manager.add("organizations:alert-crash-free-metrics", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:alert-filters", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables the migration of alerts (checked in a migration script).
    manager.add("organizations:alerts-migration-enabled", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables EAP alerts
    manager.add("organizations:alerts-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anomaly detection feature for rollout
    manager.add("organizations:anomaly-detection-rollout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable anomaly detection charts
    manager.add("organizations:anomaly-detection-alerts-charts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable anr frame analysis
    manager.add("organizations:anr-analyze-frames", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:api-keys", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=True)
    # Rollout of the new API rate limits for organization events
    manager.add("organizations:api-organization_events-rate-limit-reduced-rollout", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables the cron job to auto-enable codecov integrations.
    manager.add("organizations:auto-enable-codecov", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables Autofix
    manager.add("organizations:autofix", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Autofix use new strategy without codebase indexing
    manager.add("organizations:autofix-disable-codebase-indexing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enables getting commit sha from git blame for codecov.
    manager.add("organizations:codecov-commit-sha-from-git-blame", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable continuous profiling
    manager.add("organizations:continuous-profiling", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enabled for beta orgs
    manager.add("organizations:continuous-profiling-beta", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable stopping the ingestion of continuous profile for non-beta orgs
    manager.add("organizations:continuous-profiling-beta-ingest", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display profile durations on the stats page
    manager.add("organizations:continuous-profiling-stats", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Delightful Developer Metrics (DDM):
    # Enables experimental WIP custom metrics related features
    manager.add("organizations:custom-metrics-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables Info alert for custom metrics and alerts widgets removal
    manager.add("organizations:custom-metrics-alerts-widgets-removal-info", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable daily summary
    manager.add("organizations:daily-summary", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable events analytics platform data in dashboards
    manager.add("organizations:dashboards-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables import/export functionality for dashboards
    manager.add("organizations:dashboards-import", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics enhanced performance in dashboards
    manager.add("organizations:dashboards-mep", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics enhanced performance for AM2+ customers as they transition from AM2 to AM3
    manager.add("organizations:dashboards-metrics-transition", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:dashboards-span-metrics", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    # Enable table view on dashboards landing page
    manager.add("organizations:dashboards-table-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable share links for dashboards for sharing outside the org
    manager.add("organizations:dashboards-share", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable favouriting dashboards
    manager.add("organizations:dashboards-favourite", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the dashboard widget builder redesign UI
    manager.add("organizations:dashboards-widget-builder-redesign", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the dev toolbar PoC code for employees
    # Data Secrecy
    manager.add("organizations:data-secrecy", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:devtoolbar", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    manager.add("organizations:email-performance-regression-image", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    # Enables automatically deriving of code mappings
    manager.add("organizations:derive-code-mappings", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    # Enables synthesis of device.class in ingest
    manager.add("organizations:device-class-synthesis", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable device.class as a selectable column
    manager.add("organizations:device-classification", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the 'discover' interface. (might be unused)
    manager.add("organizations:discover", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable the org recalibration
    manager.add("organizations:ds-org-recalibration", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable custom dynamic sampling rates
    manager.add("organizations:dynamic-sampling-custom", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables data secrecy mode
    manager.add("organizations:enterprise-data-secrecy", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable issue platform deletion
    manager.add("organizations:issue-platform-deletion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable archive/escalating issue workflow features in v2
    manager.add("organizations:escalating-issues-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable emiting escalating data to the metrics backend
    manager.add("organizations:escalating-metrics-backend", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable logging for failure rate subscription processor
    manager.add("organizations:failure-rate-metric-alert-logging", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable GenAI features such as Autofix and Issue Summary
    manager.add("organizations:gen-ai-features", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable disabling gitlab integrations when broken is detected
    manager.add("organizations:gitlab-disable-on-broken", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Allow creating `GroupHashMetadata` records
    manager.add("organizations:grouphash-metadata-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable new invite members modal.
    manager.add("organizations:invite-members-new-modal", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable rate limits for inviting members.
    manager.add("organizations:invite-members-rate-limits", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enable displaying the trace view on issue details
    manager.add("organizations:issue-details-always-show-trace", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the UI for Autofix in issue details
    manager.add("organizations:issue-details-autofix-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Issue Platform deletion
    manager.add("organizations:issue-platform-deletion", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Issue Platform deletion UI
    manager.add("organizations:issue-platform-deletion-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables a toggle for entering the new issue details UI
    manager.add("organizations:issue-details-new-experience-toggle", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables opt-in access to the streamlined issue details UI for all users of an organization
    manager.add("organizations:issue-details-streamline", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables streamlined issue details UI for all users of an organization without opt-out
    manager.add("organizations:issue-details-streamline-enforce", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Whether to allow issue only search on the issue list
    manager.add("organizations:issue-search-allow-postgres-only-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Whether to make a side/parallel query against events -> group_attributes when searching issues
    manager.add("organizations:issue-search-group-attributes-side-query", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable custom views features in the issue stream
    manager.add("organizations:issue-stream-custom-views", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the updated empty state for issues
    manager.add("organizations:issue-stream-empty-state", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable additional platforms for issue stream empty state
    manager.add("organizations:issue-stream-empty-state-additional-platforms", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable issue stream performance improvements
    manager.add("organizations:issue-stream-performance", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:issue-search-snuba", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable issue stream table layout changes
    manager.add("organizations:issue-stream-table-layout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # When enabled, uses the functional issue stream component
    manager.add("organizations:issue-stream-functional-refactor", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:large-debug-files", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("organizations:metric-issue-poc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-rollout-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:mep-use-default-tags", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable threshold period in metric alert rule builder
    manager.add("organizations:metric-alert-threshold-period", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    manager.add("organizations:navigation-sidebar-v2", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:new-page-filter", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=True, api_expose=True)
    # Drop obsoleted status changes in occurence consumer
    manager.add("organizations:occurence-consumer-prune-status-changes", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable User Feedback v1
    manager.add("organizations:old-user-feedback", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics
    manager.add("organizations:on-demand-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics (experimental features)
    manager.add("organizations:on-demand-metrics-extraction-experimental", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Extract on demand metrics (widget extraction)
    manager.add("organizations:on-demand-metrics-extraction-widgets", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # This spec version includes the environment in the query hash
    manager.add("organizations:on-demand-metrics-query-spec-version-two", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Display metrics components with a new design
    manager.add("organizations:metrics-new-inputs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Display new Source map uploads view in settings
    manager.add('organizations:new-source-map-uploads-view', OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
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
    # Enable consecutive http performance issue type
    manager.add("organizations:performance-consecutive-http-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable database view powered by span metrics
    manager.add("organizations:performance-database-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable database view percentile graphs
    manager.add("organizations:performance-database-view-percentiles", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:performance-db-main-thread-detector", OrganizationFeature, api_expose=False)
    # Enable Discover Saved Query dataset selector
    manager.add("organizations:performance-discover-dataset-selector", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable deprecate discover widget type
    manager.add("organizations:deprecate-discover-widget-type", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable backend overriding and always making a fresh split decision
    manager.add("organizations:performance-discover-widget-split-override-save", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable UI sending a discover split for widget
    manager.add("organizations:performance-discover-widget-split-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:performance-file-io-main-thread-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables updated all events tab in a performance issue
    manager.add("organizations:performance-issues-all-events-tab", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable performance issues dev options, includes changing parts of issues that we're using for development.
    manager.add("organizations:performance-issues-dev", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Temporary flag to test search performance that's running slow in S4S
    manager.add("organizations:performance-issues-search", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enables a longer stats period for the performance landing page
    manager.add("organizations:performance-landing-page-stats-period", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable consecutive http performance issue type
    manager.add("organizations:performance-large-http-payload-detector", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable internal view for bannerless MEP view
    manager.add("organizations:performance-mep-bannerless-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Re-enable histograms for Metrics Enhanced Performance Views
    manager.add("organizations:performance-mep-reintroduce-histograms", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable metrics-backed transaction summary view
    manager.add("organizations:performance-metrics-backed-transaction-summary", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the UI for displaying mobile performance score
    manager.add("organizations:performance-mobile-perf-score-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
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
    # Enable platform selector for screens flow
    manager.add("organizations:performance-screens-platform-selector", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable screens view powered by span metrics
    manager.add("organizations:performance-screens-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable histogram view in span details
    manager.add("organizations:performance-span-histogram-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace details page with embedded spans
    manager.add("organizations:performance-trace-details", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace explorer features
    manager.add("organizations:performance-trace-explorer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable trace explorer sorting by newest
    manager.add("organizations:performance-trace-explorer-sorting", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable linking to trace explorer from metrics
    manager.add("organizations:performance-trace-explorer-with-metrics", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable FE/BE for tracing without performance
    manager.add("organizations:performance-tracing-without-performance", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=True, api_expose=True)
    # Enable transaction name only search
    manager.add("organizations:performance-transaction-name-only-search", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable transaction name only search on indexed
    manager.add("organizations:performance-transaction-name-only-search-indexed", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Hides some fields and sections in the transaction summary page that are being deprecated
    manager.add("organizations:performance-transaction-summary-cleanup", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enables the new UI for span summary and the spans tab
    manager.add("organizations:performance-spans-new-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Experimental performance issue for streamed spans - ingestion
    manager.add("organizations:performance-streamed-spans-exp-ingest", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Experimental performance issue for streamed spans - UI
    manager.add("organizations:performance-streamed-spans-exp-visible", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enabled creating issues out of trends
    manager.add("organizations:performance-trends-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Bypass 30 day date range selection when fetching new trends data
    manager.add("organizations:performance-trends-new-data-date-range-default", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:performance-use-metrics", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable showing INP web vital in default views
    manager.add("organizations:performance-vitals-inp", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable handling missing webvitals in performance score
    manager.add("organizations:performance-vitals-handle-missing-webvitals", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable handling standalone lcp and cls spans in performance
    manager.add("organizations:performance-standalone-lcp-cls-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable profiling
    manager.add("organizations:profiling", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enabled for those orgs who participated in the profiling Beta program
    manager.add("organizations:profiling-beta", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enables production profiling in sentry browser application
    manager.add("organizations:profiling-browser", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables separate differential flamegraph page
    manager.add("organizations:profiling-differential-flamegraph-page", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable global suspect functions in profiling
    manager.add("organizations:profiling-global-suspect-functions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable profiling summary redesign view
    manager.add("organizations:profiling-summary-redesign", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the transactions backed profiling views
    manager.add("organizations:profiling-using-transactions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable asking for feedback after project-create when replay is disabled
    manager.add("organizations:project-create-replay-feedback", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Limit project events endpoint to only query back a certain number of days
    manager.add("organizations:project-event-date-limit", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:project-templates", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the new quick start guide
    manager.add("organizations:quick-start-updates", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new Related Events feature
    manager.add("organizations:related-events", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable related issues feature
    manager.add("organizations:related-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Metrics cardinality limiter in Relay
    manager.add("organizations:relay-cardinality-limiter", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the release details performance section
    manager.add("organizations:release-comparison-performance", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # enable new release set_commits functionality
    manager.add("organizations:set-commits-updated", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable playing replays from the replay tab
    manager.add("organizations:replay-play-from-replay-tab", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable version 2 of reprocessing (completely distinct from v1)
    manager.add("organizations:reprocessing-v2", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable Sentry's 2024 Rollback feature
    manager.add("organizations:sentry-rollback-2024", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Sentry's 2024 Rollback toggle within organization settings
    manager.add("organizations:sentry-rollback-settings", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable resolve in upcoming release
    # TODO(steve): Remove when we remove the feature from the UI
    manager.add("organizations:resolve-in-upcoming-release", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=True)
    # Enable post create/edit rule confirmation notifications
    manager.add("organizations:rule-create-edit-confirm-notification", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    manager.add("organizations:sandbox-kill-switch", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable team member role provisioning through scim
    manager.add("organizations:scim-team-roles", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable detecting SDK crashes during event processing
    manager.add("organizations:sdk-crash-detection", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable combined envelope Kafka items in Relay
    manager.add("organizations:session-replay-combined-envelope-items", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable canvas recording
    manager.add("organizations:session-replay-enable-canvas", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable canvas replaying
    manager.add("organizations:session-replay-enable-canvas-replayer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable linking from 'new issue' email notifs to the issue replay list
    manager.add("organizations:session-replay-issue-emails", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable mobile replay player
    manager.add("organizations:session-replay-mobile-player", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Disable select orgs from ingesting mobile replay events.
    manager.add("organizations:session-replay-video-disabled", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable replay player timeline gaps
    manager.add("organizations:session-replay-timeline-gap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable the new event linking columns to be queried
    manager.add("organizations:session-replay-new-event-counts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable a reduced timeout when waiting for the DOM, before reporting Rage and Dead clicks
    manager.add("organizations:session-replay-dead-click-reduced-timeout", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=False)
    # Enable data scrubbing of replay recording payloads in Relay.
    manager.add("organizations:session-replay-recording-scrubbing", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable core Session Replay SDK for recording on sentry.io
    manager.add("organizations:session-replay-sdk", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable core Session Replay SDK for recording onError events on sentry.io
    manager.add("organizations:session-replay-sdk-errors-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable linking from 'new issue' slack notifs to the issue replay list
    manager.add("organizations:session-replay-slack-new-issue", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable core Session Replay link in the sidebar
    manager.add("organizations:session-replay-ui", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable replay web vital breadcrumbs
    manager.add("organizations:session-replay-web-vitals", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable GA banner for mobile replay beta orgs about the grace period that will last 2 months. Flag can be removed after March 7th 2024.
    manager.add("organizations:mobile-replay-beta-orgs", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Enable Dev Toolbar frontend features (ex project settings page)
    manager.add("organizations:dev-toolbar-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, default=False, api_expose=True)
    # Lets organizations manage grouping configs
    manager.add("organizations:set-grouping-config", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable description field in Slack metric alerts
    manager.add("organizations:slack-metric-alert-description", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Add regression chart as image to slack message
    manager.add("organizations:slack-endpoint-regression-image", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    manager.add("organizations:slack-function-regression-image", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    manager.add("organizations:stacktrace-processing-caching", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable SAML2 Single-logout
    manager.add("organizations:sso-saml2-slo", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    # Enable access to insights region filter in the UI
    manager.add("organizations:insights-region-filter", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Show links and upsells to Insights modules
    manager.add("organizations:insights-entry-points", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable access to initial Insights modules (Queries, Requests, Vitals, App Starts, Page Loads, Resources)
    manager.add("organizations:insights-initial-modules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Enable access to newer Insights modules (Caches, Queues, LLMs, Mobile UI)
    manager.add("organizations:insights-addon-modules", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Make insights modules restrict queries to 14 days
    manager.add("organizations:insights-query-date-range-limit", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Make Insights modules use EAP instead of metrics
    manager.add("organizations:insights-use-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to insights metrics alerts
    manager.add("organizations:insights-alerts", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable Related Issues table in Insights modules
    manager.add("organizations:insights-related-issues-table", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to Mobile Screens insights module
    manager.add("organizations:insights-mobile-screens-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to insights crons view (moved from crons sidebar)
    manager.add("organizations:insights-crons", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable access to insights uptime view
    manager.add("organizations:insights-uptime", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable standalone span ingestion
    manager.add("organizations:standalone-span-ingestion", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable the aggregate span waterfall view
    manager.add("organizations:starfish-aggregate-span-waterfall", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the resource module ui
    manager.add("organizations:starfish-browser-resource-module-image-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables the resource module ui
    manager.add("organizations:starfish-browser-resource-module-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable mobile starfish app start module view
    manager.add("organizations:starfish-mobile-appstart", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable mobile starfish ui module view
    manager.add("organizations:starfish-mobile-ui-module", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable starfish endpoint that's used for regressing testing purposes
    manager.add("organizations:starfish-test-endpoint", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable the new experimental starfish view
    manager.add("organizations:starfish-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable UI for regression issues RCA using spans data
    manager.add("organizations:statistical-detectors-rca-spans-only", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable starfish dropdown on the webservice view for switching chart visualization
    manager.add("organizations:starfish-wsv-chart-dropdown", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Allow organizations to configure all symbol sources.
    manager.add("organizations:symbol-sources", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)
    # Enable static ClickHouse sampling for `OrganizationTagsEndpoint`
    manager.add("organizations:tag-key-sample-n", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable team workflow notifications
    manager.add("organizations:team-workflow-notifications", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable feature to load more than 100 rows in performance trace view.
    manager.add("organizations:trace-view-load-more", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new trace view.
    manager.add("organizations:trace-view-v1", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new trace view ui improvements
    manager.add("organizations:trace-view-new-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load new trace view in replay trace tab.
    manager.add("organizations:replay-trace-view-v1", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to load quota exceeded banner in new trace view.
    manager.add("organizations:trace-view-quota-exceeded-banner", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable feature to use span only trace endpoint.
    manager.add("organizations:trace-spans-format", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Extraction metrics for transactions during ingestion.
    manager.add("organizations:transaction-metrics-extraction", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Mark URL transactions scrubbed by regex patterns as "sanitized".
    # NOTE: This flag does not concern transactions rewritten by clusterer rules.
    # Those are always marked as "sanitized".
    manager.add("organizations:transaction-name-mark-scrubbed-as-sanitized", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Normalize URL transaction names during ingestion.
    manager.add("organizations:transaction-name-normalize", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Sanitize transaction names in the ingestion pipeline. # Deprecated
    manager.add("organizations:transaction-name-sanitization", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enables automatic hostname detection in uptime
    manager.add("organizations:uptime-automatic-hostname-detection", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables automatic subscription creation in uptime
    manager.add("organizations:uptime-automatic-subscription-creation", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable creating issues via the issue platform
    manager.add("organizations:uptime-create-issues", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables uptime related settings for projects and orgs
    manager.add('organizations:uptime-settings', OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    manager.add("organizations:use-metrics-layer", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Use ReplayClipPreview inside the User Feedback Details panel
    manager.add("organizations:user-feedback-replay-clip", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable User Feedback spam auto filtering feature ingest
    manager.add("organizations:user-feedback-spam-filter-ingest", OrganizationFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable User Feedback spam auto filtering feature actions
    manager.add("organizations:user-feedback-spam-filter-actions", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    # Enable User Feedback v2 UI
    manager.add("organizations:user-feedback-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # User Feedback Error Link Ingestion Changes
    manager.add("organizations:user-feedback-event-link-ingestion-changes", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    # Enable display of a trace data section in feedback details
    manager.add("organizations:user-feedback-trace-section", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable view hierarchies options
    manager.add("organizations:view-hierarchies-options-dev", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable admin features on the new explore page
    manager.add("organizations:visibility-explore-admin", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the new explore page
    manager.add("organizations:visibility-explore-view", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable the dataset toggle on the new explore page
    manager.add("organizations:visibility-explore-dataset", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable RPC on the new explore page
    manager.add("organizations:visibility-explore-rpc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enabled unresolved issue webhook for organization
    manager.add("organizations:webhooks-unresolved", OrganizationFeature, FeatureHandlerStrategy.OPTIONS, api_expose=True)
    # Enable dual writing for metric alert issues (see: alerts create issues)
    manager.add("organizations:workflow-engine-metric-alert-dual-write", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable Processing for Metric Alerts in the workflow_engine
    manager.add("organizations:workflow-engine-metric-alert-processing", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable reading from new ACI tables for metric alert issues (see: alerts create issues)
    manager.add("organizations:workflow-engine-metric-alert-read", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable new workflow_engine UI (see: alerts create issues)
    manager.add("organizations:workflow-engine-ui", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Enable EventUniqueUserFrequencyConditionWithConditions special alert condition
    manager.add("organizations:event-unique-user-frequency-condition-with-conditions", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Use spans instead of transactions for dynamic sampling calculations. This will become the new default.
    manager.add("organizations:dynamic-sampling-spans", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enable tagging span with whether or not we should ingest it in the EAP
    manager.add("organizations:ingest-spans-in-eap", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # Enables EAP alerts UI use RPC
    manager.add("organizations:eap-alerts-ui-uses-rpc", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)
    # Test flag for flagpole region checking
    manager.add("organizations:validate-region-test-flag", OrganizationFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=True)

    # NOTE: Don't add features down here! Add them to their specific group and sort
    #       them alphabetically! The order features are registered is not important.

    # Project scoped features #
    ###########################
    # Enable AI Autofix feture on the Issue Details page.
    manager.add("projects:ai-autofix", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Adds additional filters and a new section to issue alert rules.
    manager.add("projects:alert-filters", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True)
    manager.add("projects:discard-transaction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable calculating a severity score for events which create a new group
    manager.add("projects:first-event-severity-calculation", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    # Enable escalation detection for new issues
    manager.add("projects:first-event-severity-new-escalation", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enable alternative version of group creation that is supposed to be less racy.
    manager.add("projects:race-free-group-creation", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=False)
    # Enable similarity embeddings API call
    # This feature is only available on the frontend using project details since the handler gets
    # project options and this is slow in the project index endpoint feature flag serialization
    manager.add("projects:similarity-embeddings", ProjectFeature, FeatureHandlerStrategy.INTERNAL, default=False, api_expose=True)
    manager.add("projects:similarity-embeddings-delete-by-hash", ProjectFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    manager.add("projects:similarity-indexing", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:similarity-view", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    # Starfish: extract metrics from the spans
    manager.add("projects:span-metrics-extraction", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=True)
    manager.add("projects:span-metrics-extraction-addons", ProjectFeature, FeatureHandlerStrategy.INTERNAL, api_expose=False)
    manager.add("projects:relay-otel-endpoint", ProjectFeature, FeatureHandlerStrategy.OPTIONS, api_expose=False)
    # EAP: extremely experimental flag that makes DDM page use EAP tables
    manager.add("projects:use-eap-spans-for-metrics-explorer", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)

    # Project plugin features
    manager.add("projects:plugins", ProjectPluginFeature, FeatureHandlerStrategy.INTERNAL, default=True, api_expose=True)

    manager.add("projects:profiling-ingest-unsampled-profiles", ProjectFeature, FeatureHandlerStrategy.FLAGPOLE, api_expose=False)
    # fmt: on

    # Feature flags
    manager.add(
        "organizations:feature-flag-audit-log",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=True,
    )
    manager.add(
        "organizations:feature-flag-ui",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=True,
    )
    manager.add(
        "organizations:feature-flag-cta",
        OrganizationFeature,
        FeatureHandlerStrategy.FLAGPOLE,
        api_expose=True,
    )

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
