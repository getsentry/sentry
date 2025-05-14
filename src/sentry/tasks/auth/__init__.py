from sentry.taskworker.registry import TaskNamespace, taskregistry

auth_tasks: TaskNamespace = taskregistry.create_namespace("auth")
auth_control_tasks: TaskNamespace = taskregistry.create_namespace("auth.control")
