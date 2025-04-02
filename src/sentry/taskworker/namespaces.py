from sentry.taskworker.registry import taskregistry

# Namespaces for taskworker tasks
auth_tasks = taskregistry.create_namespace("auth")

auth_control_tasks = taskregistry.create_namespace("auth.control")

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

options_tasks = taskregistry.create_namespace("options")

options_control_tasks = taskregistry.create_namespace("options.control")

sdk_tasks = taskregistry.create_namespace("sdk")

sdk_control_tasks = taskregistry.create_namespace("sdk.control")

tempest_tasks = taskregistry.create_namespace("tempest")


# Namespaces for testing taskworker tasks
exampletasks = taskregistry.create_namespace(name="examples")
