import datetime

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule
from sentry.models import Rule, RuleSnooze


class RuleSnoozeSerializer(serializers.Serializer):
    userId = serializers.IntegerField(required=False, allow_null=True)
    ruleId = serializers.IntegerField(required=False, allow_null=True)
    alertRuleId = serializers.IntegerField(required=False, allow_null=True)
    until = serializers.DateTimeField(required=False, allow_null=True)


@region_silo_endpoint
class RuleSnoozeEndpoint(ProjectEndpoint):
    permission_classes = (ProjectAlertRulePermission,)

    def post(self, request: Request, project, rule_id) -> Response:
        serializer = RuleSnoozeSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data

            issue_alert_rule = None
            metric_alert_rule = None

            if data.get("ruleId"):
                try:
                    issue_alert_rule = Rule.objects.get(id=data["ruleId"])
                except Rule.DoesNotExist:
                    raise serializers.ValidationError("Rule does not exist")

            if data.get("alertRuleId"):
                try:
                    metric_alert_rule = AlertRule.objects.get(id=data["alertRuleId"])
                except Rule.DoesNotExist:
                    raise serializers.ValidationError("Rule does not exist")

            RuleSnooze.objects.create(
                user_id=data.get("userId"),
                owner_id=request.user.id,
                rule=issue_alert_rule,
                alert_rule=metric_alert_rule,
                until=data.get("until"),
                date_added=datetime.datetime.now(),
            )
            # create audit entry if rule snoozed for all
            rule_snooze = {
                "ownerId": request.user.id,
                "userId": data.get("userId", "everyone"),
                "ruleId": data.get("ruleId"),
                "alertRuleId": data.get("alertRuleId"),
                "until": data.get("until", "forever"),
                "dateAdded": datetime.datetime.now(),
            }
            return Response(serialize(rule_snooze, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
