from __future__ import annotations

from sentry.taskworker.runtime import app

# Namespaces for taskworker tasks
alerts_tasks = app.taskregistry.create_namespace(
    "alerts",
    app_feature="shared",
)

attachments_tasks = app.taskregistry.create_namespace(
    "attachments",
    app_feature="attachments",
)

auth_tasks = app.taskregistry.create_namespace(
    "auth",
    app_feature="shared",
)

auth_control_tasks = app.taskregistry.create_namespace(
    "auth.control",
    app_feature="shared",
)

buffer_tasks = app.taskregistry.create_namespace(
    "buffer",
    app_feature="errors",
)

conduit_tasks = app.taskregistry.create_namespace(
    "conduit",
    app_feature="conduit",
)

crons_tasks = app.taskregistry.create_namespace(
    "crons",
    app_feature="crons",
)

deletion_tasks = app.taskregistry.create_namespace(
    "deletions",
    processing_deadline_duration=60 * 20,
    app_feature="shared",
)

deletion_control_tasks = app.taskregistry.create_namespace(
    "deletions.control",
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 4,
    app_feature="shared",
)

demomode_tasks = app.taskregistry.create_namespace(
    "demomode",
    app_feature="shared",
)

ai_agent_monitoring_tasks = app.taskregistry.create_namespace(
    "ai_agent_monitoring",
    app_feature="ai_agent_monitoring",
)

digests_tasks = app.taskregistry.create_namespace(
    "digests",
    app_feature="shared",
)

export_tasks = app.taskregistry.create_namespace(
    name="export",
    processing_deadline_duration=15,
    app_feature="shared",
)

hybridcloud_tasks = app.taskregistry.create_namespace(
    "hybridcloud",
    app_feature="hybrid_cloud",
)

hybridcloud_control_tasks = app.taskregistry.create_namespace(
    "hybridcloud.control",
    app_feature="hybrid_cloud",
)

# TODO(STREAM-1191): remove once infra has fully migrated to
# ingest_profiling_raw_tasks below.
ingest_profiling_passthrough_tasks = app.taskregistry.create_namespace(
    "ingest.profiling.passthrough",
    app_feature="profiles",
)

ingest_profiling_raw_tasks = app.taskregistry.create_namespace(
    "ingest.profiling.raw",
    app_feature="profiles",
)

ingest_transactions_tasks = app.taskregistry.create_namespace(
    "ingest.transactions",
    app_feature="transactions",
)

spans_process_segments_tasks = app.taskregistry.create_namespace(
    "spans.process_segments",
    app_feature="spans",
)

ingest_attachments_tasks = app.taskregistry.create_namespace(
    "ingest.attachments",
    app_feature="attachments",
)

ingest_events_raw_tasks = app.taskregistry.create_namespace(
    "ingest.events.raw",
    app_feature="errors",
)

ingest_errors_tasks = app.taskregistry.create_namespace(
    "ingest.errors",
    app_feature="errors",
)

ingest_errors_postprocess_tasks = app.taskregistry.create_namespace(
    "ingest.errors.postprocess",
    app_feature="errors",
)

snuba_events_subscriptions_raw_tasks = app.taskregistry.create_namespace(
    "snuba.subscriptions.events.raw",
    app_feature="errors",
)

snuba_transactions_subscriptions_raw_tasks = app.taskregistry.create_namespace(
    "snuba.subscriptions.transactions.raw",
    app_feature="transactions",
)

snuba_metrics_subscriptions_raw_tasks = app.taskregistry.create_namespace(
    "snuba.subscriptions.metrics.raw",
    app_feature="sessions",
)

snuba_generic_metrics_subscriptions_raw_tasks = app.taskregistry.create_namespace(
    "snuba.subscriptions.generic_metrics.raw",
    app_feature="transactions",
)

snuba_eap_subscriptions_raw_tasks = app.taskregistry.create_namespace(
    "snuba.subscriptions.eap.raw",
    app_feature="transactions",
)

