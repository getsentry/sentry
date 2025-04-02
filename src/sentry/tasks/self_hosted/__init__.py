from sentry.taskworker.registry import TaskNamespace, taskregistry

selfhosted_tasks: TaskNamespace = taskregistry.create_namespace("selfhosted")
