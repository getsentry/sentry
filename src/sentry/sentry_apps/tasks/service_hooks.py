from time import time

from sentry import features, nodestore
from sentry.api.serializers import serialize
from sentry.http import safe_urlopen
from sentry.models.group import Group
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import sentryapp_tasks
from sentry.taskworker.retry import Retry
from sentry.tsdb.base import TSDBModel
from sentry.utils import json
from sentry.utils.cache import cache


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


def _get_service_hooks(project_id: int) -> list[tuple[int, list[str]]]:
    from sentry.sentry_apps.models.servicehook import ServiceHook

    cache_key = f"servicehooks:1:{project_id}"
    result = cache.get(cache_key)

    if result is None:
        hooks = ServiceHook.objects.filter(servicehookproject__project_id=project_id)
        result = [(h.id, h.events) for h in hooks]
        cache.set(cache_key, result, 60)
    return result


def kick_off_service_hooks(event: GroupEvent, has_alert: bool) -> None:
    if features.has("projects:servicehooks", project=event.project):
        allowed_events = {"event.created"}
        if has_alert:
            allowed_events.add("event.alert")

        for servicehook_id, events in _get_service_hooks(project_id=event.project_id):
            if any(e in allowed_events for e in events):
                process_service_hook.delay(
                    servicehook_id=servicehook_id,
                    project_id=event.project_id,
                    group_id=event.group_id,
                    event_id=event.event_id,
                )


@instrumented_task(
    name="sentry.sentry_apps.tasks.service_hooks.process_service_hook",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    silo_mode=SiloMode.REGION,
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
