from sentry.taskworker.registry import taskregistry

# Namespaces for taskworker tasks
alerts_tasks = taskregistry.create_namespace("alerts")

auth_tasks = taskregistry.create_namespace("auth")

auth_control_tasks = taskregistry.create_namespace("auth.control")

crons_tasks = taskregistry.create_namespace("crons")

deletion_tasks = taskregistry.create_namespace(
    "deletions",
    processing_deadline_duration=60 * 3,
)

deletion_control_tasks = taskregistry.create_namespace(
    "deletions.control",
    # Deletions can take several minutes, so we have a long processing deadline.
    processing_deadline_duration=60 * 3,
)

demomode_tasks = taskregistry.create_namespace("demomode")

digests_tasks = taskregistry.create_namespace("digests")

hybridcloud_tasks = taskregistry.create_namespace("hybridcloud")

hybridcloud_control_tasks = taskregistry.create_namespace("hybridcloud.control")

integrations_tasks = taskregistry.create_namespace("integrations")

integrations_control_tasks = taskregistry.create_namespace("integrations.control")

options_tasks = taskregistry.create_namespace("options")

options_control_tasks = taskregistry.create_namespace("options.control")

sdk_tasks = taskregistry.create_namespace("sdk")

sdk_control_tasks = taskregistry.create_namespace("sdk.control")

selfhosted_tasks = taskregistry.create_namespace("selfhosted")

tempest_tasks = taskregistry.create_namespace("tempest")

uptime_tasks = taskregistry.create_namespace("uptime")


# Namespaces for testing taskworker tasks
exampletasks = taskregistry.create_namespace(name="examples")
