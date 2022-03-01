from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.rules import rules


class ProjectAgnosticRuleConditionsEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization) -> Response:
        """
        Retrieve the list of rule conditions
        """

        def info_extractor(rule_cls):
            context = {"id": rule_cls.id, "label": rule_cls.label}
            node = rule_cls(None)
            if hasattr(node, "form_fields"):
                context["formFields"] = node.form_fields

            return context

        return Response(
            [
                info_extractor(rule_cls)
                for rule_type, rule_cls in rules
                if rule_type.startswith("condition/")
            ]
        )
