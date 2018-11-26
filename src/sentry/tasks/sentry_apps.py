from __future__ import absolute_import, print_function

import six
from time import time
from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.models import SentryAppInstallation
from sentry.api.serializers import serialize, app_platform_event


def notify_sentry_app(event, futures):
    group = event.group
    project = group.project
    project_url_base = absolute_uri(u'/{}/{}'.format(
        project.organization.slug,
        project.slug,
    ))

    event_context = serialize(event)
    event_context['url'] = u'{}/issues/{}/events/{}/'.format(
        project_url_base,
        group.id,
        event.id,
    )
    data = {'event': event_context}
    for f in futures:
        sentry_app = f.kwargs['sentry_app']
        try:
            install = SentryAppInstallation.objects.get(
                organization=event.project.organization_id,
                sentry_app=sentry_app,
            )
        except SentryAppInstallation.DoesNotExist:
            continue

        payload = app_platform_event('alert', install, data)
        send_alert_event.delay(sentry_app=sentry_app, payload=payload)


@instrumented_task(
    name='sentry.tasks.sentry_apps.send_alert_event', default_retry_delay=60 * 5, max_retries=5
)
@retry(on=(RequestException, ))
def send_alert_event(sentry_app, payload):

    body = json.dumps(payload)

    headers = {
        'Content-Type': 'application/json',
        'X-ServiceHook-Timestamp': six.text_type(int(time())),
        'X-ServiceHook-GUID': sentry_app.uuid,
    }

    safe_urlopen(
        url=sentry_app.webhook_url,
        data=body,
        headers=headers,
        timeout=5,
        verify_ssl=False,
    )
