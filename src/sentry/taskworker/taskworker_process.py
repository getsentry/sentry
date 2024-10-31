from django.conf import settings

from sentry.taskworker.registry import taskregistry


def _process_activation(namespace, task_name, args, kwargs):
    for module in settings.TASKWORKER_IMPORTS:
        __import__(module)

    taskregistry.get(namespace).get(task_name)(*args, **kwargs)
