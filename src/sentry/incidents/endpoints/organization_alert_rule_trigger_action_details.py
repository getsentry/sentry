from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.bases import OrganizationAlertRuleTriggerActionEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleTriggerActionSerializer
from sentry.incidents.logic import delete_alert_rule_trigger_action, InvalidTriggerActionError


class OrganizationAlertRuleTriggerActionDetailsEndpoint(OrganizationAlertRuleTriggerActionEndpoint):
    def get(self, request, organization, alert_rule, alert_rule_trigger, alert_rule_trigger_action):
        """
        Fetch an alert rule trigger action.
        ```````````````````````````````````
        :auth: required
        """
        data = serialize(alert_rule_trigger_action, request.user)
        return Response(data)

    def put(self, request, organization, alert_rule, alert_rule_trigger, alert_rule_trigger_action):
        serializer = AlertRuleTriggerActionSerializer(
            context={
                "organization": organization,
                "alert_rule": alert_rule,
                "alert_rule_trigger": alert_rule_trigger,
                "access": request.access,
            },
            instance=alert_rule_trigger_action,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            try:
                alert_rule_trigger_action = serializer.save()
            except InvalidTriggerActionError as e:
                return Response(e.message, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                serialize(alert_rule_trigger_action, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(
        self, request, organization, alert_rule, alert_rule_trigger, alert_rule_trigger_action
    ):
        delete_alert_rule_trigger_action(alert_rule_trigger_action)
        return Response(status=status.HTTP_204_NO_CONTENT)
