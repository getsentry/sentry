from __future__ import annotations

import logging
from typing import Any, Mapping

# XXX(mdtro): backwards compatible imports for celery 4.4.7, remove after upgrade to 5.2.7
import celery

from sentry.tasks.sentry_functions import send_sentry_function_webhook

if celery.version_info >= (5, 2):
    from celery import current_task
else:
    from celery.task import current as current_task

from django.urls import reverse
from requests.exceptions import RequestException

from sentry import analytics, features
from sentry.api.serializers import AppPlatformEvent, serialize
from sentry.constants import SentryAppInstallationStatus
from sentry.eventstore.models import Event, GroupEvent
from sentry.models import (
    Activity,
    Group,
    Organization,
    Project,
    SentryApp,
    SentryAppInstallation,
    SentryFunction,
    ServiceHook,
    ServiceHookProject,
    User,
)
from sentry.models.integrations.sentry_app import VALID_EVENTS
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError, ClientError
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import metrics
from sentry.utils.http import absolute_uri
from sentry.utils.sentry_apps import send_and_save_webhook_request

logger = logging.getLogger("sentry.tasks.sentry_apps")

TASK_OPTIONS = {
    "queue": "app_platform",
    "default_retry_delay": (60 * 5),  # Five minutes.
    "max_retries": 3,
}

RETRY_OPTIONS = {
    "on": (RequestException, ApiHostError, ApiTimeoutError),
    "ignore": (ClientError,),
}

# We call some models by a different name, publicly, than their class name.
# For example the model Group is called "Issue" in the UI. We want the Service
# Hook events to match what we externally call these primitives.
RESOURCE_RENAMES = {"Group": "issue"}

TYPES = {"Group": Group, "Error": Event, "Comment": Activity}


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
    event_context["issue_url"] = absolute_uri(f"/api/0/issues/{group_id}/")
    event_context["issue_id"] = str(group_id)
    return event_context


