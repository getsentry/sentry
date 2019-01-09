from __future__ import absolute_import, print_function

import logging

from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.http import absolute_uri
from sentry.models import SentryAppInstallation, SentryApp
from sentry.api.serializers import AppPlatformEvent

logger = logging.Logger('sentry.tasks.sentry_apps')


def notify_sentry_app(event, futures):
    for f in futures:
        sentry_app = f.kwargs['sentry_app']

        send_alert_event.delay(
            event=event,
            rule=f.rule.label,
            sentry_app_id=sentry_app.id,
        )


@instrumented_task(
    name='sentry.tasks.sentry_apps.send_alert_event', default_retry_delay=60 * 5, max_retries=5
)
@retry(on=(RequestException, ))
def send_alert_event(event, rule, sentry_app_id):

    group = event.group
    project = group.project

    try:
        sentry_app = SentryApp.objects.get(id=sentry_app_id)
    except SentryApp.DoesNotExist:
        logger.info(
            'event_alert_webhook.missing_sentry_app',
            extra={
                'sentry_app_id': sentry_app_id,
                'project': project.slug,
                'organization': project.organization.slug,
                'rule': rule,
            },
        )
        return

    try:
        install = SentryAppInstallation.objects.get(
            organization=event.project.organization_id,
            sentry_app=sentry_app,
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info(
            'event_alert_webhook.missing_installation',
            extra={
                'sentry_app': sentry_app.slug,
                'project': project.slug,
                'organization': project.organization.slug,
                'rule': rule,
            },
        )
        return

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

    data['triggered_rule'] = rule

    request_data = AppPlatformEvent(
        resource='event_alert',
        action='triggered',
        install=install,
        data=data,
    )

    safe_urlopen(
        url=sentry_app.webhook_url,
        data=request_data.body,
        headers=request_data.headers,
        timeout=5,
    )
