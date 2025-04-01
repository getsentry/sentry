from sentry.taskworker.registry import TaskNamespace, taskregistry

relocation_tasks: TaskNamespace = taskregistry.create_namespace("relocation")
relocation_control_tasks: TaskNamespace = taskregistry.create_namespace("relocation.control")
