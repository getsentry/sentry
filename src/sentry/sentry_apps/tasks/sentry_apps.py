from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, Protocol, SupportsInt, cast

import sentry_sdk
from django.urls import reverse
from requests import HTTPError, Timeout
from requests.exceptions import ChunkedEncodingError, ConnectionError, RequestException

from sentry import analytics, nodestore
from sentry.analytics.events.alert_rule_ui_component_webhook_sent import (
    AlertRuleUiComponentWebhookSentEvent,
)
from sentry.analytics.events.comment_webhooks import (
    CommentCreatedEvent,
    CommentDeletedEvent,
    CommentEvent,
    CommentUpdatedEvent,
)
from sentry.analytics.events.sentryapp_issue_webhooks import (
    SentryAppIssueAssigned,
    SentryAppIssueCreated,
    SentryAppIssueIgnored,
    SentryAppIssueResolved,
    SentryAppIssueUnresolved,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.constants import SentryAppInstallationStatus
from sentry.db.models.base import Model
from sentry.exceptions import RestrictedIPAddress
from sentry.hybridcloud.rpc.caching import region_caching_service
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.project import Project
from sentry.notifications.utils.rules import get_rule_or_workflow_id
from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
    SentryAppWebhookFailureReason,
    SentryAppWebhookHaltReason,
)
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.services.app.service import (
    app_service,
    get_by_application_id,
    get_installation,
    get_installations_for_organization,
)
from sentry.sentry_apps.services.hook.service import hook_service
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.sentry_apps.utils.webhooks import IssueAlertActionType, SentryAppResourceType
from sentry.services.eventstore.models import BaseEvent, Event, GroupEvent
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError, ClientError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.constants import CompressionType
from sentry.taskworker.namespaces import sentryapp_control_tasks, sentryapp_tasks
from sentry.taskworker.retry import NoRetriesRemainingError, Retry, retry_task
from sentry.types.rules import RuleFuture
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.function_cache import cache_func_for_models
from sentry.utils.http import absolute_uri
from sentry.utils.sentry_apps import send_and_save_webhook_request
from sentry.utils.sentry_apps.service_hook_manager import (
    create_or_update_service_hooks_for_installation,
)

logger = logging.getLogger("sentry.sentry_apps.tasks.sentry_apps")


retry_decorator = retry(
    on=(RequestException),
    on_silent=(
        ChunkedEncodingError,
        Timeout,
        ApiHostError,
        ApiTimeoutError,
        ConnectionError,
        HTTPError,
    ),
    ignore=(
        ClientError,
        SentryAppSentryError,
        AssertionError,
        ValueError,
        RestrictedIPAddress,
        NoRetriesRemainingError,
    ),
    ignore_and_capture=(),
    raise_on_no_retries=False,
)

# We call some models by a different name, publicly, than their class name.
# For example the model Group is called "Issue" in the UI. We want the Service
# Hook events to match what we externally call these primitives.
RESOURCE_RENAMES = {"Group": "issue"}

TYPES = {"Group": Group, "Error": Event, "Comment": Activity}


def _webhook_event_data(
    event: Event | GroupEvent, group_id: int, project_id: int
) -> dict[str, Any]:
    from sentry.api.serializers.rest_framework import convert_dict_key_case, snake_to_camel_case

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
    if hasattr(event, "occurrence") and event.occurrence is not None:
        event_context["occurrence"] = convert_dict_key_case(
            event.occurrence.to_dict(), snake_to_camel_case
        )

    # The URL has a regex OR in it ("|") which means `reverse` cannot generate
    # a valid URL (it can't know which option to pick). We have to manually
    # create this URL for, that reason.
    event_context["issue_url"] = absolute_uri(
        f"/api/0/organizations/{organization.slug}/issues/{group_id}/"
    )
    event_context["issue_id"] = str(group_id)
    return event_context


# inherits from BaseGroupSerializerResponse
# we use protocol instead of TypedDict inheritance to avoid mypy crash in SCC
class WebhookGroupResponse(Protocol):
    web_url: str
    project_url: str
    url: str


