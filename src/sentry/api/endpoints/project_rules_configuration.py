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

        # TODO: conditions need to be based on actions
        for rule_type, rule_cls in rules:
            node = rule_cls(project)
            context = {"id": node.id, "label": node.label, "enabled": node.is_enabled()}

            if hasattr(node, "form_fields"):
                context["formFields"] = node.form_fields

            if rule_type.startswith("condition/"):
                condition_list.append(context)
            elif rule_type.startswith("action/"):
                action_list.append(context)

        context = {"actions": action_list, "conditions": condition_list}

        return Response(context)
