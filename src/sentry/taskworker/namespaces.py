from __future__ import annotations

import datetime

from taskbroker_client.constants import DEFAULT_PROCESSING_DEADLINE
from taskbroker_client.registry import TaskNamespace
from taskbroker_client.retry import Retry

from sentry.owners import Owner
from sentry.taskworker.runtime import app

_namespace_owners: dict[str, Owner] = {}


def create_namespace(
    name: str,
    *,
    owner: Owner,
    retry: Retry | None = None,
    expires: int | datetime.timedelta | None = None,
    processing_deadline_duration: int = DEFAULT_PROCESSING_DEADLINE,
    app_feature: str | None = None,
    is_raw_mode: bool = False,
) -> TaskNamespace:
    """
    Create a task namespace owned by `owner`.

    Tasks in the namespace inherit the owner unless they set their own; see
    `instrumented_task`. The other parameters are those of
    `TaskRegistry.create_namespace`.
    """
    namespace = app.taskregistry.create_namespace(
        name,
        retry=retry,
        expires=expires,
        processing_deadline_duration=processing_deadline_duration,
        app_feature=app_feature,
        is_raw_mode=is_raw_mode,
    )
    _namespace_owners[namespace.name] = owner
    return namespace


def namespace_owner(namespace: TaskNamespace) -> Owner:
    """
    The owner of a namespace. A namespace created outside this module, such as
    one from getsentry, is unowned.
    """
    return _namespace_owners.get(namespace.name, Owner.UNOWNED)


# Namespaces for taskworker tasks
alerts_tasks = create_namespace(
    "alerts",
    owner=Owner.ALERTS_MONITORS,
    app_feature="shared",
)

attachments_tasks = create_namespace(
    "attachments",
    owner=Owner.OWNERS_INGEST,
    app_feature="attachments",
)

