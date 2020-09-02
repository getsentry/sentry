from __future__ import absolute_import

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.constants import SENTRY_RULES_WITH_MIGRATED_FILTERS
from sentry.rules import rules
from rest_framework.response import Response


class ProjectRulesConfigurationEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        Retrieve the list of configuration options for a given project.
        """

        action_list = []
        condition_list = []
        filter_list = []

        has_issue_alerts_targeting = (
            project.flags.has_issue_alerts_targeting
            or request.query_params.get("issue_alerts_targeting") == "1"
        )
        org_has_filters = features.has(
            "organizations:alert-filters", project.organization, actor=request.user
        )
        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project)
            # skip over conditions if they are not in the migrated set for an org with alert-filters
            if org_has_filters and node.id not in SENTRY_RULES_WITH_MIGRATED_FILTERS:
                continue
            context = {
                "id": node.id,
                "label": node.label,
                "enabled": node.is_enabled(),
            }
            if hasattr(node, "prompt"):
                context["prompt"] = node.prompt

            if (
                node.id == "sentry.mail.actions.NotifyEmailAction"
                and not has_issue_alerts_targeting
            ):
                continue

            if hasattr(node, "form_fields"):
                context["formFields"] = node.form_fields

            # It is possible for a project to have no services. In that scenario we do
            # not want the front end to render the action as the action does not have
            # options.
            if (
                node.id == "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
                and len(node.get_services()) == 0
            ):
                continue

            if rule_type.startswith("condition/"):
                condition_list.append(context)
            elif rule_type.startswith("filter/"):
                filter_list.append(context)
            elif rule_type.startswith("action/"):
                action_list.append(context)

        context = {"actions": action_list, "conditions": condition_list, "filters": filter_list}

        return Response(context)