def _webhook_issue_data(
    group: Group, serialized_group: BaseGroupSerializerResponse
) -> WebhookGroupResponse:
    webhook_payload = {
        "url": group.get_absolute_api_url(),
        "web_url": group.get_absolute_url(),
        "project_url": group.project.get_absolute_url(),
        **serialized_group,
    }
    return cast(WebhookGroupResponse, webhook_payload)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.send_alert_webhook_v2",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    processing_deadline_duration=5,
    silo_mode=SiloMode.REGION,
)
@retry_decorator
def send_alert_webhook_v2(
    rule_label: str,
    sentry_app_id: int,
    instance_id: str,
    group_id: int,
    occurrence_id: str,
    additional_payload_key: str | None = None,
    additional_payload: Mapping[str, Any] | None = None,
    **kwargs: Any,
):
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
        event_type=SentryAppEventType.EVENT_ALERT_TRIGGERED,
    ).capture() as lifecycle:
        group = Group.objects.get_from_cache(id=group_id)
        assert group, "Group must exist to get related attributes"
        project = Project.objects.get_from_cache(id=group.project_id)
        organization = Organization.objects.get_from_cache(id=project.organization_id)
        extra: dict[str, int | str] = {
            "sentry_app_id": sentry_app_id,
            "project_id": project.id,
            "organization_slug": organization.slug,
            "rule": rule_label,
        }
        lifecycle.add_extras(extra)

        sentry_app = app_service.get_sentry_app_by_id(id=sentry_app_id)
        if sentry_app is None:
            raise SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_SENTRY_APP)

        installations = app_service.get_many(
            filter=dict(
                organization_id=organization.id,
                app_ids=[sentry_app.id],
                status=SentryAppInstallationStatus.INSTALLED,
            )
        )
        if not installations:
            # when someone deletes an installation we don't clean up the rule actions
            # so we can have missing installations here
            lifecycle.record_halt(halt_reason=SentryAppWebhookHaltReason.MISSING_INSTALLATION)
            return
        (install,) = installations

        nodedata = nodestore.backend.get(
            BaseEvent.generate_node_id(project_id=project.id, event_id=instance_id)
        )

        if not nodedata:
            raise SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_EVENT)

        occurrence = None
        if occurrence_id:
            occurrence = IssueOccurrence.fetch(occurrence_id, project_id=project.id)

            if not occurrence:
                raise SentryAppSentryError(
                    message=SentryAppWebhookFailureReason.MISSING_ISSUE_OCCURRENCE
                )

        group_event = GroupEvent(
            project_id=project.id,
            event_id=instance_id,
            group=group,
            data=nodedata,
            occurrence=occurrence,
        )

        event_context = _webhook_event_data(group_event, group.id, project.id)

        data = {"event": event_context, "triggered_rule": rule_label}

        # Attach extra payload to the webhook
        if additional_payload_key and additional_payload:
            data[additional_payload_key] = additional_payload

        request_data = AppPlatformEvent(
            resource=SentryAppResourceType.EVENT_ALERT,
            action=IssueAlertActionType.TRIGGERED,
            install=install,
            data=data,
        )

    send_and_save_webhook_request(sentry_app, request_data)

    # On success, record analytic event for Alert Rule UI Component
    if request_data.data.get("issue_alert"):
        try:
            analytics.record(
                AlertRuleUiComponentWebhookSentEvent(
                    organization_id=organization.id,
                    sentry_app_id=sentry_app_id,
                    event=SentryAppEventType.EVENT_ALERT_TRIGGERED,
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.send_alert_webhook",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    silo_mode=SiloMode.REGION,
)
@retry_decorator
def send_alert_webhook(
    rule: str,
    sentry_app_id: int,
    instance_id: str,
    group_id: int,
    occurrence_id: str,
    additional_payload_key: str | None = None,
    additional_payload: Mapping[str, Any] | None = None,
    **kwargs: Any,
):
    send_alert_webhook_v2(
        rule_label=rule,
        sentry_app_id=sentry_app_id,
        instance_id=instance_id,
        group_id=group_id,
        occurrence_id=occurrence_id,
        additional_payload_key=additional_payload_key,
        additional_payload=additional_payload,
        **kwargs,
    )


def _process_resource_change(
    *,
    action: str,
    sender: str,
    instance_id: int,
    **kwargs: Any,
) -> None:

    # The class is serialized as a string when enqueueing the class.
    model: type[Event] | type[Model] = TYPES[sender]
    instance: Event | Model | None = None
    # Make the event name first so we can add to metric tag
    if sender == "Error":
        name = sender.lower()
    else:
        # Some resources are named differently than their model. eg. Group vs Issue.
        # Looks up the human name for the model. Defaults to the model name.
        name = RESOURCE_RENAMES.get(model.__name__, model.__name__.lower())

    event = SentryAppEventType(f"{name}.{action}")
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
        event_type=event,
    ).capture():
        project_id: int | None = kwargs.get("project_id", None)
        group_id: int | None = kwargs.get("group_id", None)

        if sender == "Error" and project_id and group_id:
            # Read event from nodestore as Events are heavy in task messages.
            nodedata = nodestore.backend.get(Event.generate_node_id(project_id, str(instance_id)))
            if not nodedata:
                raise SentryAppSentryError(
                    message=f"{SentryAppWebhookFailureReason.MISSING_EVENT}",
                )
            instance = Event(
                project_id=project_id, group_id=group_id, event_id=str(instance_id), data=nodedata
            )

        # We may run into a race condition where this task executes before the
        # transaction that creates the Group has committed.
        if not issubclass(model, Event):
            try:
                instance = model.objects.get(id=instance_id)
            except model.DoesNotExist as e:
                # Explicitly requeue the task, so we don't report this to Sentry until
                # we hit the max number of retries.
                retry_task(e)

        org = None

        if isinstance(instance, (Group, Event, GroupEvent)):
            org = Organization.objects.get_from_cache(
                id=Project.objects.get_from_cache(id=instance.project_id).organization_id
            )
            assert org, "organization must exist to get related sentry app installations"

            installations = [
                installation
                for installation in app_service.installations_for_organization(
                    organization_id=org.id
                )
                if event in installation.sentry_app.events
            ]
            data: dict[str, Any] = {}
            if isinstance(instance, (Event, GroupEvent)):
                assert instance.group_id, "group id is required to create webhook event data"
                data[name] = _webhook_event_data(instance, instance.group_id, instance.project_id)
            elif isinstance(instance, Group):
                serialized_group = serialize(instance)
                data[name] = _webhook_issue_data(group=instance, serialized_group=serialized_group)

            # Datetimes need to be string cast for task payloads.
            for date_key in ("datetime", "firstSeen", "lastSeen"):
                if date_key in data[name] and isinstance(data[name][date_key], datetime):
                    data[name][date_key] = data[name][date_key].isoformat()

            for installation in installations:
                if _is_project_allowed(installation, instance.project_id):
                    # Trigger a new task for each webhook
                    send_resource_change_webhook.delay(
                        installation_id=installation.id, event=str(event), data=data
                    )


