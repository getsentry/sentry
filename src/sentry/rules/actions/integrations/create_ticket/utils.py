from __future__ import annotations

import logging
from typing import Callable, Sequence

from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.eventstore.models import GroupEvent
from sentry.integrations import IntegrationInstallation
from sentry.models import ExternalIssue, GroupLink, Integration
from sentry.types.rules import RuleFuture

logger = logging.getLogger("sentry.rules")


def create_link(
    integration: Integration,
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
    external_issue = ExternalIssue.objects.create(
        organization_id=event.group.project.organization_id,
        integration_id=integration.id,
        key=response["key"],
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

        try:
            integration = Integration.objects.get(
                id=integration_id,
                provider=provider,
                organizations=organization,
                status=ObjectStatus.VISIBLE,
            )
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        installation = integration.get_installation(organization.id)
        data["title"] = event.title
        data["description"] = build_description(event, rule_id, installation, generate_footer)

        if data.get("dynamic_form_fields"):
            del data["dynamic_form_fields"]

        if ExternalIssue.objects.has_linked_issue(event, integration):
            logger.info(
                f"{integration.provider}.rule_trigger.link_already_exists",
                extra={
                    "rule_id": rule_id,
                    "project_id": event.group.project.id,
                    "group_id": event.group.id,
                },
            )
            return
        response = installation.create_issue(data)
        create_link(integration, installation, event, response)
