from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.constants import MIGRATED_CONDITIONS, SCHEMA_FORM_ACTIONS, TICKET_ACTIONS
from sentry.rules import rules


class ProjectRulesConfigurationEndpoint(ProjectEndpoint):
    def get(self, request: Request, project) -> Response:
        """
        Retrieve the list of configuration options for a given project.
        """

        action_list = []
        condition_list = []
        filter_list = []

        project_has_filters = features.has("projects:alert-filters", project)
        can_create_tickets = features.has(
            "organizations:integrations-ticket-rules", project.organization
        )
        has_percent_condition = features.has(
            "organizations:issue-percent-filters", project.organization
        )
        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project)
            # skip over conditions if they are not in the migrated set for a project with alert-filters
            if project_has_filters and node.id in MIGRATED_CONDITIONS:
                continue

            if not can_create_tickets and node.id in TICKET_ACTIONS:
                continue

            if node.id in SCHEMA_FORM_ACTIONS:
                custom_actions = node.get_custom_actions(project)
                if custom_actions:
                    action_list.extend(custom_actions)
                continue

            context = {"id": node.id, "label": node.label, "enabled": node.is_enabled()}
            if hasattr(node, "prompt"):
                context["prompt"] = node.prompt

            if hasattr(node, "form_fields"):
                context["formFields"] = node.form_fields

            if node.id in TICKET_ACTIONS:
                context["actionType"] = "ticket"
                context["ticketType"] = node.ticket_type
                context["link"] = node.link

            # It is possible for a project to have no services. In that scenario we do
            # not want the front end to render the action as the action does not have
            # options.
            if (
                node.id == "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
                and len(node.get_services()) == 0
            ):
                continue

            if rule_type.startswith("condition/"):
                if (
                    has_percent_condition
                    or context["id"]
                    != "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition"
                ):
                    condition_list.append(context)
            elif rule_type.startswith("filter/"):
                filter_list.append(context)
            elif rule_type.startswith("action/"):
                action_list.append(context)

        context = {"actions": action_list, "conditions": condition_list, "filters": filter_list}

        return Response(context)