def _is_project_allowed(installation: RpcSentryAppInstallation, project_id: int) -> bool:
    service_hook = _load_service_hook(installation.organization_id, installation.id)
    if not service_hook:
        logger.info("send_webhooks.missing_servicehook", extra={"installation_id": installation.id})
        return False
    # must use 2 separate helpers for cache invalidation to work correctly in [] <-> [project1, ...] scenarios
    return not _is_project_filtering_enabled(service_hook.id) or _does_project_filter_allow_project(
        service_hook.id, project_id
    )


@cache_func_for_models(
    [
        (
            ServiceHook,
            lambda service_hook: (service_hook.organization_id, service_hook.actor_id),
        )
    ],
    recalculate=False,
)
def _load_service_hook(organization_id: int | None, installation_id: int) -> ServiceHook | None:
    try:
        service_hook = ServiceHook.objects.get(
            organization_id=organization_id,
            actor_id=installation_id,
        )
        if service_hook.installation_id != service_hook.actor_id:
            logger.info(
                "service_hook.installation_id != service_hook.actor_id",
                extra={"service_hook_id": service_hook.id},
            )
        return service_hook
    except ServiceHook.DoesNotExist:
        return None


@cache_func_for_models(
    [(ServiceHookProject, lambda hook_project: (hook_project.service_hook_id,))],
    recalculate=False,
)
def _is_project_filtering_enabled(service_hook_id: int) -> bool:
    return ServiceHookProject.objects.filter(service_hook_id=service_hook_id).exists()


