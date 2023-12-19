from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.constants import MIGRATED_CONDITIONS, SENTRY_APP_ACTIONS, TICKET_ACTIONS
from sentry.receivers.rules import has_high_priority_issue_alerts
from sentry.rules import rules


@region_silo_endpoint
class ProjectRulesConfigurationEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project) -> Response:
        """
        Retrieve the list of configuration options for a given project.
        """
        action_list = []
        condition_list = []
        filter_list = []

        available_ticket_actions = set()

        project_has_filters = features.has("projects:alert-filters", project)
        can_create_tickets = features.has(
            "organizations:integrations-ticket-rules", project.organization
        )
        has_issue_severity_alerts = features.has("projects:first-event-severity-alerting", project)
        has_latest_adopted_release = features.has(
            "organizations:latest-adopted-release-filter", project.organization
        )

        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project)
            # skip over conditions if they are not in the migrated set for a project with alert-filters
            if project_has_filters and node.id in MIGRATED_CONDITIONS:
                continue

            if not can_create_tickets and node.id in TICKET_ACTIONS:
                continue

            if node.id in SENTRY_APP_ACTIONS:
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
                available_ticket_actions.add(node.id)

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
                    not has_high_priority_issue_alerts(project=project)
                    and context["id"]
                    == "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"
                ):
                    continue
                condition_list.append(context)
            elif rule_type.startswith("filter/"):
                if (
                    context["id"] == "sentry.rules.filters.issue_severity.IssueSeverityFilter"
                    and not has_issue_severity_alerts
                ):
                    continue
                if (
                    context["id"]
                    == "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter"
                    and not has_latest_adopted_release
                ):
                    continue
                filter_list.append(context)
            elif rule_type.startswith("action/"):
                action_list.append(context)

        context = {"actions": action_list, "conditions": condition_list, "filters": filter_list}

        if can_create_tickets and request.GET.get("includeAllTickets") is not None:
            # Add disabled ticket integrations to response
            disabled_actions = TICKET_ACTIONS - available_ticket_actions
            context["disabledTicketActions"] = sorted(list(disabled_actions))

        return Response(context)
