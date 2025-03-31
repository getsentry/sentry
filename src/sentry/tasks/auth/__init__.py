from sentry.taskworker.registry import taskregistry

auth_tasks = taskregistry.create_namespace("auth")
auth_control_tasks = taskregistry.create_namespace("auth.control")