@cache_func_for_models(
    [
        (
            ServiceHookProject,
            lambda hook_project: (hook_project.service_hook_id, hook_project.project_id),
        )
    ],
    recalculate=False,
)
def _does_project_filter_allow_project(service_hook_id: int, project_id: int) -> bool:
    return ServiceHookProject.objects.filter(
        service_hook_id=service_hook_id, project_id=project_id
    ).exists()


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    processing_deadline_duration=150,
    silo_mode=SiloMode.REGION,
)
@retry_decorator
@sentry_sdk.trace(name="process_resource_change_bound")
def process_resource_change_bound(
    action: str, sender: str, instance_id: int, **kwargs: Any
) -> None:
    _process_resource_change(action=action, sender=sender, instance_id=instance_id, **kwargs)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.installation_webhook",
    namespace=sentryapp_control_tasks,
    retry=Retry(times=3, delay=60 * 5),
    silo_mode=SiloMode.CONTROL,
)
@retry_decorator
def installation_webhook(installation_id: int, user_id: int, *args: Any, **kwargs: Any) -> None:
    from sentry.sentry_apps.installations import SentryAppInstallationNotifier

    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
        event_type=SentryAppEventType.INSTALLATION_CREATED,
    ).capture() as lifecycle:
        lifecycle.add_extras({"installation_id": installation_id, "user_id": user_id})

        try:
            # we should send the webhook for pending installations on the install event in case that's part of the workflow
            install = SentryAppInstallation.objects.get(id=installation_id)
        except SentryAppInstallation.DoesNotExist:
            raise SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_INSTALLATION)

        user = user_service.get_user(user_id=user_id)
        if not user:
            raise SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_USER)

    SentryAppInstallationNotifier(
        sentry_app_installation=install, user=user, action="created"
    ).run()


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.clear_region_cache",
    namespace=sentryapp_control_tasks,
    retry=Retry(times=3, delay=60 * 5),
    processing_deadline_duration=30,
    silo_mode=SiloMode.CONTROL,
)
def clear_region_cache(sentry_app_id: int, region_name: str) -> None:
    try:
        sentry_app = SentryApp.objects.get(id=sentry_app_id)
    except SentryApp.DoesNotExist:
        return

    # When a sentry app's definition changes purge cache for all the installations.
    # This could get slow for large applications, but generally big applications don't change often.
    install_query = SentryAppInstallation.objects.filter(
        sentry_app=sentry_app,
    ).values("id", "organization_id")

    # There isn't a constraint on org : sentryapp so we have to handle lists
    install_map: dict[int, list[int]] = defaultdict(list)
    for install_row in install_query:
        install_map[install_row["organization_id"]].append(install_row["id"])

    # Clear application_id cache
    region_caching_service.clear_key(
        key=get_by_application_id.key_from(sentry_app.application_id), region_name=region_name
    )

    # Limit our operations to the region this outbox is for.
    # This could be a single query if we use raw_sql.
    region_query = OrganizationMapping.objects.filter(
        organization_id__in=list(install_map.keys()), region_name=region_name
    ).values("organization_id")
    for region_row in region_query:
        region_caching_service.clear_key(
            key=get_installations_for_organization.key_from(region_row["organization_id"]),
            region_name=region_name,
        )
        installs = install_map[region_row["organization_id"]]
        for install_id in installs:
            region_caching_service.clear_key(
                key=get_installation.key_from(install_id), region_name=region_name
            )


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.workflow_notification",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    silo_mode=SiloMode.REGION,
)
@retry_decorator
def workflow_notification(
    installation_id: int, issue_id: int, type: str, user_id: int | None, *args: Any, **kwargs: Any
) -> None:
    event = SentryAppEventType(f"issue.{type}")
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
        event_type=event,
    ).capture():
        webhook_data = get_webhook_data(installation_id, issue_id, user_id)

        install, issue, user = webhook_data
        data = kwargs.get("data", {})
        data.update({"issue": serialize(issue)})

    send_webhooks(installation=install, event=event, data=data, actor=user)

    analytics_event: analytics.Event | None = None
    if event == SentryAppEventType.ISSUE_ASSIGNED:
        analytics_event = SentryAppIssueAssigned(
            user_id=user_id,
            group_id=issue_id,
            installation_id=installation_id,
        )
    elif event == SentryAppEventType.ISSUE_CREATED:
        analytics_event = SentryAppIssueCreated(
            user_id=user_id,
            group_id=issue_id,
            installation_id=installation_id,
        )
    elif event == SentryAppEventType.ISSUE_IGNORED:
        analytics_event = SentryAppIssueIgnored(
            user_id=user_id,
            group_id=issue_id,
            installation_id=installation_id,
        )
    elif event == SentryAppEventType.ISSUE_RESOLVED:
        analytics_event = SentryAppIssueResolved(
            user_id=user_id,
            group_id=issue_id,
            installation_id=installation_id,
        )
    elif event == SentryAppEventType.ISSUE_UNRESOLVED:
        analytics_event = SentryAppIssueUnresolved(
            user_id=user_id,
            group_id=issue_id,
            installation_id=installation_id,
        )

    if analytics_event is not None:
        analytics.record(analytics_event)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.build_comment_webhook",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    silo_mode=SiloMode.REGION,
)
@retry_decorator
def build_comment_webhook(
    installation_id: int,
    issue_id: int,
    type: str,
    user_id: int,
    data: dict[str, Any],
    **kwargs: Any,
) -> None:
    event = SentryAppEventType(type)
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
        event_type=event,
    ).capture():
        webhook_data = get_webhook_data(installation_id, issue_id, user_id)
        install, _, user = webhook_data

        project_slug = data.get("project_slug")
        comment_id = data.get("comment_id")
        payload = {
            "comment_id": data.get("comment_id"),
            "issue_id": issue_id,
            "project_slug": data.get("project_slug"),
            "timestamp": data.get("timestamp"),
            "comment": data.get("comment"),
        }

    send_webhooks(installation=install, event=event, data=payload, actor=user)
    # `event` is comment.created, comment.updated, or comment.deleted
    analytics_event: CommentEvent | None = None
    if event == SentryAppEventType.COMMENT_CREATED:
        analytics_event = CommentCreatedEvent(
            user_id=user_id,
            group_id=issue_id,
            project_slug=str(project_slug),
            installation_id=installation_id,
            comment_id=int(cast(SupportsInt, comment_id)),
        )
    elif event == SentryAppEventType.COMMENT_UPDATED:
        analytics_event = CommentUpdatedEvent(
            user_id=user_id,
            group_id=issue_id,
            project_slug=str(project_slug),
            installation_id=installation_id,
            comment_id=int(cast(SupportsInt, comment_id)),
        )
    elif event == SentryAppEventType.COMMENT_DELETED:
        analytics_event = CommentDeletedEvent(
            user_id=user_id,
            group_id=issue_id,
            project_slug=str(project_slug),
            installation_id=installation_id,
            comment_id=int(cast(SupportsInt, comment_id)),
        )

    if analytics_event is not None:
        analytics.record(analytics_event)


