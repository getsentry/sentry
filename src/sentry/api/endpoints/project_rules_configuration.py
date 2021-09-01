from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.sentry_app_component import SentryAppAlertRuleActionSerializer
from sentry.constants import MIGRATED_CONDITIONS, TICKET_ACTIONS
from sentry.coreapi import APIError
from sentry.mediators import sentry_app_components
from sentry.models import SentryAppComponent, SentryAppInstallation
from sentry.rules import rules


class ProjectRulesConfigurationEndpoint(ProjectEndpoint):
    def get(self, request, project):
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

        for install in SentryAppInstallation.get_installed_for_org(project.organization_id):
            _components = SentryAppComponent.objects.filter(
                sentry_app_id=install.sentry_app_id, type="alert-rule-action"
            )
            for component in _components:
                try:
                    sentry_app_components.Preparer.run(
                        component=component, install=install, project=project
                    )
                    action_list.append(
                        serialize(component, request.user, SentryAppAlertRuleActionSerializer())
                    )

                except APIError:
                    continue

        context = {"actions": action_list, "conditions": condition_list, "filters": filter_list}

        return Response(context)
