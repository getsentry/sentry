from django.apps import apps

from sentry.db.models import Model
from sentry.tasks.base import instrumented_task


# TODO: handle kwargs
def async_execute(NotificationClass, *args):
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
    _send_notification(NotificationClass, task_args)


@instrumented_task(
    name="src.sentry.notifications.utils.async_execute",
    queue="email",
)
def _send_notification(NotificationClass, arg_list):
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