def get_webhook_data(
    installation_id: int, issue_id: int, user_id: int | None
) -> tuple[RpcSentryAppInstallation, Group, RpcUser | None]:
    extra = {"installation_id": installation_id, "issue_id": issue_id}
    install = app_service.installation_by_id(id=installation_id)
    if not install:
        raise SentryAppSentryError(
            message=f"workflow_notification.{SentryAppWebhookFailureReason.MISSING_INSTALLATION}",
        )

    try:
        issue = Group.objects.get(id=issue_id)
    except Group.DoesNotExist:
        logger.info("workflow_notification.missing_issue", extra=extra)
        raise SentryAppSentryError(
            message=f"workflow_notification.{SentryAppWebhookFailureReason.MISSING_INSTALLATION}",
        )

    user = None
    if user_id:
        user = user_service.get_user(user_id=user_id)
        if user is None:
            raise SentryAppSentryError(
                message=f"workflow_notification.{SentryAppWebhookFailureReason.MISSING_USER}",
            )

    return (install, issue, user)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    compression_type=CompressionType.ZSTD,
    processing_deadline_duration=5,
    silo_mode=SiloMode.REGION,
)
@retry_decorator
def send_resource_change_webhook(
    installation_id: int, event: str, data: dict[str, Any], *args: Any, **kwargs: Any
) -> None:
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.SEND_WEBHOOK, event_type=SentryAppEventType(event)
    ).capture():
        installation = app_service.installation_by_id(id=installation_id)
        if not installation:
            raise SentryAppSentryError(
                message=f"{SentryAppWebhookFailureReason.MISSING_INSTALLATION}"
            )

    send_webhooks(installation, event, data=data)

    metrics.incr("resource_change.processed", sample_rate=1.0, tags={"change_event": event})


