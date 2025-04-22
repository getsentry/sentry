from sentry.taskworker.registry import taskregistry

# Namespaces for taskworker tasks
alerts_tasks = taskregistry.create_namespace("alerts")

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

hybridcloud_tasks = taskregistry.create_namespace("hybridcloud")

hybridcloud_control_tasks = taskregistry.create_namespace("hybridcloud.control")

notifications_tasks = taskregistry.create_namespace("notifications")

notifications_control_tasks = taskregistry.create_namespace("notifications.control")

integrations_tasks = taskregistry.create_namespace("integrations")

integrations_control_tasks = taskregistry.create_namespace("integrations.control")

options_tasks = taskregistry.create_namespace("options")

options_control_tasks = taskregistry.create_namespace("options.control")

replays_tasks = taskregistry.create_namespace("replays")

sdk_tasks = taskregistry.create_namespace("sdk")

sdk_control_tasks = taskregistry.create_namespace("sdk.control")

seer_tasks = taskregistry.create_namespace("seer")

selfhosted_tasks = taskregistry.create_namespace("selfhosted")

tempest_tasks = taskregistry.create_namespace("tempest")

uptime_tasks = taskregistry.create_namespace("uptime")

relocation_tasks = taskregistry.create_namespace("relocation")
relocation_control_tasks = taskregistry.create_namespace("relocation.control")

# Namespaces for testing taskworker tasks
exampletasks = taskregistry.create_namespace(name="examples")
