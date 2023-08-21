from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.blueprint.endpoints.bases import BlueprintEndpoint
from sentry.blueprint.models import AlertTemplate
from sentry.blueprint.serializers import AlertTemplateSerializer, IncomingAlertTemplateSerializer
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.rule import Rule


class OrganizationAlertTemplateDetailsEndpoint(BlueprintEndpoint):
    def get(self, request: Request, organization: Organization, alert_template_id: int) -> Response:
        try:
            at = AlertTemplate.objects.get(id=alert_template_id, organization_id=organization.id)
        except AlertTemplate.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)
        return self.respond(
            serialize(at, request.user, AlertTemplateSerializer()), status=status.HTTP_200_OK
        )

    def put(self, request: Request, organization: Organization, alert_template_id: int) -> Response:
        try:
            at = AlertTemplate.objects.get(id=alert_template_id, organization_id=organization.id)
        except AlertTemplate.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        # XXX: Hack to avoid unravelling the project dependency :(
        project = Project.objects.filter(organization=organization).first()

        serializer = IncomingAlertTemplateSerializer(
            data=request.data,
            context={
                "organization": organization,
                "project": project,
                "template_id": at.id,
            },
        )
        if serializer.is_valid():
            issue_alerts = serializer.validated_data.pop("issue_alerts", [])
            issue_alert_actions = serializer.validated_data.pop("issue_alert_actions", [])
            with transaction.atomic(router.db_for_write(AlertTemplate)):
                # Disconnect non-specified alert rules
                Rule.objects.filter(template_id=at.id).exclude(id__in=issue_alerts).update(
                    template_id=None
                )
                if len(issue_alerts) > 0:
                    Rule.objects.filter(id__in=issue_alerts).update(template_id=at.id)
                at.procedure.update(issue_alert_actions=issue_alert_actions)
                at.update(**serializer.validated_data)
            return self.respond(
                serialize(at, request.user, AlertTemplateSerializer()),
                status=status.HTTP_200_OK,
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
