from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule_trigger import DetailedAlertRuleTriggerSerializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleTriggerEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleTriggerSerializer
from sentry.incidents.logic import AlreadyDeletedError, delete_alert_rule_trigger


class OrganizationAlertRuleTriggerDetailsEndpoint(OrganizationAlertRuleTriggerEndpoint):
    def get(self, request, organization, alert_rule, alert_rule_trigger):
        """
        Fetch an alert rule trigger.
        ``````````````````
        :auth: required
        """
        data = serialize(alert_rule_trigger, request.user, DetailedAlertRuleTriggerSerializer())
        return Response(data)

    def put(self, request, organization, alert_rule, alert_rule_trigger):
        serializer = AlertRuleTriggerSerializer(
            context={
                "organization": organization,
                "alert_rule": alert_rule,
                "access": request.access,
            },
            instance=alert_rule_trigger,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            trigger = serializer.save()
            return Response(serialize(trigger, request.user), status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, organization, alert_rule, alert_rule_trigger):
        try:
            delete_alert_rule_trigger(alert_rule_trigger)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AlreadyDeletedError:
            return Response(
                "This trigger has already been deleted", status=status.HTTP_400_BAD_REQUEST
            )
