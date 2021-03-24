from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleActivitySerializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint


class OrganizationAlertRuleActivityDetailsEndpoint(OrganizationAlertRuleEndpoint):
    def get(self, request, organization, alert_rule):
        """
        Fetch an alert rule and incidents and activities.
        ``````````````````
        :auth: required
        """
        start = request.GET.get("start")
        end = request.GET.get("end")
        data = serialize(alert_rule, request.user, DetailedAlertRuleActivitySerializer(start, end))
        return Response(data)

