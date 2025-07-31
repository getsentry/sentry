from time import time

from sentry import nodestore
from sentry.api.serializers import serialize
from sentry.eventstore.models import Event, GroupEvent
from sentry.http import safe_urlopen
from sentry.models.group import Group
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import sentryapp_tasks
from sentry.taskworker.retry import Retry
from sentry.tsdb.base import TSDBModel
from sentry.utils import json


def get_payload_v0(event):
    group = event.group
    project = group.project

    group_context = serialize(group)
    group_context["url"] = group.get_absolute_url()

    event_context = serialize(event)
    event_context["url"] = f"{group.get_absolute_url()}events/{event.event_id}/"
    data = {
        "project": {"slug": project.slug, "name": project.name},
        "group": group_context,
        "event": event_context,
    }
    return data


@instrumented_task(
    name="sentry.sentry_apps.tasks.service_hooks.process_service_hook",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=sentryapp_tasks,
        retry=Retry(
            times=3,
            delay=60 * 5,
        ),
    ),
)
@retry
def process_service_hook(
    servicehook_id: int, project_id: int, group_id: int, event_id: str
) -> None:
    try:
        servicehook = ServiceHook.objects.get(id=servicehook_id)
    except ServiceHook.DoesNotExist:
        return

    node_id = Event.generate_node_id(project_id, event_id)
    group = Group.objects.get_from_cache(id=group_id)
    nodedata = nodestore.backend.get(node_id)
    event = GroupEvent(
        project_id=project_id,
        event_id=event_id,
        group=group,
        data=nodedata,
    )
    if servicehook.version == 0:
        payload = json.dumps(get_payload_v0(event))
    else:
        raise NotImplementedError

    from sentry import tsdb

    tsdb.backend.incr(TSDBModel.servicehook_fired, servicehook.id)

    headers = {
        "Content-Type": "application/json",
        "X-ServiceHook-Timestamp": str(int(time())),
        "X-ServiceHook-GUID": servicehook.guid,
        "X-ServiceHook-Signature": servicehook.build_signature(payload),
    }

    safe_urlopen(url=servicehook.url, data=payload, headers=headers, timeout=5, verify_ssl=False)
