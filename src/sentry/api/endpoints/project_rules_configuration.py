from __future__ import annotations

from collections.abc import Mapping
from typing import int, Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.constants import MIGRATED_CONDITIONS, TICKET_ACTIONS
from sentry.models.project import Project
from sentry.rules import rules
from sentry.rules.actions.integrations.create_ticket.base import TicketEventAction
from sentry.rules.actions.notify_event_service import NotifyEventServiceAction
from sentry.rules.actions.sentry_apps.base import SentryAppEventAction


@region_silo_endpoint
class ProjectRulesConfigurationEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        """
        Retrieve the list of configuration options for a given project.
        """
        action_list: list[Mapping[str, Any]] = []
        condition_list = []
        filter_list = []

        available_ticket_actions = set()

        project_has_filters = features.has("projects:alert-filters", project)
        can_create_tickets = features.has(
            "organizations:integrations-ticket-rules", project.organization
        )
        has_user_frequency_condition_with_conditions_alert = features.has(
            "organizations:event-unique-user-frequency-condition-with-conditions",
            project.organization,
        )

        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project=project)
            # skip over conditions if they are not in the migrated set for a project with alert-filters
            if project_has_filters and node.id in MIGRATED_CONDITIONS:
                continue

            if not can_create_tickets and node.id in TICKET_ACTIONS:
                continue

            if isinstance(node, SentryAppEventAction):
                custom_actions = node.get_custom_actions(project)
                if custom_actions:
                    action_list.extend(custom_actions)
                continue

            context = {"id": node.id, "label": node.label, "enabled": node.is_enabled()}
            if hasattr(node, "prompt"):
                context["prompt"] = node.prompt

            if hasattr(node, "form_fields"):
                context["formFields"] = node.form_fields

            if isinstance(node, TicketEventAction):
                context["actionType"] = "ticket"
                context["ticketType"] = node.ticket_type
                context["link"] = node.link
                available_ticket_actions.add(node.id)

            # It is possible for a project to have no services. In that scenario we do
            # not want the front end to render the action as the action does not have
            # options.
            if isinstance(node, NotifyEventServiceAction) and len(node.get_services()) == 0:
                continue

            if rule_type.startswith("condition/"):
                if (
                    node.id
                    == "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
                ) and not has_user_frequency_condition_with_conditions_alert:
                    continue
                condition_list.append(context)
            elif rule_type.startswith("filter/"):
                filter_list.append(context)
            elif rule_type.startswith("action/"):
                action_list.append(context)

        context = {"actions": action_list, "conditions": condition_list, "filters": filter_list}

        if can_create_tickets and request.GET.get("includeAllTickets") is not None:
            # Add disabled ticket integrations to response
            disabled_actions = TICKET_ACTIONS - available_ticket_actions
            context["disabledTicketActions"] = sorted(list(disabled_actions))

        return Response(context)
