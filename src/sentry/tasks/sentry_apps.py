from __future__ import absolute_import, print_function

from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.http import absolute_uri
from sentry.models import SentryAppInstallation
from sentry.api.serializers import AppPlatformEvent


def notify_sentry_app(event, futures):
    group = event.group
    project = group.project
    project_url_base = absolute_uri(u'/{}/{}'.format(
        project.organization.slug,
        project.slug,
    ))

    event_context = event.as_dict()
    event_context['url'] = u'/api/0{}/projects/{}/events/{}/'.format(
        project_url_base,
        group.id,
        event.id,
    )
    event_context['web_url'] = u'{}/issues/{}/events/{}/'.format(
        project_url_base,
        group.id,
        event.id,
    )
    event_context['issue_url'] = u'/api/0{}/issues/{}/'.format(
        project_url_base,
        group.id,
    )

    data = {
        'event': event_context,
    }
    for f in futures:
        sentry_app = f.kwargs['sentry_app']
        try:
            install = SentryAppInstallation.objects.get(
                organization=event.project.organization_id,
                sentry_app=sentry_app,
            )
        except SentryAppInstallation.DoesNotExist:
            continue

        data['triggered_rule'] = f.rule.label

        request_data = AppPlatformEvent(
            resource='event_alert',
            action='triggered',
            install=install,
            data=data,
        )
        send_alert_event.delay(sentry_app=sentry_app, request_data=request_data)


@instrumented_task(
    name='sentry.tasks.sentry_apps.send_alert_event', default_retry_delay=60 * 5, max_retries=5
)
@retry(on=(RequestException, ))
def send_alert_event(sentry_app, request_data):
    safe_urlopen(
        url=sentry_app.webhook_url,
        data=request_data.body,
        headers=request_data.headers,
        timeout=5,
    )
