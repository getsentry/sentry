from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import AlertRuleSerializer
from sentry.incidents.endpoints.bases import ProjectAlertRuleEndpoint


class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
    def get(self, request, project, alert_rule):
        """
        Fetch an alert rule.
        ``````````````````
        :auth: required
        """
        data = serialize(alert_rule, request.user, AlertRuleSerializer())
        return Response(data)
