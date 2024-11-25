from __future__ import annotations

import logging
from collections.abc import Callable, Sequence

from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.eventstore.models import GroupEvent
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.grouplink import GroupLink
from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.silo.base import region_silo_function
from sentry.types.rules import RuleFuture
from sentry.utils import metrics

logger = logging.getLogger("sentry.rules")


@region_silo_function
def create_link(
    integration: RpcIntegration,
    installation: IntegrationInstallation,
    event: GroupEvent,
    response: Response,
) -> None:
    """
    After creating the event on a third-party service, create a link to the
    external resource in the DB. TODO make this a transaction.
    :param integration: Integration object.
    :param installation: Installation object.
    :param event: The event object that was recorded on an external service.
    :param response: The API response from creating the new resource.
        - key: String. The unique ID of the external resource
        - metadata: Optional Object. Can contain `display_name`.
    """

    external_issue_key = installation.make_external_key(response)

    external_issue = ExternalIssue.objects.create(
        organization_id=event.group.project.organization_id,
        integration_id=integration.id,
        key=external_issue_key,
        title=event.title,
        description=installation.get_group_description(event.group, event),
        metadata=response.get("metadata"),
    )
    GroupLink.objects.create(
        group_id=event.group.id,
        project_id=event.group.project_id,
        linked_type=GroupLink.LinkedType.issue,
        linked_id=external_issue.id,
        relationship=GroupLink.Relationship.references,
        data={"provider": integration.provider},
    )


def build_description(
    event: GroupEvent,
    rule_id: int,
    installation: IntegrationInstallation,
    generate_footer: Callable[[str], str],
) -> str:
    """
    Format the description of the ticket/work item
    """
    project = event.group.project
    rule_url = f"/organizations/{project.organization.slug}/alerts/rules/{project.slug}/{rule_id}/"

    description: str = installation.get_group_description(event.group, event) + generate_footer(
        rule_url
    )
    return description


def create_issue(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
    """Create an issue for a given event"""
    organization = event.group.project.organization

    for future in futures:
        rule_id = future.rule.id
        data = future.kwargs.get("data")
        provider = future.kwargs.get("provider")
        integration_id = future.kwargs.get("integration_id")
        generate_footer = future.kwargs.get("generate_footer")

        integration = integration_service.get_integration(
            integration_id=integration_id,
            provider=provider,
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            # Integration removed, rule still active.
            return

        installation = integration.get_installation(organization.id)
        data["title"] = installation.get_group_title(event.group, event)
        data["description"] = build_description(event, rule_id, installation, generate_footer)

        if data.get("dynamic_form_fields"):
            del data["dynamic_form_fields"]

        if ExternalIssue.objects.has_linked_issue(event, integration):
            logger.info(
                "%s.rule_trigger.link_already_exists",
                provider,
                extra={
                    "rule_id": rule_id,
                    "project_id": event.group.project.id,
                    "group_id": event.group.id,
                },
            )
            return

        with ProjectManagementEvent(
            action_type=ProjectManagementActionType.CREATE_EXTERNAL_ISSUE,
            integration=integration,
        ).capture() as lifecycle:
            lifecycle.add_extra("provider", provider)
            lifecycle.add_extra("integration_id", integration.id)
            lifecycle.add_extra("rule_id", rule_id)

            try:
                response = installation.create_issue(data)
            except Exception as e:
                if isinstance(e, IntegrationFormError):
                    # Most of the time, these aren't explicit failures, they're
                    # some misconfiguration of an issue field - typically Jira.
                    lifecycle.record_halt(e)

                metrics.incr(
                    f"{provider}.rule_trigger.create_ticket.failure",
                    tags={
                        "provider": provider,
                    },
                )

                raise

        create_link(integration, installation, event, response)
