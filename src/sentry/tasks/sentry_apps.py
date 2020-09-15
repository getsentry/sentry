from __future__ import absolute_import, print_function

import logging

from celery.task import current
from django.core.urlresolvers import reverse
from requests.exceptions import (
    ConnectionError,
    RequestException,
    Timeout,
)

from sentry.api.serializers import serialize, AppPlatformEvent
from sentry.constants import SentryAppInstallationStatus
from sentry.eventstore.models import Event
from sentry.http import safe_urlopen
from sentry.models import (
    Group,
    Organization,
    Project,
    SentryApp,
    SentryAppInstallation,
    ServiceHook,
    ServiceHookProject,
    User,
)
from sentry.models.sentryapp import VALID_EVENTS, track_response_code
from sentry.shared_integrations.exceptions import (
    ApiHostError,
    ApiTimeoutError,
    IgnorableSentryAppError,
)
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import metrics
from sentry.utils.compat import filter
from sentry.utils.http import absolute_uri
from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


logger = logging.getLogger("sentry.tasks.sentry_apps")

TASK_OPTIONS = {
    "queue": "app_platform",
    "default_retry_delay": (60 * 5),  # Five minutes.
    "max_retries": 3,
}

RETRY_OPTIONS = {
    "on": (RequestException, ApiHostError, ApiTimeoutError),
    "ignore": (IgnorableSentryAppError,),
}

# We call some models by a different name, publicly, than their class name.
# For example the model Group is called "Issue" in the UI. We want the Service
# Hook events to match what we externally call these primitives.
RESOURCE_RENAMES = {"Group": "issue"}

TYPES = {"Group": Group, "Error": Event}


def _webhook_event_data(event, group_id, project_id):
    project = Project.objects.get_from_cache(id=project_id)
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    event_context = event.as_dict()
    event_context["url"] = absolute_uri(
        reverse(
            "sentry-api-0-project-event-details",
            args=[project.organization.slug, project.slug, event.event_id],
        )
    )

    event_context["web_url"] = absolute_uri(
        reverse(
            "sentry-organization-event-detail", args=[organization.slug, group_id, event.event_id]
        )
    )

    # The URL has a regex OR in it ("|") which means `reverse` cannot generate
    # a valid URL (it can't know which option to pick). We have to manually
    # create this URL for, that reason.
    event_context["issue_url"] = absolute_uri("/api/0/issues/{}/".format(group_id))

    return event_context


