from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.project_management.ticket_creation import create_ticket
from sentry.integrations.services.integration.service import integration_service
from sentry.notifications.types import RuleFuture
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.services.eventstore.models import GroupEvent


def build_description(
    event: GroupEvent,
    workflow_id: int,
    installation: IssueBasicIntegration,
    generate_footer: Callable[[str], str],
) -> str:
    """
    Format the description of the ticket/work item
    """
    project = event.group.project
    workflow_url = create_link_to_workflow(project.organization.slug, str(workflow_id))

    description: str = installation.get_group_description(event.group, event) + generate_footer(
        workflow_url
    )
    return description


def create_issue(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
    """Create an issue for a given event"""
    organization = event.group.project.organization

    for future in futures:
        context = future.context
        origin = context.origin
        action_id = context.action_id
        data: dict[str, Any] = future.kwargs["data"]
        provider = future.kwargs.get("provider")
        integration_id = future.kwargs.get("integration_id")
        generate_footer: Callable[[str], str] = future.kwargs["generate_footer"]

        rule_id = origin.legacy_rule_id or origin.workflow_id
        assert rule_id is not None

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

        assert isinstance(installation, IssueBasicIntegration), (
            "Installation must be an IssueBasicIntegration to create a ticket"
        )
        data["title"] = installation.get_group_title(event.group, event)

        workflow_id = origin.workflow_id
        if workflow_id is not None:
            data["description"] = build_description(
                event, workflow_id, installation, generate_footer
            )
        else:
            # Without a workflow there's nothing to link the footer to, so the
            # description is created without one.
            if not origin.is_test_notification():
                logger.warning(
                    "%s.rule_trigger.missing_workflow_id",
                    provider,
                    extra={
                        "legacy_rule_id": origin.legacy_rule_id,
                        "project_id": event.group.project.id,
                        "group_id": event.group.id,
                        "organization_id": organization.id,
                    },
                )
            data["description"] = installation.get_group_description(event.group, event)

        if data.get("dynamic_form_fields"):
            del data["dynamic_form_fields"]

        create_ticket(
            integration=integration,
            installation=installation,
            group=event.group,
            data=data,
            external_issue_title=event.title,
            external_issue_description=installation.get_group_description(event.group, event),
            metric_extras={
                "rule_id": rule_id,
                **({"action_id": action_id} if action_id else {}),
            },
        )
