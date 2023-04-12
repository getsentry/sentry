import datetime

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.incidents.models import AlertRule
from sentry.models import Organization, Rule, RuleSnooze, Team


class RuleSnoozeValidator(CamelSnakeSerializer):
    target = serializers.CharField(required=True, allow_null=False)
    rule = serializers.BooleanField(required=False, allow_null=True)
    alert_rule = serializers.BooleanField(required=False, allow_null=True)
    until = serializers.DateTimeField(required=False, allow_null=True)


@register(RuleSnooze)
class RuleSnoozeSerializer(Serializer):  # type: ignore
    def serialize(self, obj, attrs, user, **kwargs):
        result = {
            "ownerId": obj.owner_id,
            "userId": obj.user_id or "everyone",
            "until": obj.until or "forever",
            "dateAdded": obj.date_added,
            "ruleId": obj.rule_id,
            "alertRuleId": obj.alert_rule_id,
        }
        return result


def can_edit_alert_rule(rule, organization, user_id, user):
    # if the goal is to mute the rule just for the user, ensure they belong to the organization
    if user_id:
        if organization not in Organization.objects.get_for_user(user):
            return False
        return True
    rule_owner = rule.owner
    # if the rule is owned by a team, ensure the user belongs to the team
    if rule_owner:
        if rule_owner.team not in Team.objects.get_for_user(organization, user):
            return False
    # if the rule is unassigned, anyone can mute it
    return True


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

        if data.get("rule") and data.get("alert_rule"):
            raise serializers.ValidationError("Pass either rule or alert rule, not both.")

        issue_alert_rule = None
        metric_alert_rule = None

        user_id = request.user.id if data.get("target") == "me" else None

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

        rule = issue_alert_rule or metric_alert_rule
        if not can_edit_alert_rule(rule, project.organization, user_id, request.user):
            return Response(
                {"detail": "Requesting user cannot mute this rule."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

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
            audit_log_event = "RULE_SNOOZE" if issue_alert_rule else "ALERT_RULE_SNOOZE"

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=rule.id,
                event=audit_log.get_event_id(audit_log_event),
                data=rule.get_audit_log_data(),
            )

        return Response(
            serialize(rule_snooze, request.user, RuleSnoozeSerializer()),
            status=status.HTTP_201_CREATED,
        )