@instrumented_task(name="sentry.tasks.sentry_apps.send_alert_event", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def send_alert_event(event, rule, sentry_app_id):
    """
    When an incident alert is triggered, send incident data to the SentryApp's webhook.
    :param event: The `Event` for which to build a payload.
    :param rule: The AlertRule that was triggered.
    :param sentry_app_id: The SentryApp to notify.
    :return:
    """
    group = event.group
    project = Project.objects.get_from_cache(id=group.project_id)
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    extra = {
        "sentry_app_id": sentry_app_id,
        "project": project.slug,
        "organization": organization.slug,
        "rule": rule,
    }

    try:
        sentry_app = SentryApp.objects.get(id=sentry_app_id)
    except SentryApp.DoesNotExist:
        logger.info("event_alert_webhook.missing_sentry_app", extra=extra)
        return

    try:
        install = SentryAppInstallation.objects.get(
            organization=organization.id,
            sentry_app=sentry_app,
            status=SentryAppInstallationStatus.INSTALLED,
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info("event_alert_webhook.missing_installation", extra=extra)
        return

    event_context = _webhook_event_data(event, group.id, project.id)

    data = {"event": event_context, "triggered_rule": rule}

    request_data = AppPlatformEvent(
        resource="event_alert", action="triggered", install=install, data=data
    )

    send_and_save_webhook_request(sentry_app, request_data)


def _process_resource_change(action, sender, instance_id, retryer=None, *args, **kwargs):
    # The class is serialized as a string when enqueueing the class.
    model = TYPES[sender]
    # The Event model has different hooks for the different event types. The sender
    # determines which type eg. Error and therefore the 'name' eg. error
    if issubclass(model, Event):
        if not kwargs.get("instance"):
            extra = {"sender": sender, "action": action, "event_id": instance_id}
            logger.info("process_resource_change.event_missing_event", extra=extra)
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
        if issubclass(model, Event):
            # XXX:(Meredith): Passing through the entire event was an intentional choice
            # to avoid having to query NodeStore again for data we had previously in
            # post_process. While this is not ideal, changing this will most likely involve
            # an overhaul of how we do things in post_process, not just this task alone.
            instance = kwargs.get("instance")
        else:
            instance = model.objects.get(id=instance_id)
    except model.DoesNotExist as e:
        # Explicitly requeue the task, so we don't report this to Sentry until
        # we hit the max number of retries.
        return retryer.retry(exc=e)

    event = "{}.{}".format(name, action)

    if event not in VALID_EVENTS:
        return

    org = None

    if isinstance(instance, Group) or isinstance(instance, Event):
        org = Organization.objects.get_from_cache(
            id=Project.objects.get_from_cache(id=instance.project_id).organization_id
        )

    installations = filter(
        lambda i: event in i.sentry_app.events,
        SentryAppInstallation.get_installed_for_org(org.id).select_related("sentry_app"),
    )

    for installation in installations:
        data = {}
        if isinstance(instance, Event):
            data[name] = _webhook_event_data(instance, instance.group_id, instance.project_id)
            send_webhooks(installation, event, data=data)
        else:
            data[name] = serialize(instance)
            send_webhooks(installation, event, data=data)

        metrics.incr("resource_change.processed", sample_rate=1.0, tags={"change_event": event})


@instrumented_task("sentry.tasks.process_resource_change", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def process_resource_change(action, sender, instance_id, *args, **kwargs):
    _process_resource_change(action, sender, instance_id, *args, **kwargs)


@instrumented_task("sentry.tasks.process_resource_change_bound", bind=True, **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def process_resource_change_bound(self, action, sender, instance_id, *args, **kwargs):
    _process_resource_change(action, sender, instance_id, retryer=self, *args, **kwargs)


@instrumented_task(name="sentry.tasks.sentry_apps.installation_webhook", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def installation_webhook(installation_id, user_id, *args, **kwargs):
    from sentry.mediators.sentry_app_installations import InstallationNotifier

    extra = {"installation_id": installation_id, "user_id": user_id}
    try:
        # we should send the webhook for pending installations on the install event in case that's part of the workflow
        install = SentryAppInstallation.objects.get(id=installation_id)
    except SentryAppInstallation.DoesNotExist:
        logger.info("installation_webhook.missing_installation", extra=extra)
        return

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.info("installation_webhook.missing_user", extra=extra)
        return

    InstallationNotifier.run(install=install, user=user, action="created")


@instrumented_task(name="sentry.tasks.sentry_apps.workflow_notification", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def workflow_notification(installation_id, issue_id, type, user_id, *args, **kwargs):
    extra = {"installation_id": installation_id, "issue_id": issue_id}

    try:
        install = SentryAppInstallation.objects.get(
            id=installation_id, status=SentryAppInstallationStatus.INSTALLED
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info("workflow_notification.missing_installation", extra=extra)
        return

    try:
        issue = Group.objects.get(id=issue_id)
    except Group.DoesNotExist:
        logger.info("workflow_notification.missing_issue", extra=extra)
        return

    user = None

    try:
        user = User.objects.get(id=user_id) if user_id else None
    except User.DoesNotExist:
        logger.info("workflow_notification.missing_user", extra=extra)

    data = kwargs.get("data", {})
    data.update({"issue": serialize(issue)})

    send_webhooks(installation=install, event=u"issue.{}".format(type), data=data, actor=user)


def notify_sentry_app(event, futures):
    for f in futures:
        if not f.kwargs.get("sentry_app"):
            continue

        send_alert_event.delay(
            event=event, rule=f.rule.label, sentry_app_id=f.kwargs["sentry_app"].id
        )


def send_webhooks(installation, event, **kwargs):
    try:
        servicehook = ServiceHook.objects.get(
            organization_id=installation.organization_id, actor_id=installation.id
        )
    except ServiceHook.DoesNotExist:
        return

    if event not in servicehook.events:
        return

    # The service hook applies to all projects if there are no
    # ServiceHookProject records. Otherwise we want check if
    # the event is within the allowed projects.
    project_limited = ServiceHookProject.objects.filter(service_hook_id=servicehook.id).exists()

    # TODO(nola): This is disabled for now, because it could potentially affect internal integrations w/ error.created
    # # If the event is error.created & the request is going out to the Org that owns the Sentry App,
    # # Make sure we don't send the request, to prevent potential infinite loops
    # if (
    #     event == "error.created"
    #     and installation.organization_id == installation.sentry_app.owner_id
    # ):
    #     # We just want to exclude error.created from the project that the integration lives in
    #     # Need to first implement project mapping for integration partners
    #     metrics.incr(
    #         "webhook_request.dropped",
    #         tags={"sentry_app": installation.sentry_app.id, "event": event},
    #     )
    #     return

    if not project_limited:
        resource, action = event.split(".")

        kwargs["resource"] = resource
        kwargs["action"] = action
        kwargs["install"] = installation

        request_data = AppPlatformEvent(**kwargs)
        send_and_save_webhook_request(
            installation.sentry_app, request_data, servicehook.sentry_app.webhook_url,
        )


def ignore_unpublished_app_errors(func):
    def wrapper(sentry_app, app_platform_event, url=None):
        try:
            return func(sentry_app, app_platform_event, url)
        except Exception:
            if sentry_app.is_published:
                raise
            else:
                raise IgnorableSentryAppError("unpublished or internal app")

    return wrapper


@ignore_unpublished_app_errors
def send_and_save_webhook_request(sentry_app, app_platform_event, url=None):
    """
    Notify a SentryApp's webhook about an incident and log response on redis.

    :param sentry_app: The SentryApp to notify via a webhook.
    :param app_platform_event: Incident data. See AppPlatformEvent.
    :param url: The URL to hit for this webhook if it is different from `sentry_app.webhook_url`.
    :return: Webhook response
    """
    buffer = SentryAppWebhookRequestsBuffer(sentry_app)

    org_id = app_platform_event.install.organization_id
    event = "{}.{}".format(app_platform_event.resource, app_platform_event.action)
    slug = sentry_app.slug_for_metrics
    url = url or sentry_app.webhook_url

    try:
        resp = safe_urlopen(
            url=url, data=app_platform_event.body, headers=app_platform_event.headers, timeout=5
        )

    except (Timeout, ConnectionError) as e:
        track_response_code(e.__class__.__name__.lower(), slug, event)
        # Response code of 0 represents timeout
        buffer.add_request(response_code=0, org_id=org_id, event=event, url=url)
        # Re-raise the exception because some of these tasks might retry on the exception
        raise

    else:
        track_response_code(resp.status_code, slug, event)
        buffer.add_request(
            response_code=resp.status_code,
            org_id=org_id,
            event=event,
            url=url,
            error_id=resp.headers.get("Sentry-Hook-Error"),
            project_id=resp.headers.get("Sentry-Hook-Project"),
        )

        if resp.status_code == 503:
            raise ApiHostError.from_request(resp.request)

        elif resp.status_code == 504:
            raise ApiTimeoutError.from_request(resp.request)

        resp.raise_for_status()

        return resp
