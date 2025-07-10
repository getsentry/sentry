from sentry.taskworker.registry import taskregistry

# Namespaces for taskworker tasks
alerts_tasks = taskregistry.create_namespace("alerts", app_feature="shared")

attachments_tasks = taskregistry.create_namespace(
    "attachments",
    app_feature="attachments",
)

auth_tasks = taskregistry.create_namespace("auth", app_feature="shared")

auth_control_tasks = taskregistry.create_namespace(
    "auth.control",
    app_feature="shared",
)

buffer_tasks = taskregistry.create_namespace("buffer", app_feature="errors")

crons_tasks = taskregistry.create_namespace("crons", app_feature="crons")

deletion_tasks = taskregistry.create_namespace(
    "deletions",
    processing_deadline_duration=60 * 4,
    app_feature="shared",
)

deletion_control_tasks = taskregistry.create_namespace(
    "deletions.control",
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 4,
    app_feature="shared",
)

demomode_tasks = taskregistry.create_namespace("demomode", app_feature="shared")

ai_agent_monitoring_tasks = taskregistry.create_namespace(
    "ai_agent_monitoring", app_feature="ai_agent_monitoring"
)

digests_tasks = taskregistry.create_namespace("digests", app_feature="shared")

export_tasks = taskregistry.create_namespace(
    name="export",
    processing_deadline_duration=15,
    app_feature="shared",
)

hybridcloud_tasks = taskregistry.create_namespace(
    "hybridcloud",
    app_feature="hybrid_cloud",
)

hybridcloud_control_tasks = taskregistry.create_namespace(
    "hybridcloud.control",
    app_feature="hybrid_cloud",
)

ingest_profiling_tasks = taskregistry.create_namespace(
    "ingest.profiling",
    app_feature="profiles",
)

ingest_transactions_tasks = taskregistry.create_namespace(
    "ingest.transactions",
    app_feature="transactions",
)

ingest_attachments_tasks = taskregistry.create_namespace(
    "ingest.attachments", app_feature="attachments"
)

ingest_errors_tasks = taskregistry.create_namespace("ingest.errors", app_feature="errors")

issues_tasks = taskregistry.create_namespace("issues", app_feature="issueplatform")

integrations_tasks = taskregistry.create_namespace("integrations", app_feature="integrations")

integrations_control_tasks = taskregistry.create_namespace(
    "integrations.control",
    app_feature="integrations",
)

notifications_tasks = taskregistry.create_namespace("notifications", app_feature="shared")

notifications_control_tasks = taskregistry.create_namespace(
    "notifications.control",
    app_feature="shared",
)

options_tasks = taskregistry.create_namespace("options", app_feature="shared")

options_control_tasks = taskregistry.create_namespace(
    "options.control",
    app_feature="shared",
)

performance_tasks = taskregistry.create_namespace("performance", app_feature="transactions")

profiling_tasks = taskregistry.create_namespace("profiling", app_feature="profiles")

relay_tasks = taskregistry.create_namespace("relay", app_feature="shared")

relocation_tasks = taskregistry.create_namespace("relocation", app_feature="infra")

relocation_control_tasks = taskregistry.create_namespace("relocation.control", app_feature="infra")

release_health_tasks = taskregistry.create_namespace("releasehealth", app_feature="sessions")

replays_tasks = taskregistry.create_namespace("replays", app_feature="replays")

reports_tasks = taskregistry.create_namespace("reports", app_feature="shared")

sdk_tasks = taskregistry.create_namespace("sdk", app_feature="shared")

sdk_control_tasks = taskregistry.create_namespace("sdk.control", app_feature="shared")

seer_tasks = taskregistry.create_namespace("seer", app_feature="errors")

selfhosted_tasks = taskregistry.create_namespace("selfhosted", app_feature="shared")

sentryapp_tasks = taskregistry.create_namespace("sentryapp", app_feature="integrations")

sentryapp_control_tasks = taskregistry.create_namespace(
    "sentryapp.control", app_feature="integrations"
)

symbolication_tasks = taskregistry.create_namespace("symbolication", app_feature="errors")

telemetry_experience_tasks = taskregistry.create_namespace(
    "telemetry-experience", app_feature="transactions"
)

tempest_tasks = taskregistry.create_namespace("tempest", app_feature="errors")

uptime_tasks = taskregistry.create_namespace("uptime", app_feature="crons")

workflow_engine_tasks = taskregistry.create_namespace(
    "workflow_engine", app_feature="workflow_engine"
)


# Namespaces for testing taskworker tasks
exampletasks = taskregistry.create_namespace(name="examples")
test_tasks = taskregistry.create_namespace(name="test")
