from __future__ import absolute_import, print_function

import logging

from celery.task import current
from django.core.urlresolvers import reverse
from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import metrics
from sentry.utils.http import absolute_uri
from sentry.api.serializers import serialize, AppPlatformEvent
from sentry.models import (
    SentryAppInstallation, EventCommon, Group, Project, Organization, User, ServiceHook, ServiceHookProject, SentryApp, SnubaEvent,
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
    'Error': SnubaEvent,
}


def _webhook_event_data(event, group_id, project_id):
    project = Project.objects.get_from_cache(id=project_id)
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    event_context = event.as_dict()
    event_context['url'] = absolute_uri(reverse('sentry-api-0-project-event-details', args=[
        project.organization.slug,
        project.slug,
        event.event_id,
    ]))

    event_context['web_url'] = absolute_uri(reverse('sentry-organization-event-detail', args=[
        organization.slug,
        group_id,
        event.event_id,
    ]))

    # The URL has a regex OR in it ("|") which means `reverse` cannot generate
    # a valid URL (it can't know which option to pick). We have to manually
    # create this URL for, that reason.
    event_context['issue_url'] = absolute_uri(
        '/api/0/issues/{}/'.format(group_id),
    )

    return event_context


@instrumented_task(name='sentry.tasks.sentry_apps.send_alert_event', **TASK_OPTIONS)
@retry(on=(RequestException, ))
def send_alert_event(event, rule, sentry_app_id):
    group = event.group
    project = Project.objects.get_from_cache(id=group.project_id)
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    extra = {
        'sentry_app_id': sentry_app_id,
        'project': project.slug,
        'organization': organization.slug,
        'rule': rule,
    }

    try:
        sentry_app = SentryApp.objects.get(id=sentry_app_id)
    except SentryApp.DoesNotExist:
        logger.info('event_alert_webhook.missing_sentry_app', extra=extra)
        return

    try:
        install = SentryAppInstallation.objects.get(
            organization=organization.id,
            sentry_app=sentry_app,
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info('event_alert_webhook.missing_installation', extra=extra)
        return

    event_context = _webhook_event_data(event, group.id, project.id)

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


def _process_resource_change(action, sender, instance_id, retryer=None, *args, **kwargs):
    # The class is serialized as a string when enqueueing the class.
    model = TYPES[sender]
    # The Event model has different hooks for the different event types. The sender
    # determines which type eg. Error and therefore the 'name' eg. error
    if issubclass(model, EventCommon):
        if not kwargs.get('instance'):
            extra = {
                'sender': sender,
                'action': action,
                'event_id': instance_id,
            }
            logger.info('process_resource_change.event_missing_event', extra=extra)
            return

        name = sender.lower()
    else:
        # Some resources are named differently than their model. eg. Group vs Issue.
        # Looks up the human name for the model. Defaults to the model name.
        name = RESOURCE_RENAMES.get(model.__name__, model.__name__.lower())

    # By default, use Celery's `current` but allow a value to be passed for the
    # bound Task.
    retryer = retryer or current

    # We may run into a race condition where this task executes before the
    # transaction that creates the Group has committed.
    try:
        if issubclass(model, EventCommon):
            # XXX:(Meredith): Passing through the entire event was an intentional choice
            # to avoid having to query NodeStore again for data we had previously in
            # post_process. While this is not ideal, changing this will most likely involve
            # an overhaul of how we do things in post_process, not just this task alone.
            instance = kwargs.get('instance')
        else:
            instance = model.objects.get(id=instance_id)
    except model.DoesNotExist as e:
        # Explicitly requeue the task, so we don't report this to Sentry until
        # we hit the max number of retries.
        return retryer.retry(exc=e)

    event = '{}.{}'.format(name, action)

    if event not in VALID_EVENTS:
        return

    org = None

    if isinstance(instance, Group) or issubclass(model, EventCommon):
        org = Organization.objects.get_from_cache(
            id=Project.objects.get_from_cache(
                id=instance.project_id
            ).organization_id
        )

    installations = filter(
        lambda i: event in i.sentry_app.events,
        org.sentry_app_installations.select_related('sentry_app'),
    )

    for installation in installations:
        data = {}
        if issubclass(model, EventCommon):
            data[name] = _webhook_event_data(instance, instance.group_id, instance.project_id)
            send_webhooks(installation, event, data=data)
        else:
            data[name] = serialize(instance)
            send_webhooks(installation, event, data=data)

        metrics.incr(
            'resource_change.processed',
            sample_rate=1.0,
            tags={
                'change_event': event,
            }
        )


@instrumented_task('sentry.tasks.process_resource_change', **TASK_OPTIONS)
@retry()
def process_resource_change(action, sender, instance_id, *args, **kwargs):
    _process_resource_change(action, sender, instance_id, *args, **kwargs)


@instrumented_task('sentry.tasks.process_resource_change_bound', bind=True, **TASK_OPTIONS)
@retry()
def process_resource_change_bound(self, action, sender, instance_id, *args, **kwargs):
    _process_resource_change(action, sender, instance_id, retryer=self, *args, **kwargs)


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
        action='created',
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
    try:
        servicehook = ServiceHook.objects.get(
            organization_id=installation.organization_id,
            actor_id=installation.id,
        )
    except ServiceHook.DoesNotExist:
        return

    if event not in servicehook.events:
        return

    # The service hook applies to all projects if there are no
    # ServiceHookProject records. Otherwise we want check if
    # the event is within the allowed projects.
    project_limited = ServiceHookProject.objects.filter(
        service_hook_id=servicehook.id,
    ).exists()

    if not project_limited:
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
