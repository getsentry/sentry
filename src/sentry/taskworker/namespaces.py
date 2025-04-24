from sentry.taskworker.registry import taskregistry

# Namespaces for taskworker tasks
alerts_tasks = taskregistry.create_namespace("alerts")

attachments_tasks = taskregistry.create_namespace("attachments")

auth_tasks = taskregistry.create_namespace("auth")

auth_control_tasks = taskregistry.create_namespace("auth.control")

buffer_tasks = taskregistry.create_namespace("buffer")

crons_tasks = taskregistry.create_namespace("crons")

deletion_tasks = taskregistry.create_namespace(
    "deletions",
    processing_deadline_duration=60 * 4,
)

deletion_control_tasks = taskregistry.create_namespace(
    "deletions.control",
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 4,
)

demomode_tasks = taskregistry.create_namespace("demomode")

digests_tasks = taskregistry.create_namespace("digests")

export_tasks = taskregistry.create_namespace(name="export", processing_deadline_duration=15)

hybridcloud_tasks = taskregistry.create_namespace("hybridcloud")

hybridcloud_control_tasks = taskregistry.create_namespace("hybridcloud.control")

ingest_profiling_tasks = taskregistry.create_namespace("ingest.profiling")

issues_tasks = taskregistry.create_namespace("issues")

integrations_tasks = taskregistry.create_namespace("integrations")

integrations_control_tasks = taskregistry.create_namespace("integrations.control")

notifications_tasks = taskregistry.create_namespace("notifications")

notifications_control_tasks = taskregistry.create_namespace("notifications.control")

options_tasks = taskregistry.create_namespace("options")

options_control_tasks = taskregistry.create_namespace("options.control")

relay_tasks = taskregistry.create_namespace("relay")

performance_tasks = taskregistry.create_namespace("performance")

profiling_tasks = taskregistry.create_namespace("profiling")

relocation_tasks = taskregistry.create_namespace("relocation")

relocation_control_tasks = taskregistry.create_namespace("relocation.control")

release_health_tasks = taskregistry.create_namespace("releasehealth")

replays_tasks = taskregistry.create_namespace("replays")

reports_tasks = taskregistry.create_namespace("reports")

sdk_tasks = taskregistry.create_namespace("sdk")

sdk_control_tasks = taskregistry.create_namespace("sdk.control")

seer_tasks = taskregistry.create_namespace("seer")

selfhosted_tasks = taskregistry.create_namespace("selfhosted")

sentryapp_tasks = taskregistry.create_namespace("sentryapp")

sentryapp_control_tasks = taskregistry.create_namespace("sentryapp.control")

symbolication_tasks = taskregistry.create_namespace("symbolication")

telemetry_experience_tasks = taskregistry.create_namespace("telemetry-experience")

tempest_tasks = taskregistry.create_namespace("tempest")

uptime_tasks = taskregistry.create_namespace("uptime")


# Namespaces for testing taskworker tasks
exampletasks = taskregistry.create_namespace(name="examples")
