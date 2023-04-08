import datetime

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.incidents.models import AlertRule
from sentry.models import Rule, RuleSnooze


class RuleSnoozeValidator(CamelSnakeSerializer):
    target = serializers.CharField(required=True, allow_null=False)
    rule = serializers.BooleanField(required=False, allow_null=True)
    alert_rule = serializers.BooleanField(required=False, allow_null=True)
    until = serializers.DateTimeField(required=False, allow_null=True)


@region_silo_endpoint
class RuleSnoozeEndpoint(ProjectEndpoint):
    permission_classes = (ProjectAlertRulePermission,)

    def post(self, request: Request, project, rule_id) -> Response:
        if not features.has("organizations:mute-alerts", project.organization, actor=None):
            return Response(
                {"detail": "This feature is not available for this organization."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = RuleSnoozeValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        issue_alert_rule = None
        metric_alert_rule = None

        user_id = request.user.id if data.get("target") == "me" else None
        # TODO verify ownership of rule. make sure request.user belongs to the project the rule is in

        if data.get("rule"):
            try:
                issue_alert_rule = Rule.objects.get(id=rule_id)
            except Rule.DoesNotExist:
                raise serializers.ValidationError("Rule does not exist")

        if data.get("alert_rule"):
            try:
                metric_alert_rule = AlertRule.objects.get(id=rule_id)
            except AlertRule.DoesNotExist:
                raise serializers.ValidationError("Rule does not exist")

        rule_snooze, created = RuleSnooze.objects.get_or_create(
            user_id=user_id,
            rule=issue_alert_rule,
            alert_rule=metric_alert_rule,
            defaults={
                "owner_id": request.user.id,
                "until": data.get("until"),
                "date_added": datetime.datetime.now(),
            },
        )
        # don't allow editing of a rulesnooze object for a given rule and user (or no user)
        if not created:
            return Response(
                {"detail": "RuleSnooze already exists for this rule and scope."},
                status=status.HTTP_410_GONE,
            )

        if not user_id:
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

        result = {
            "ownerId": rule_snooze.owner_id,
            "userId": rule_snooze.user_id or "everyone",
            "ruleId": rule_snooze.rule_id,
            "alertRuleId": rule_snooze.alert_rule_id,
            "until": rule_snooze.until or "forever",
            "dateAdded": rule_snooze.date_added,
        }
        return Response(result, status=status.HTTP_201_CREATED)
