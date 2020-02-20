from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.rules import rules


class ProjectAgnosticRuleConditionsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve the list of rule conditions
        """

        def info_extractor(rule_cls):
            context = {"id": rule_cls.id, "label": rule_cls.label}
            if hasattr(rule_cls, "form_fields"):
                context["formFields"] = rule_cls.form_fields
            return context

        if not features.has(
            "organizations:new-project-issue-alert-options", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(
            [
                info_extractor(rule_cls)
                for rule_type, rule_cls in rules
                if rule_type.startswith("condition/")
            ]
        )
