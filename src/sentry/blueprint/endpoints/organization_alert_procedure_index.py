from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.blueprint.endpoints.bases import BlueprintEndpoint
from sentry.blueprint.models import AlertProcedure
from sentry.blueprint.serializers import AlertProcedureSerializer, IncomingAlertProcedureSerializer
from sentry.models.organization import Organization
from sentry.models.project import Project


class OrganizationAlertProcedureIndexEndpoint(BlueprintEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        aps = list(AlertProcedure.objects.filter(organization_id=organization.id))
        return self.respond(
            serialize(aps, request.user, AlertProcedureSerializer()), status=status.HTTP_200_OK
        )

    def post(self, request: Request, organization: Organization) -> Response:
        # XXX: Hack to avoid unravelling the project dependency :(
        project = Project.objects.filter(organization=organization).first()

        rule_id = request.data.get("rule")
        if rule_id:
            # XXX: Might not create, may already exist and just return
            ap = AlertProcedure.objects.create_from_issue_alert(
                organization_id=organization.id, rule_id=rule_id
            )
            return self.respond(
                serialize(ap, request.user, AlertProcedureSerializer()),
                status=status.HTTP_202_ACCEPTED,
            )

        serializer = IncomingAlertProcedureSerializer(
            data=request.data, context={"organization": organization, "project": project}
        )
        if serializer.is_valid():
            ap = serializer.save()
            return self.respond(
                serialize(ap, request.user, AlertProcedureSerializer()),
                status=status.HTTP_201_CREATED,
            )

        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
