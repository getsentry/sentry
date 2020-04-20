from __future__ import absolute_import

from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.rules import rules
from rest_framework.response import Response


class ProjectRulesConfigurationEndpoint(ProjectEndpoint):
    permission_classes = (StrictProjectPermission,)

    def get(self, request, project):
        """
        Retrieve the list of configuration options for a given project.
        """

        action_list = []
        condition_list = []

        has_issue_alerts_targeting = (
            project.flags.has_issue_alerts_targeting
            or request.query_params.get("issue_alerts_targeting") == "1"
        )
        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project)
            context = {"id": node.id, "label": node.label, "enabled": node.is_enabled()}
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
            elif rule_type.startswith("action/"):
                action_list.append(context)

        context = {"actions": action_list, "conditions": condition_list}

        return Response(context)
