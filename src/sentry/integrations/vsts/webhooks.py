from __future__ import annotations

import logging
from typing import Any, Mapping

from django.utils.crypto import constant_time_compare
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.utils import sync_group_assignee_inbound
from sentry.models import Integration
from sentry.utils.email import parse_email

UNSET = object()
logger = logging.getLogger("sentry.integrations")
PROVIDER_KEY = "vsts"


class WorkItemWebhook(Endpoint):  # type: ignore
    authentication_classes = ()
    permission_classes = ()

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        data = request.data
        try:
            event_type = data["eventType"]
            external_id = data["resourceContainers"]["collection"]["id"]
        except KeyError as e:
            logger.info("vsts.invalid-webhook-payload", extra={"error": str(e)})
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        # https://docs.microsoft.com/en-us/azure/devops/service-hooks/events?view=azure-devops#workitem.updated
        if event_type == "workitem.updated":
            try:
                integration = Integration.objects.get(
                    provider=PROVIDER_KEY, external_id=external_id
                )
            except Integration.DoesNotExist:
                logger.info(
                    "vsts.integration-in-webhook-payload-does-not-exist",
                    extra={"external_id": external_id, "event_type": event_type},
                )
                return self.respond(
                    {"detail": "Integration does not exist."}, status=status.HTTP_400_BAD_REQUEST
                )

            if not check_webhook_secret(request, integration, event_type):
                return self.respond(status=status.HTTP_401_UNAUTHORIZED)

            handle_updated_workitem(data, integration)

        return self.respond()


def check_webhook_secret(request: Request, integration: Integration, event_type: str) -> bool:
    integration_secret = integration.metadata.get("subscription", {}).get("secret")
    webhook_payload_secret = request.META.get("HTTP_SHARED_SECRET")

    if integration_secret and webhook_payload_secret:
        is_valid: bool = constant_time_compare(integration_secret, webhook_payload_secret)
        key = "vsts.valid-webhook-secret" if is_valid else "vsts.invalid-webhook-secret"
    else:
        is_valid = False
        key = "vsts.missing-webhook-secret"

    logger.info(key, extra={"event_type": event_type, "integration_id": integration.id})
    return is_valid


def handle_assign_to(
    integration: Integration,
    external_issue_key: str | None,
    assigned_to: Mapping[str, str] | None,
) -> None:
    if not assigned_to:
        return

    email: str | None = None
    assign = False

    new_value = assigned_to.get("newValue")
    if new_value is not None:
        email = parse_email(new_value)
        if not email:
            logger.info(
                "vsts.failed-to-parse-email-in-handle-assign-to",
                extra={
                    "error": "parse_error",
                    "integration_id": integration.id,
                    "assigned_to_values": assigned_to,
                    "external_issue_key": external_issue_key,
                },
            )
            return  # TODO(mgaeta): return if cannot parse email?
        assign = True

    sync_group_assignee_inbound(
        integration=integration,
        email=email,
        external_issue_key=external_issue_key,
        assign=assign,
    )


def handle_status_change(
    integration: Integration,
    external_issue_key: str,
    status_change: Mapping[str, str] | None,
    project: str | None,
) -> None:
    if status_change is None:
        return

    for installation in integration.get_installations():
        installation.sync_status_inbound(
            external_issue_key,
            {
                "new_state": status_change["newValue"],
                # old_state is None when the issue is New
                "old_state": status_change.get("oldValue"),
                "project": project,
            },
        )


def handle_updated_workitem(data: Mapping[str, Any], integration: Integration) -> None:
    project: str | None = None
    try:
        external_issue_key = data["resource"]["workItemId"]
    except KeyError as e:
        logger.info(
            "vsts.updating-workitem-does-not-have-necessary-information",
            extra={"error": str(e), "integration_id": integration.id},
        )
        return

    try:
        project = data["resourceContainers"]["project"]["id"]
    except KeyError as e:
        logger.info(
            "vsts.updating-workitem-does-not-have-necessary-information",
            extra={"error": str(e), "integration_id": integration.id},
        )

    try:
        assigned_to = data["resource"]["fields"].get("System.AssignedTo")
        status_change = data["resource"]["fields"].get("System.State")
    except KeyError as e:
        logger.info(
            "vsts.updated-workitem-fields-not-passed",
            extra={
                "error": str(e),
                "workItemId": data["resource"]["workItemId"],
                "integration_id": integration.id,
                "azure_project_id": project,
            },
        )
        return  # In the case that there are no fields sent, no syncing can be done
    logger.info(
        "vsts.updated-workitem-fields-correct",
        extra={
            "workItemId": data["resource"]["workItemId"],
            "integration_id": integration.id,
            "azure_project_id": project,
        },
    )

    handle_assign_to(integration, external_issue_key, assigned_to)
    handle_status_change(integration, external_issue_key, status_change, project)
