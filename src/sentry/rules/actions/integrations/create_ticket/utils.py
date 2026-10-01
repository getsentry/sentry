from __future__ import annotations

from collections.abc import Callable, Sequence

from sentry.constants import ObjectStatus
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.project_management.ticket_creation import create_ticket
from sentry.integrations.services.integration.service import integration_service
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.services.eventstore.models import GroupEvent
from sentry.types.rules import RuleFuture


def build_description_workflow_engine_ui(
    event: GroupEvent,
    workflow_id: int,
    installation: IssueBasicIntegration,
    generate_footer: Callable[[str], str],
) -> str:
    project = event.group.project
    workflow_url = create_link_to_workflow(project.organization.slug, str(workflow_id))

    description: str = installation.get_group_description(event.group, event) + generate_footer(
        workflow_url
    )
    return description


def build_description(
    event: GroupEvent,
    rule_id: int,
    installation: IssueBasicIntegration,
    generate_footer: Callable[[str], str],
) -> str:
    """
    Format the description of the ticket/work item
    """
    project = event.group.project
    rule_url = (
        f"/organizations/{project.organization.slug}/issues/alerts/rules/{project.slug}/{rule_id}/"
    )

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

        # If we invoked this handler from the notification action, we need to replace the rule_id with the legacy_rule_id, so we link notifications correctly
        # In the Notification Action, we store the rule_id in the action_id field
        action_id = rule_id
        rule_id = data.get("legacy_rule_id")

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

        workflow_id = data.get("workflow_id")
        if workflow_id is not None:
            data["description"] = build_description_workflow_engine_ui(
                event, workflow_id, installation, generate_footer
            )
        else:
            data["description"] = build_description(event, rule_id, installation, generate_footer)

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