def notify_sentry_app(event: GroupEvent, futures: Sequence[RuleFuture]):
    for f in futures:
        if not f.kwargs.get("sentry_app"):
            logger.info(
                "notify_sentry_app.future_missing_sentry_app",
                extra={"event": event.as_dict(), "future": f, "event_id": event.event_id},
            )
            continue

        extra_kwargs: dict[str, Any] = {
            "additional_payload_key": None,
            "additional_payload": None,
        }

        # If the future comes from a rule with a UI component form in the schema, append the issue alert payload
        # TODO(ecosystem): We need to change this payload format after alerts create issues
        id = f.rule.id

        # if we are using the new workflow engine, we need to use the legacy rule id
        # Ignore test notifications
        if int(id) != -1:
            try:
                _, id = get_rule_or_workflow_id(f.rule)
            except AssertionError:
                pass

        settings = f.kwargs.get("schema_defined_settings")
        if settings:
            extra_kwargs["additional_payload_key"] = "issue_alert"
            extra_kwargs["additional_payload"] = {
                "id": int(id),
                "title": f.rule.label,
                "sentry_app_id": f.kwargs["sentry_app"].id,
                "settings": settings,
            }

        send_alert_webhook_v2.delay(
            instance_id=event.event_id,
            group_id=event.group_id,
            occurrence_id=event.occurrence_id if hasattr(event, "occurrence_id") else None,
            rule_label=f.rule.label,
            sentry_app_id=f.kwargs["sentry_app"].id,
            **extra_kwargs,
        )


def send_webhooks(installation: RpcSentryAppInstallation, event: str, **kwargs: Any) -> None:
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.SEND_WEBHOOK,
        event_type=SentryAppEventType(event),
    ).capture() as lifecycle:
        servicehook: ServiceHook | None = _load_service_hook(
            installation.organization_id, installation.id
        )
        if not servicehook:
            lifecycle.add_extra("events", installation.sentry_app.events)
            lifecycle.add_extras(
                {
                    "installation_uuid": installation.uuid,
                    "installation_id": installation.id,
                    "organization": installation.organization_id,
                    "sentry_app": installation.sentry_app.id,
                    "events": installation.sentry_app.events,
                    "webhook_url": installation.sentry_app.webhook_url or "",
                }
            )
            raise SentryAppSentryError(message=SentryAppWebhookFailureReason.MISSING_SERVICEHOOK)
        if event not in servicehook.events:
            lifecycle.add_extras(
                {
                    "events": servicehook.events,
                    "event": event,
                    "installation_id": installation.id,
                    "sentry_app_id": installation.sentry_app.id,
                    "sentry_app_events": installation.sentry_app.events,
                }
            )
            raise SentryAppSentryError(
                message=SentryAppWebhookFailureReason.EVENT_NOT_IN_SERVCEHOOK
            )

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

        resource, action = event.split(".")

        kwargs["resource"] = resource
        kwargs["action"] = action
        kwargs["install"] = installation

        request_data = AppPlatformEvent(**kwargs)

    send_and_save_webhook_request(
        installation.sentry_app,
        request_data,
        installation.sentry_app.webhook_url,
    )


@instrumented_task(
    "sentry.sentry_apps.tasks.sentry_apps.create_or_update_service_hooks_for_sentry_app",
    namespace=sentryapp_control_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=60,
    silo_mode=SiloMode.CONTROL,
)
def create_or_update_service_hooks_for_sentry_app(
    sentry_app_id: int, webhook_url: str, events: list[str], **kwargs: dict
) -> None:
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.MANAGEMENT,
        event_type=SentryAppEventType.WEBHOOK_UPDATE,
    ).capture() as lifecycle:
        lifecycle.add_extras({"sentry_app_id": sentry_app_id, "events": events})
        installations = SentryAppInstallation.objects.filter(sentry_app_id=sentry_app_id)

        for installation in installations:
            create_or_update_service_hooks_for_installation(
                installation=installation,
                events=events,
                webhook_url=webhook_url,
            )


