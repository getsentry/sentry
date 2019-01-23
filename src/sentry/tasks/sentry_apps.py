from __future__ import absolute_import, print_function

import logging

from celery.task import current
from django.core.urlresolvers import reverse
from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.http import absolute_uri
from sentry.api.serializers import serialize, AppPlatformEvent
from sentry.models import (
    SentryAppInstallation, Group, User, ServiceHook, Project, SentryApp,
)
from sentry.models.sentryapp import VALID_EVENTS

logger = logging.Logger('sentry.tasks.sentry_apps')

TASK_OPTIONS = {
    'queue': 'app_platform',
    'default_retry_delay': (60 * 5),  # Five minutes.
    'max_retries': 3,
}

# We call some models by a different name, publically, than their class name.
# For example the model Group is called "Issue" in the UI. We want the Service
# Hook events to match what we externally call these primitives.
RESOURCE_RENAMES = {
    'Group': 'issue',
}

TYPES = {
    'Group': Group,
}


@instrumented_task(name='sentry.tasks.sentry_apps.send_alert_event', **TASK_OPTIONS)
@retry(on=(RequestException, ))
def send_alert_event(event, rule, sentry_app_id):
    group = event.group
    project = group.project

    extra = {
        'sentry_app_id': sentry_app_id,
        'project': project.slug,
        'organization': project.organization.slug,
        'rule': rule,
    }

    try:
        sentry_app = SentryApp.objects.get(id=sentry_app_id)
    except SentryApp.DoesNotExist:
        logger.info('event_alert_webhook.missing_sentry_app', extra=extra)
        return

    try:
        install = SentryAppInstallation.objects.get(
            organization=event.project.organization_id,
            sentry_app=sentry_app,
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info('event_alert_webhook.missing_installation', extra=extra)
        return

    event_context = event.as_dict()
    event_context['url'] = absolute_uri(reverse('sentry-api-0-project-event-details', args=[
        project.organization.slug,
        project.slug,
        event.id,
    ]))
    event_context['web_url'] = absolute_uri(reverse('sentry-group-event', args=[
        project.organization.slug,
        project.slug,
        group.id,
        event.id,
    ]))

    # The URL has a regex OR in it ("|") which means `reverse` cannot generate
    # a valid URL (it can't know which option to pick). We have to manually
    # create this URL for, that reason.
    event_context['issue_url'] = absolute_uri(
        '/api/0/issues/{}/'.format(group.id),
    )

    data = {
        'event': event_context,
        'triggered_rule': rule,
    }

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


@instrumented_task('sentry.tasks.process_resource_change', **TASK_OPTIONS)
@retry()
def process_resource_change(action, sender, instance_id, *args, **kwargs):
    # The class is serialized as a string when enqueueing the class.
    model = TYPES[sender]

    # Some resources are named differently than their model. eg. Group vs
    # Issue. Looks up the human name for the model. Defaults to the model name.
    name = RESOURCE_RENAMES.get(model.__name__, model.__name__.lower())

    # We may run into a race condition where this task executes before the
    # transaction that creates the Group has committed.
    try:
        instance = model.objects.get(id=instance_id)
    except model.DoesNotExist as e:
        # Explicitly requeue the task, so we don't report this to Sentry until
        # we hit the max number of retries.
        return current.retry(exc=e)

    event = '{}.{}'.format(name, action)

    if event not in VALID_EVENTS:
        return

    org = None

    if isinstance(instance, Group):
        org = instance.organization

    installations = filter(
        lambda i: event in i.sentry_app.events,
        org.sentry_app_installations.select_related('sentry_app'),
    )

    for installation in installations:
        send_webhooks(installation, event, data=serialize(instance))


@instrumented_task(name='sentry.tasks.sentry_apps.installation_webhook', **TASK_OPTIONS)
@retry(on=(RequestException, ))
def installation_webhook(installation_id, user_id, *args, **kwargs):
    from sentry.mediators.sentry_app_installations import InstallationNotifier

    extra = {
        'installation_id': installation_id,
        'user_id': user_id,
    }

    try:
        install = SentryAppInstallation.objects.get(id=installation_id)
    except SentryAppInstallation.DoesNotExist:
        logger.info('installation_webhook.missing_installation', extra=extra)
        return

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.info('installation_webhook.missing_user', extra=extra)
        return

    InstallationNotifier.run(
        install=install,
        user=user,
    )


@instrumented_task(name='sentry.tasks.sentry_apps.workflow_notification', **TASK_OPTIONS)
@retry(on=(RequestException, ))
def workflow_notification(installation_id, issue_id, type, user_id, *args, **kwargs):
    extra = {
        'installation_id': installation_id,
        'issue_id': issue_id,
    }

    try:
        install = SentryAppInstallation.objects.get(id=installation_id)
    except SentryAppInstallation.DoesNotExist:
        logger.info('workflow_notification.missing_installation', extra=extra)
        return

    try:
        issue = Group.objects.get(id=issue_id)
    except Group.DoesNotExist:
        logger.info('workflow_notification.missing_issue', extra=extra)
        return

    user = None

    try:
        user = User.objects.get(id=user_id) if user_id else None
    except User.DoesNotExist:
        logger.info('workflow_notification.missing_user', extra=extra)

    data = kwargs.get('data', {})
    data.update({'issue': serialize(issue)})

    send_webhooks(
        installation=install,
        event=u'issue.{}'.format(type),
        data=data,
        actor=user,
    )


def notify_sentry_app(event, futures):
    for f in futures:
        if not f.kwargs.get('sentry_app'):
            continue

        send_alert_event.delay(
            event=event,
            rule=f.rule.label,
            sentry_app_id=f.kwargs['sentry_app'].id,
        )


def send_webhooks(installation, event, **kwargs):
    project_ids = Project.objects.filter(
        organization_id=installation.organization_id,
    ).values_list('id', flat=True)

    servicehooks = ServiceHook.objects.filter(
        project_id__in=project_ids,
    )

    for servicehook in filter(lambda s: event in s.events, servicehooks):
        if not servicehook.created_by_sentry_app:
            continue

        if servicehook.sentry_app != installation.sentry_app:
            continue

        resource, action = event.split('.')

        kwargs['resource'] = resource
        kwargs['action'] = action
        kwargs['install'] = installation

        request_data = AppPlatformEvent(**kwargs)

        safe_urlopen(
            url=servicehook.sentry_app.webhook_url,
            data=request_data.body,
            headers=request_data.headers,
            timeout=5,
        )