issues_tasks = app.taskregistry.create_namespace(
    "issues",
    app_feature="issueplatform",
)

issues_merge_tasks = app.taskregistry.create_namespace(
    "issues.merge",
    app_feature="issueplatform",
)

integrations_tasks = app.taskregistry.create_namespace(
    "integrations",
    app_feature="integrations",
)

integrations_control_tasks = app.taskregistry.create_namespace(
    "integrations.control",
    app_feature="integrations",
)

integrations_control_throttled_tasks = app.taskregistry.create_namespace(
    "integrations.control.throttled",
    app_feature="integrations",
)

notifications_tasks = app.taskregistry.create_namespace(
    "notifications",
    app_feature="shared",
)

notifications_control_tasks = app.taskregistry.create_namespace(
    "notifications.control",
    app_feature="shared",
)

options_tasks = app.taskregistry.create_namespace(
    "options",
    app_feature="shared",
)

options_control_tasks = app.taskregistry.create_namespace(
    "options.control",
    app_feature="shared",
)

performance_tasks = app.taskregistry.create_namespace(
    "performance",
    app_feature="transactions",
)

preprod_tasks = app.taskregistry.create_namespace(
    "preprod",
    app_feature="preprod",
)

profiling_tasks = app.taskregistry.create_namespace(
    "profiling",
    app_feature="profiles",
)

relay_tasks = app.taskregistry.create_namespace(
    "relay",
    app_feature="shared",
)

relocation_tasks = app.taskregistry.create_namespace(
    "relocation",
    app_feature="infra",
)

relocation_control_tasks = app.taskregistry.create_namespace(
    "relocation.control",
    app_feature="infra",
)

release_health_tasks = app.taskregistry.create_namespace(
    "releasehealth",
    app_feature="sessions",
)

replays_tasks = app.taskregistry.create_namespace(
    "replays",
    app_feature="replays",
)

# Dedicated namespace for the raw ingest-replay-recordings topic, consumed by
# taskbroker in "raw mode" (one raw topic maps 1:1 to a namespace).
replays_raw_tasks = app.taskregistry.create_namespace(
    "replays.raw",
    app_feature="replays",
)

reports_tasks = app.taskregistry.create_namespace(
    "reports",
    app_feature="shared",
)

scm_tasks = app.taskregistry.create_namespace(
    "scm",
    app_feature="scm",
)

sdk_tasks = app.taskregistry.create_namespace(
    "sdk",
    app_feature="shared",
)

sdk_control_tasks = app.taskregistry.create_namespace(
    "sdk.control",
    app_feature="shared",
)

seer_tasks = app.taskregistry.create_namespace(
    "seer",
    app_feature="errors",
)

seer_code_review_tasks = app.taskregistry.create_namespace(
    "seer.code_review",
    app_feature="code-review",
)

selfhosted_tasks = app.taskregistry.create_namespace(
    "selfhosted",
    app_feature="shared",
)

sentryapp_tasks = app.taskregistry.create_namespace(
    "sentryapp",
    app_feature="integrations",
)

sentryapp_control_tasks = app.taskregistry.create_namespace(
    "sentryapp.control",
    app_feature="integrations",
)

symbolication_tasks = app.taskregistry.create_namespace(
    "symbolication",
    app_feature="errors",
)

telemetry_experience_tasks = app.taskregistry.create_namespace(
    "telemetry-experience",
    app_feature="transactions",
)


tempest_tasks = app.taskregistry.create_namespace(
    "tempest",
    app_feature="errors",
)

uptime_tasks = app.taskregistry.create_namespace(
    "uptime",
    app_feature="crons",
)

workflow_engine_tasks = app.taskregistry.create_namespace(
    "workflow_engine",
    app_feature="workflow_engine",
)


# External namespaces for tasks belonging to other applications
launchpad_tasks = app.create_external_namespace(name="default", application="launchpad")

# Namespaces for testing taskworker tasks
exampletasks = app.taskregistry.create_namespace(name="examples")
test_tasks = app.taskregistry.create_namespace(name="test")
