from __future__ import absolute_import, print_function

from time import time

from sentry.http import safe_urlopen
from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.http import build_absolute_uri


def get_payload_v0(servicehook, event):
    from sentry.api.serializers import serialize

    group = event.group
    project = group.project

    project_url_base = build_absolute_uri('/{}/{}'.format(
        project.organization.slug,
        project.slug,
    ))

    group_context = serialize(group)
    group_context['url'] = '{}/issues/{}/'.format(
        project_url_base,
        group.id,
    )

    event_context = serialize(event)
    event_context['url'] = '{}/issues/{}/events/{}/'.format(
        project_url_base,
        group.id,
        event.id,
    )
    data = {
        'project': {
            'slug': project.slug,
            'name': project.name,
        },
        'group': group_context,
        'event': event_context,
    }
    return data


@instrumented_task(
    name='sentry.tasks.process_service_hook', default_retry_delay=60 * 5, max_retries=5
)
def process_service_hook(servicehook_id, event, **kwargs):
    from sentry.models import ServiceHook

    servicehook = ServiceHook.objects.get(id=servicehook_id)

    if servicehook.version == 0:
        payload = get_payload_v0(event)
    else:
        raise NotImplementedError

    body = json.dumps(payload)

    headers = {
        'Content-Type': 'application/json',
        'X-ServiceHook-Timestamp': int(time()),
        'X-ServiceHook-GUID': servicehook.guid,
        'X-ServiceHook-Signature': servicehook.build_signature(body),
    }

    safe_urlopen(
        url=servicehook.url,
        body=body,
        headers=headers,
        timeout=5,
        verify_ssl=False,
    )
