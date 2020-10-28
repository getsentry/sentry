from __future__ import absolute_import, print_function

import six

from time import time

from sentry.api.serializers import serialize
from sentry.http import safe_urlopen
from sentry.models import ServiceHook
from sentry.tasks.base import instrumented_task
from sentry.utils import json


def get_payload_v0(event):
    group = event.group
    project = group.project

    group_context = serialize(group)
    group_context["url"] = group.get_absolute_url()

    event_context = serialize(event)
    event_context["url"] = u"{}events/{}/".format(group.get_absolute_url(), event.event_id)
    data = {
        "project": {"slug": project.slug, "name": project.name},
        "group": group_context,
        "event": event_context,
    }
    return data


@instrumented_task(
    name="sentry.tasks.process_service_hook", default_retry_delay=60 * 5, max_retries=5
)
def process_service_hook(servicehook_id, event, **kwargs):
    try:
        servicehook = ServiceHook.objects.get(id=servicehook_id)
    except ServiceHook.DoesNotExist:
        return

    if servicehook.version == 0:
        payload = get_payload_v0(event)
    else:
        raise NotImplementedError

    from sentry import tsdb

    tsdb.incr(tsdb.models.servicehook_fired, servicehook.id)

    headers = {
        "Content-Type": "application/json",
        "X-ServiceHook-Timestamp": six.text_type(int(time())),
        "X-ServiceHook-GUID": servicehook.guid,
        "X-ServiceHook-Signature": servicehook.build_signature(json.dumps(payload)),
    }

    safe_urlopen(
        url=servicehook.url, data=json.dumps(payload), headers=headers, timeout=5, verify_ssl=False
    )
