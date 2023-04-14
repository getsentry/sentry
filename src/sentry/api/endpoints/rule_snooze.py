import datetime

from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed
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
class BaseRuleSnoozeEndpoint(ProjectEndpoint):
    permission_classes = (ProjectAlertRulePermission,)

    def get_rule(self, rule_id):
        try:
            rule = self.rule_model.objects.get(id=rule_id)
        except self.rule_model.DoesNotExist:
            raise serializers.ValidationError("Rule does not exist")

        return rule

    def post(self, request: Request, project, rule_id) -> Response:
        if not features.has("organizations:mute-alerts", project.organization, actor=request.user):
            raise AuthenticationFailed(
                detail="This feature is not available for this organization.",
                code=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = RuleSnoozeValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        rule = self.get_rule(rule_id)

        user_id = request.user.id if data.get("target") == "me" else None
        if not can_edit_alert_rule(rule, project.organization, user_id, request.user):
            raise AuthenticationFailed(
                detail="Requesting user cannot mute this rule.", code=status.HTTP_401_UNAUTHORIZED
            )

        kwargs = {self.rule_field: rule}

        rule_snooze, created = RuleSnooze.objects.get_or_create(
            user_id=user_id,
            defaults={
                "owner_id": request.user.id,
                "until": data.get("until"),
                "date_added": datetime.datetime.now(),
            },
            **kwargs,
        )
        # don't allow editing of a rulesnooze object for a given rule and user (or no user)
        if not created:
            return Response(
                {"detail": "RuleSnooze already exists for this rule and scope."},
                status=status.HTTP_410_GONE,
            )

        if not user_id:
            # create an audit log entry if the rule is snoozed for everyone
            audit_log_event = "RULE_SNOOZE" if self.rule_model == Rule else "ALERT_RULE_SNOOZE"

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

    def delete(self, request: Request, project, rule_id) -> Response:
        if not features.has("organizations:mute-alerts", project.organization, actor=request.user):
            raise AuthenticationFailed(
                detail="This feature is not available for this organization.",
                code=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = RuleSnoozeValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        rule = self.get_rule(rule_id)
        user_id = request.user.id if data.get("target") == "me" else None

        if not can_edit_alert_rule(rule, project.organization, user_id, request.user):
            raise AuthenticationFailed(
                detail="Requesting user cannot mute this rule.", code=status.HTTP_401_UNAUTHORIZED
            )

        kwargs = {self.rule_field: rule}

        try:
            rulesnooze = RuleSnooze.objects.get(
                user_id=user_id,
                owner_id=request.user.id,
                until=data.get("until"),
                **kwargs,
            )
        except RuleSnooze.DoesNotExist:
            return Response(
                {"detail": "This rulesnooze object doesn't exist."},
                status=status.HTTP_404_NOT_FOUND,
            )

        rulesnooze.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@region_silo_endpoint
class RuleSnoozeEndpoint(BaseRuleSnoozeEndpoint):
    rule_model = Rule
    rule_field = "rule"


@region_silo_endpoint
class MetricRuleSnoozeEndpoint(BaseRuleSnoozeEndpoint):
    rule_model = AlertRule
    rule_field = "alert_rule"
