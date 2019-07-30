from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import AlertRuleSerializer
from sentry.incidents.endpoints.bases import ProjectAlertRuleEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleSerializer as DrfAlertRuleSerializer


class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
    def get(self, request, project, alert_rule):
        """
        Fetch an alert rule.
        ``````````````````
        :auth: required
        """
        data = serialize(alert_rule, request.user, AlertRuleSerializer())
        return Response(data)

    def put(self, request, project, alert_rule):
        serializer = DrfAlertRuleSerializer(
            context={'project': project},
            instance=alert_rule,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            alert_rule = serializer.save()
            return Response(serialize(alert_rule, request.user), status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
