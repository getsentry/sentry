from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.blueprint.endpoints.bases import BlueprintEndpoint
from sentry.blueprint.models import AlertTemplate
from sentry.blueprint.serializers import IncomingAlertTemplateApplySerializer
from sentry.grouping.enhancer import Rule
from sentry.models.organization import Organization


class OrganizationAlertTemplateApplyEndpoint(BlueprintEndpoint):
    def post(
        self, request: Request, organization: Organization, alert_template_id: int
    ) -> Response:
        try:
            at = AlertTemplate.objects.get(id=alert_template_id, organization_id=organization.id)
        except AlertTemplate.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = IncomingAlertTemplateApplySerializer(
            data=request.data, context={"organization", organization}
        )

        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic(router.db_for_write(Rule)):
            rule = serializer.validated_data["rule"]
            rule.data.update(
                {
                    "action_match": at.issue_alert_data.get("actionMatch", "all"),
                    "filter_match": at.issue_alert_data.get("filterMatch", "all"),
                    "frequency": at.issue_alert_data.get("frequency", 1440),
                    "conditions": at.issue_alert_data.get("conditions", [])
                    + at.issue_alert_data.get("filters", []),
                }
            )
            rule.template_id = at.id
            rule.save()
        return self.respond(status=status.HTTP_202_ACCEPTED)

    def delete(
        self, request: Request, organization: Organization, alert_template_id: int
    ) -> Response:
        try:
            AlertTemplate.objects.get(id=alert_template_id, organization_id=organization.id)
        except AlertTemplate.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = IncomingAlertTemplateApplySerializer(
            data=request.data, context={"organization", organization}
        )

        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rule = serializer.validated_data["rule"]
        rule.update(template_id=None)
        return self.respond(status=status.HTTP_202_ACCEPTED)
