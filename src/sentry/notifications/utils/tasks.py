from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping

from django.apps import apps

from sentry.db.models import Model
from sentry.notifications.class_manager import NotificationClassNotSetException, get
from sentry.tasks.base import instrumented_task

if TYPE_CHECKING:
    from sentry.notifications.notifications.base import BaseNotification


# TODO: handle kwargs
def async_send_notification(NotificationClass: BaseNotification, *args: Iterable[Any]) -> None:
    """
    This function takes a notification class and arguments to instantiate
    the notification class in a task with the original arguments.
    It converts instances of models into a JSON object that allows us to query
    the rows inside the task so the interface is just simple JSON.
    """
    class_name = getattr(NotificationClass, "__name__")
    if not get(class_name):
        raise NotificationClassNotSetException()

    task_args = []
    for arg in args:
        if isinstance(arg, Model):
            meta = type(arg)._meta
            task_args.append(
                {
                    "type": "model",
                    "app_label": meta.app_label,
                    "model_name": meta.model_name,
                    "pk": arg.pk,
                }
            )
        # maybe we need an explicit check if it's a primitive?
        else:
            task_args.append({"type": "other", "value": arg})
    _send_notification.delay(class_name, task_args)


@instrumented_task(
    name="src.sentry.notifications.utils.async_send_notification",
    queue="email",
)  # type: ignore
def _send_notification(notification_class_name: str, arg_list: Iterable[Mapping[str, Any]]) -> None:
    NotificationClass = get(notification_class_name)
    output_args = []
    for arg in arg_list:
        if arg["type"] == "model":
            model = apps.get_model(arg["app_label"], arg["model_name"])
            # TODO: error handling
            instance = model.objects.get(pk=arg["pk"])
            output_args.append(instance)
        else:
            output_args.append(arg["value"])
    NotificationClass(*output_args).send()