auth_tasks = create_namespace(
    "auth",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

auth_control_tasks = create_namespace(
    "auth.control",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

buffer_tasks = create_namespace(
    "buffer",
    owner=Owner.COMMUNITY,
    app_feature="errors",
)

conduit_tasks = create_namespace(
    "conduit",
    owner=Owner.INFRA_ENG,
    app_feature="conduit",
)

crons_tasks = create_namespace(
    "crons",
    owner=Owner.CRONS,
    app_feature="crons",
)

deletion_tasks = create_namespace(
    "deletions",
    owner=Owner.COMMUNITY,
    processing_deadline_duration=60 * 20,
    app_feature="shared",
)

deletion_control_tasks = create_namespace(
    "deletions.control",
    owner=Owner.COMMUNITY,
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 4,
    app_feature="shared",
)

demomode_tasks = create_namespace(
    "demomode",
    owner=Owner.UNOWNED,
    app_feature="shared",
)

ai_agent_monitoring_tasks = create_namespace(
    "ai_agent_monitoring",
    owner=Owner.TELEMETRY_EXPERIENCE,
    app_feature="ai_agent_monitoring",
)

digests_tasks = create_namespace(
    "digests",
    owner=Owner.NOTIFICATIONS,
    app_feature="shared",
)

debug_files_migration_tasks = create_namespace(
    "debug-files-migration",
    owner=Owner.OWNERS_INGEST,
    app_feature="debug_files",
)

export_tasks = create_namespace(
    "export",
    owner=Owner.DATA_BROWSING,
    processing_deadline_duration=15,
    app_feature="shared",
)

hybridcloud_tasks = create_namespace(
    "hybridcloud",
    owner=Owner.HYBRID_CLOUD,
    app_feature="hybrid_cloud",
)

hybridcloud_control_tasks = create_namespace(
    "hybridcloud.control",
    owner=Owner.HYBRID_CLOUD,
    app_feature="hybrid_cloud",
)

# TODO(STREAM-1191): remove once infra has fully migrated to
# ingest_profiling_raw_tasks below.
ingest_profiling_passthrough_tasks = create_namespace(
    "ingest.profiling.passthrough",
    owner=Owner.PROFILING,
    app_feature="profiles",
)

ingest_profiling_raw_tasks = create_namespace(
    "ingest.profiling.raw",
    owner=Owner.PROFILING,
    app_feature="profiles",
    is_raw_mode=True,
)

ingest_transactions_tasks = create_namespace(
    "ingest.transactions",
    owner=Owner.OWNERS_INGEST,
    app_feature="transactions",
)

spans_process_segments_tasks = create_namespace(
    "spans.process_segments",
    owner=Owner.STREAMING_PLATFORM,
    app_feature="spans",
)

ingest_attachments_tasks = create_namespace(
    "ingest.attachments",
    owner=Owner.OWNERS_INGEST,
    app_feature="attachments",
)

ingest_events_raw_tasks = create_namespace(
    "ingest.events.raw",
    owner=Owner.OWNERS_INGEST,
    app_feature="errors",
    is_raw_mode=True,
)

ingest_errors_tasks = create_namespace(
    "ingest.errors",
    owner=Owner.OWNERS_INGEST,
    app_feature="errors",
)

ingest_errors_postprocess_tasks = create_namespace(
    "ingest.errors.postprocess",
    owner=Owner.ISSUE_DETECTION_BACKEND,
    app_feature="errors",
)

snuba_events_subscriptions_raw_tasks = create_namespace(
    "snuba.subscriptions.events.raw",
    owner=Owner.ALERTS_MONITORS,
    app_feature="errors",
    is_raw_mode=True,
)

snuba_transactions_subscriptions_raw_tasks = create_namespace(
    "snuba.subscriptions.transactions.raw",
    owner=Owner.ALERTS_MONITORS,
    app_feature="transactions",
    is_raw_mode=True,
)

snuba_metrics_subscriptions_raw_tasks = create_namespace(
    "snuba.subscriptions.metrics.raw",
    owner=Owner.ALERTS_MONITORS,
    app_feature="sessions",
    is_raw_mode=True,
)

snuba_eap_subscriptions_raw_tasks = create_namespace(
    "snuba.subscriptions.eap.raw",
    owner=Owner.ALERTS_MONITORS,
    app_feature="transactions",
    is_raw_mode=True,
)

issues_tasks = create_namespace(
    "issues",
    owner=Owner.ISSUE_DETECTION_BACKEND,
    app_feature="issueplatform",
)

issues_action_log_tasks = create_namespace(
    "issues.action_log",
    owner=Owner.ISSUE_DETECTION_BACKEND,
    app_feature="issueplatform",
)

issues_merge_tasks = create_namespace(
    "issues.merge",
    owner=Owner.ISSUE_DETECTION_BACKEND,
    app_feature="issueplatform",
)

issues_reprocessing_tasks = create_namespace(
    "issues.reprocessing",
    owner=Owner.OWNERS_INGEST,
    app_feature="issueplatform",
)

issues_long_tasks = create_namespace(
    "issues.long",
    owner=Owner.ISSUE_DETECTION_BACKEND,
    app_feature="issueplatform",
)

integrations_tasks = create_namespace(
    "integrations",
    owner=Owner.INTEGRATION_PLATFORM,
    app_feature="integrations",
)

integrations_control_tasks = create_namespace(
    "integrations.control",
    owner=Owner.INTEGRATION_PLATFORM,
    app_feature="integrations",
)

integrations_control_throttled_tasks = create_namespace(
    "integrations.control.throttled",
    owner=Owner.INTEGRATION_PLATFORM,
    app_feature="integrations",
)

notifications_tasks = create_namespace(
    "notifications",
    owner=Owner.NOTIFICATIONS,
    app_feature="shared",
)

notifications_control_tasks = create_namespace(
    "notifications.control",
    owner=Owner.NOTIFICATIONS,
    app_feature="shared",
)

options_tasks = create_namespace(
    "options",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

options_control_tasks = create_namespace(
    "options.control",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

performance_tasks = create_namespace(
    "performance",
    owner=Owner.DATA_BROWSING,
    app_feature="transactions",
)

preprod_size_tasks = create_namespace(
    "preprod.size",
    owner=Owner.EMERGE_TOOLS,
    app_feature="preprod_size",
)

preprod_snapshots_tasks = create_namespace(
    "preprod.snapshots",
    owner=Owner.EMERGE_TOOLS,
    app_feature="preprod_snapshots",
)

profiling_tasks = create_namespace(
    "profiling",
    owner=Owner.PROFILING,
    app_feature="profiles",
)

relay_tasks = create_namespace(
    "relay",
    owner=Owner.OWNERS_INGEST,
    app_feature="shared",
)
# Namespace used for lower priority project config invalidations.
#
# Project configs requested by Relay must be computed as soon as possible to serve traffic,
# invalidations can be slightly delayed.
relay_invalidation_tasks = create_namespace(
    "relay.invalidation",
    owner=Owner.OWNERS_INGEST,
    app_feature="shared",
)

relocation_tasks = create_namespace(
    "relocation",
    owner=Owner.HYBRID_CLOUD,
    app_feature="infra",
)

relocation_control_tasks = create_namespace(
    "relocation.control",
    owner=Owner.HYBRID_CLOUD,
    app_feature="infra",
)

release_health_tasks = create_namespace(
    "releasehealth",
    owner=Owner.UNOWNED,
    app_feature="sessions",
)

replays_tasks = create_namespace(
    "replays",
    owner=Owner.REPLAY,
    app_feature="replays",
)

replays_long_tasks = create_namespace(
    "replays.long",
    owner=Owner.REPLAY,
    app_feature="replays",
)

# Dedicated namespace for the raw ingest-replay-recordings topic, consumed by
# taskbroker in "raw mode" (one raw topic maps 1:1 to a namespace).
replays_raw_tasks = create_namespace(
    "replays.raw",
    owner=Owner.REPLAY,
    app_feature="replays",
    is_raw_mode=True,
)

reports_tasks = create_namespace(
    "reports",
    owner=Owner.NOTIFICATIONS,
    app_feature="shared",
)

scm_tasks = create_namespace(
    "scm",
    owner=Owner.SCM,
    app_feature="scm",
)

sdk_tasks = create_namespace(
    "sdk",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

sdk_control_tasks = create_namespace(
    "sdk.control",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

seer_tasks = create_namespace(
    "seer",
    owner=Owner.ML_AI,
    app_feature="errors",
)

seer_code_review_tasks = create_namespace(
    "seer.code_review",
    owner=Owner.CODING_WORKFLOWS,
    app_feature="code-review",
)

selfhosted_tasks = create_namespace(
    "selfhosted",
    owner=Owner.COMMUNITY,
    app_feature="shared",
)

sentryapp_tasks = create_namespace(
    "sentryapp",
    owner=Owner.INTEGRATION_PLATFORM,
    app_feature="integrations",
)

sentryapp_control_tasks = create_namespace(
    "sentryapp.control",
    owner=Owner.INTEGRATION_PLATFORM,
    app_feature="integrations",
)

symbolication_tasks = create_namespace(
    "symbolication",
    owner=Owner.OWNERS_INGEST,
    app_feature="errors",
)

symbolication_js_tasks = create_namespace(
    "symbolication.js",
    owner=Owner.OWNERS_INGEST,
    app_feature="errors",
)

symbolication_jvm_tasks = create_namespace(
    "symbolication.jvm",
    owner=Owner.OWNERS_INGEST,
    app_feature="errors",
)

# GPU crash symbolication (teapot), isolated from `symbolication` so a slow
# teapot can't back up the native CPU symbolication queue.
gpu_crash_dump_tasks = create_namespace(
    "gpu.crash_dump",
    owner=Owner.COMMUNITY,
    app_feature="errors",
)

telemetry_experience_tasks = create_namespace(
    "telemetry-experience",
    owner=Owner.TELEMETRY_EXPERIENCE,
    app_feature="transactions",
)


tempest_tasks = create_namespace(
    "tempest",
    owner=Owner.GDX,
    app_feature="errors",
)

uptime_tasks = create_namespace(
    "uptime",
    owner=Owner.CRONS,
    app_feature="crons",
)

workflow_engine_tasks = create_namespace(
    "workflow_engine",
    owner=Owner.ALERTS_MONITORS,
    app_feature="workflow_engine",
)


# External namespaces for tasks belonging to other applications
launchpad_tasks = app.create_external_namespace(name="default", application="launchpad")

# Namespaces for testing taskworker tasks
exampletasks = create_namespace("examples", owner=Owner.UNOWNED)
test_tasks = create_namespace("test", owner=Owner.UNOWNED)
