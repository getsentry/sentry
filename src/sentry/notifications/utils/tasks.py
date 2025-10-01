from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import TYPE_CHECKING, Any

from django.apps import apps
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject

from sentry.db.models import Model
from sentry.notifications.class_manager import NotificationClassNotSetException, get
from sentry.silo.base import SiloMode, region_silo_function
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import notifications_tasks
from sentry.users.services.user.model import RpcUser

if TYPE_CHECKING:
    from sentry.notifications.notifications.base import BaseNotification


ANONYMOUS_USER_KEY = "anonymoususer"
LAZY_OBJECT_KEY = "lazyobjectrpcuser"
MODEL_KEY = "model"


def serialize_lazy_object_user(arg: SimpleLazyObject, key: str | None = None) -> dict[str, Any]:
    raw_data = arg.dict()  # type: ignore[attr-defined]
    parsed_data = {}
    for k, v in raw_data.items():
        if isinstance(v, datetime):
            v = v.isoformat()
        if isinstance(v, frozenset):
            v = list(v)

        parsed_data[k] = v

    return {
        "type": LAZY_OBJECT_KEY,
        "data": parsed_data,
        "key": key,
    }


def serialize_model(arg: Model, key: str | None = None) -> dict[str, Any]:
    meta = type(arg)._meta
    return {
        "type": MODEL_KEY,
        "app_label": meta.app_label,
        "model_name": meta.model_name,
        "pk": arg.pk,
        "key": key,
    }


def serialize_anonymous_user(arg: AnonymousUser, key: str | None = None) -> dict[str, Any]:
    return {
        "type": ANONYMOUS_USER_KEY,
        "data": {},
        "key": key,
    }


@region_silo_function
def async_send_notification(
    NotificationClass: type[BaseNotification], *args: Any, **kwargs: Any
) -> None:
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
            task_args.append(serialize_model(arg))
        elif isinstance(arg, SimpleLazyObject):
            task_args.append(serialize_lazy_object_user(arg))
        elif isinstance(arg, AnonymousUser):
            task_args.append(serialize_anonymous_user(arg))
        # maybe we need an explicit check if it's a primitive?
        else:
            task_args.append({"type": "other", "value": arg, "key": None})
    for key, val in kwargs.items():
        if isinstance(val, Model):
            task_args.append(serialize_model(val, key))
        elif isinstance(val, SimpleLazyObject):
            task_args.append(serialize_lazy_object_user(val, key))
        elif isinstance(val, AnonymousUser):
            task_args.append(serialize_anonymous_user(val, key))
        # maybe we need an explicit check if it's a primitive?
        else:
            task_args.append({"type": "other", "value": val, "key": key})

    _send_notification.delay(class_name, task_args)


@instrumented_task(
    name="src.sentry.notifications.utils.async_send_notification",
    silo_mode=SiloMode.REGION,
    queue="notifications",
    taskworker_config=TaskworkerConfig(
        namespace=notifications_tasks, processing_deadline_duration=30
    ),
)
def _send_notification(notification_class_name: str, arg_list: Iterable[Mapping[str, Any]]) -> None:
    NotificationClass = get(notification_class_name)
    output_args = []
    output_kwargs = {}
    for arg in arg_list:
        if arg["type"] == MODEL_KEY:
            model = apps.get_model(arg["app_label"], arg["model_name"])
            # TODO: error handling
            instance = model.objects.get(pk=arg["pk"])
            if arg["key"]:
                output_kwargs[arg["key"]] = instance
            else:
                output_args.append(instance)
        elif arg["type"] == LAZY_OBJECT_KEY:
            user = RpcUser.parse_obj(arg["data"])

            if arg["key"]:
                output_kwargs[arg["key"]] = user
            else:
                output_args.append(user)
        elif arg["type"] == ANONYMOUS_USER_KEY:
            anon_user = AnonymousUser()
            if arg["key"]:
                output_kwargs[arg["key"]] = anon_user
            else:
                output_args.append(anon_user)
        elif arg["key"]:
            output_kwargs[arg["key"]] = arg["value"]
        else:
            output_args.append(arg["value"])
    NotificationClass(*output_args, **output_kwargs).send()
