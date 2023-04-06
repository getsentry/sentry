import datetime

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule
from sentry.models import Rule, RuleSnooze


class RuleSnoozeSerializer(serializers.Serializer):
    userId = serializers.IntegerField(required=False, allow_null=True)
    rule = serializers.BooleanField(required=False, allow_null=True)
    alertRule = serializers.BooleanField(required=False, allow_null=True)
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

            if data.get("rule"):
                try:
                    issue_alert_rule = Rule.objects.get(id=rule_id)
                except Rule.DoesNotExist:
                    raise serializers.ValidationError("Rule does not exist")

            if data.get("alertRule"):
                try:
                    metric_alert_rule = AlertRule.objects.get(id=rule_id)
                except AlertRule.DoesNotExist:
                    raise serializers.ValidationError("Rule does not exist")

            # should we error if it's already been created? we're not allowing editing, right? just unmuting?
            RuleSnooze.objects.create(
                user_id=data.get("userId"),
                owner_id=request.user.id,
                rule=issue_alert_rule,
                alert_rule=metric_alert_rule,
                until=data.get("until"),
                date_added=datetime.datetime.now(),
            )
            if not data.get("userId"):
                # create an audit log entry if the rule is snoozed for everyone
                rule = issue_alert_rule or metric_alert_rule
                audit_log_event = "RULE_SNOOZE" if issue_alert_rule else "ALERT_RULE_SNOOZE"

                self.create_audit_entry(
                    request=request,
                    organization=project.organization,
                    target_object=rule.id,
                    event=audit_log.get_event_id(audit_log_event),
                    data=rule.get_audit_log_data(),
                )
            rule_id = None
            alert_rule_id = None
            if issue_alert_rule:
                rule_id = issue_alert_rule.id
            if metric_alert_rule:
                alert_rule_id = metric_alert_rule.id

            rule_snooze = {
                "ownerId": request.user.id,
                "userId": data.get("userId", "everyone"),
                "ruleId": rule_id,
                "alertRuleId": alert_rule_id,
                "until": data.get("until", "forever"),
                "dateAdded": datetime.datetime.now(),
            }
            return Response(serialize(rule_snooze, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