@instrumented_task(name="sentry.tasks.sentry_apps.send_alert_event", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def send_alert_event(
    event: Event,
    rule: str,
    sentry_app_id: int,
    additional_payload_key: str | None = None,
    additional_payload: Mapping[str, Any] | None = None,
) -> None:
    """
    When an incident alert is triggered, send incident data to the SentryApp's webhook.
    :param event: The `Event` for which to build a payload.
    :param rule: The AlertRule that was triggered.
    :param sentry_app_id: The SentryApp to notify.
    :param additional_payload_key: The key used to attach additional data to the webhook payload
    :param additional_payload: The extra data attached to the payload body at the key specified by `additional_payload_key`.
    :return:
    """
    group = event.group
    project = Project.objects.get_from_cache(id=group.project_id)
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    extra = {
        "sentry_app_id": sentry_app_id,
        "project_slug": project.slug,
        "organization_slug": organization.slug,
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

    # Attach extra payload to the webhook
    if additional_payload_key and additional_payload:
        data[additional_payload_key] = additional_payload

    request_data = AppPlatformEvent(
        resource="event_alert", action="triggered", install=install, data=data
    )

    send_and_save_webhook_request(sentry_app, request_data)

    # On success, record analytic event for Alert Rule UI Component
    if request_data.data.get("issue_alert"):
        analytics.record(
            "alert_rule_ui_component_webhook.sent",
            organization_id=organization.id,
            sentry_app_id=sentry_app_id,
            event=f"{request_data.resource}.{request_data.action}",
        )


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

    # By default, use Celery's `current_task` but allow a value to be passed for the
    # bound Task.
    retryer = retryer or current_task

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

    event = f"{name}.{action}"

    if event not in VALID_EVENTS:
        return

    org = None

    if isinstance(instance, (Group, Event, GroupEvent)):
        org = Organization.objects.get_from_cache(
            id=Project.objects.get_from_cache(id=instance.project_id).organization_id
        )

    installations = filter(
        lambda i: event in i.sentry_app.events,
        SentryAppInstallation.objects.get_installed_for_organization(org.id).select_related(
            "sentry_app"
        ),
    )

    for installation in installations:
        data = {}
        if isinstance(instance, Event) or isinstance(instance, GroupEvent):
            data[name] = _webhook_event_data(instance, instance.group_id, instance.project_id)
        else:
            data[name] = serialize(instance)

        # Trigger a new task for each webhook
        send_resource_change_webhook.delay(installation_id=installation.id, event=event, data=data)

    if features.has("organizations:sentry-functions", org):
        data = {}
        if not isinstance(instance, Event) and not isinstance(instance, GroupEvent):
            data[name] = serialize(instance)
            event_type = event.split(".")[0]
            # not sending error webhooks as of yet, can be added later
            for fn in SentryFunction.objects.get_sentry_functions(org, event_type):
                if event_type == "issue":
                    send_sentry_function_webhook.delay(
                        fn.external_id, event, data["issue"]["id"], data
                    )


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
    install, issue, user = get_webhook_data(installation_id, issue_id, user_id)

    data = kwargs.get("data", {})
    data.update({"issue": serialize(issue)})
    send_webhooks(installation=install, event=f"issue.{type}", data=data, actor=user)
    analytics.record(
        f"sentry_app.issue.{type}",
        user_id=user_id,
        group_id=issue_id,
        installation_id=installation_id,
    )


@instrumented_task(name="sentry.tasks.sentry_apps.build_comment_webhook", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def build_comment_webhook(installation_id, issue_id, type, user_id, *args, **kwargs):
    install, _, user = get_webhook_data(installation_id, issue_id, user_id)
    data = kwargs.get("data", {})
    project_slug = data.get("project_slug")
    comment_id = data.get("comment_id")
    payload = {
        "comment_id": data.get("comment_id"),
        "issue_id": issue_id,
        "project_slug": data.get("project_slug"),
        "timestamp": data.get("timestamp"),
        "comment": data.get("comment"),
    }
    send_webhooks(installation=install, event=type, data=payload, actor=user)
    # type is comment.created, comment.updated, or comment.deleted
    analytics.record(
        type,
        user_id=user_id,
        group_id=issue_id,
        project_slug=project_slug,
        installation_id=installation_id,
        comment_id=comment_id,
    )


def get_webhook_data(installation_id, issue_id, user_id):
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

    return (install, issue, user)


@instrumented_task("sentry.tasks.send_process_resource_change_webhook", **TASK_OPTIONS)
@retry(**RETRY_OPTIONS)
def send_resource_change_webhook(installation_id, event, data, *args, **kwargs):
    try:
        installation = SentryAppInstallation.objects.get(
            id=installation_id, status=SentryAppInstallationStatus.INSTALLED
        )
    except SentryAppInstallation.DoesNotExist:
        logger.info(
            "send_process_resource_change_webhook.missing_installation",
            extra={"installation_id": installation_id, "event": event},
        )
        return

    send_webhooks(installation, event, data=data)

    metrics.incr("resource_change.processed", sample_rate=1.0, tags={"change_event": event})


def notify_sentry_app(event, futures):
    for f in futures:
        if not f.kwargs.get("sentry_app"):
            continue

        extra_kwargs = {
            "additional_payload_key": None,
            "additional_payload": None,
        }
        # If the future comes from a rule with a UI component form in the schema, append the issue alert payload
        settings = f.kwargs.get("schema_defined_settings")
        if settings:
            extra_kwargs["additional_payload_key"] = "issue_alert"
            extra_kwargs["additional_payload"] = {
                "id": f.rule.id,
                "title": f.rule.label,
                "sentry_app_id": f.kwargs["sentry_app"].id,
                "settings": settings,
            }

        send_alert_event.delay(
            event=event,
            rule=f.rule.label,
            sentry_app_id=f.kwargs["sentry_app"].id,
            **extra_kwargs,
        )


def send_webhooks(installation, event, **kwargs):
    try:
        servicehook = ServiceHook.objects.get(
            organization_id=installation.organization_id, actor_id=installation.id
        )
    except ServiceHook.DoesNotExist:
        logger.info(
            "send_webhooks.missing_servicehook",
            extra={"installation_id": installation.id, "event": event},
        )
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
            installation.sentry_app,
            request_data,
            servicehook.sentry_app.webhook_url,
        )
