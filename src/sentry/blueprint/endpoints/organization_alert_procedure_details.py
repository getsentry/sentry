from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.blueprint.endpoints.bases import BlueprintEndpoint
from sentry.blueprint.models import AlertProcedure
from sentry.blueprint.serializers import AlertProcedureSerializer, IncomingAlertProcedureSerializer
from sentry.models.organization import Organization
from sentry.models.project import Project


class OrganizationAlertProcedureDetailsEndpoint(BlueprintEndpoint):
    def get(
        self, request: Request, organization: Organization, alert_procedure_id: int
    ) -> Response:
        try:
            ap = AlertProcedure.objects.get(id=alert_procedure_id, organization_id=organization.id)
        except AlertProcedure.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)
        return self.respond(
            serialize(ap, request.user, AlertProcedureSerializer()), status=status.HTTP_200_OK
        )

    def put(
        self, request: Request, organization: Organization, alert_procedure_id: int
    ) -> Response:
        try:
            ap = AlertProcedure.objects.get(id=alert_procedure_id, organization_id=organization.id)
        except AlertProcedure.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        # XXX: Hack to avoid unravelling the project dependency :(
        project = Project.objects.filter(organization=organization).first()

        serializer = IncomingAlertProcedureSerializer(
            data=request.data,
            context={
                "organization": organization,
                "project": project,
                "procedure_id": ap.id,
            },
        )
        if serializer.is_valid():
            ap.update(**serializer.validated_data)
            return self.respond(
                serialize(ap, request.user, AlertProcedureSerializer()),
                status=status.HTTP_200_OK,
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
