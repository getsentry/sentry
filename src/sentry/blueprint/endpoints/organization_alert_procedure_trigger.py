from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.blueprint.endpoints.bases import BlueprintEndpoint
from sentry.blueprint.models import AlertProcedure
from sentry.blueprint.serializers import IncomingAlertProcedureTriggerSerializer
from sentry.models.organization import Organization
from sentry.models.rule import Rule
from sentry.rules.processor import RuleProcessor
from sentry.utils.safe import safe_execute


class OrganizationAlertProcedureTriggerEndpoint(BlueprintEndpoint):
    def post(
        self, request: Request, organization: Organization, alert_procedure_id: int
    ) -> Response:
        try:
            ap = AlertProcedure.objects.get(id=alert_procedure_id, organization_id=organization.id)
        except AlertProcedure.DoesNotExist:
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = IncomingAlertProcedureTriggerSerializer(
            data=request.data, context={"organization": organization}
        )

        if not serializer.is_valid():
            return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project = serializer.validated_data["project"]
        event = serializer.validated_data["event"]

        rule = Rule(id=-1, project=project, data={"actions": ap.issue_alert_actions})
        rp = RuleProcessor(event, False, False, False, False)
        rp.activate_downstream_actions(rule)

        for callback, futures in rp.grouped_futures.values():
            safe_execute(callback, event, futures, _with_transaction=False)

        return self.respond(status=status.HTTP_202_ACCEPTED)