@instrumented_task(
    "sentry.sentry_apps.tasks.sentry_apps.regenerate_service_hooks_for_installation",
    namespace=sentryapp_control_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=60,
    silo_mode=SiloMode.CONTROL,
)
def regenerate_service_hooks_for_installation(
    *,
    installation_id: int,
    webhook_url: str | None,
    events: list[str],
) -> None:
    """
    This function creates or updates service hooks for a given Sentry app installation.
    It first attempts to update the webhook URL and events for existing service hooks.
    If no hooks are found and a webhook URL is provided, it creates a new service hook.
    Should only be called in the control silo
    """
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.MANAGEMENT,
        event_type=SentryAppEventType.INSTALLATION_WEBHOOK_UPDATE,
    ).capture() as lifecycle:
        try:
            installation = SentryAppInstallation.objects.get(id=installation_id)
        except SentryAppInstallation.DoesNotExist:
            lifecycle.record_failure(
                SentryAppWebhookFailureReason.MISSING_INSTALLATION,
                extra={"installation_id": installation_id},
            )
            return

        lifecycle.add_extras(
            {"installation_id": installation.id, "sentry_app": installation.sentry_app.id}
        )
        hooks = hook_service.update_webhook_and_events(
            organization_id=installation.organization_id,
            application_id=installation.sentry_app.application_id,
            webhook_url=webhook_url,
            events=events,
        )
        if webhook_url and not hooks:
            # Note that because the update transaction is disjoint with this transaction, it is still
            # possible we redundantly create service hooks in the face of two concurrent requests.
            # If this proves a problem, we would need to add an additional semantic, "only create if does not exist".
            # But I think, it should be fine.
            hook_service.create_service_hook(
                application_id=installation.sentry_app.application_id,
                actor_id=installation.id,
                installation_id=installation.id,
                organization_id=installation.organization_id,
                project_ids=[],
                events=events,
                url=webhook_url,
            )


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.broadcast_webhooks_for_organization",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def broadcast_webhooks_for_organization(
    *,
    resource_name: str,
    event_name: str,
    organization_id: int,
    payload: dict[str, Any],
    **kwargs: Any,
) -> None:
    """
    Send a webhook event to all relevant installations for an organization.

    Args:
        resource_name: The resource name (e.g., "seer", "issue", "error")
        event_name: The event name (e.g., "root_cause_started", "created")
        organization_id: The ID of the organization to send webhooks for
        payload: The webhook payload data

    Returns:
        dict: Status of the webhook sending operation including success status,
              message, and error details if applicable
    """
    # Construct full event type for validation
    event_type = f"{resource_name}.{event_name}"

    # Validate event type by checking if it's a valid SentryAppEventType
    try:
        SentryAppEventType(event_type)
    except ValueError:
        logger.exception("sentry_app.webhook_invalid_event_type", extra={"event_type": event_type})

        raise SentryAppSentryError(
            message=f"Invalid event type: {event_type}",
        )

    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
        event_type=event_type,
    ).capture():
        # Get installations for this organization
        installations = app_service.installations_for_organization(organization_id=organization_id)

        # Filter for installations that subscribe to the event category
        from sentry.sentry_apps.logic import consolidate_events

        relevant_installations = [
            installation
            for installation in installations
            if resource_name in consolidate_events(installation.sentry_app.events)
        ]

        if not relevant_installations:
            logger.info(
                "sentry_app.webhook_no_installations_subscribed",
                extra={
                    "resource_name": resource_name,
                    "organization_id": organization_id,
                },
            )
            return

        # Send the webhook to each relevant installation
        for installation in relevant_installations:
            if installation:
                send_resource_change_webhook.delay(installation.id, event_type, payload)

                logger.info(
                    "sentry_app.webhook_queued",
                    extra={
                        "event_type": event_type,
                        "installation_id": installation.id,
                        "organization_id": organization_id,
                    },
                )
            else:
                logger.error(
                    "sentry_app.webhook_no_installation",
                    extra={"event_type": event_type, "organization_id": organization_id},
                )
