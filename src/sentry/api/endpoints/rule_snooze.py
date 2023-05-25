import datetime

from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.incidents.models import AlertRule
from sentry.models import Organization, OrganizationMember, Rule, RuleSnooze


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
    # make sure user has 'alert:write' scope
    try:
        org_member = OrganizationMember.objects.get(organization=organization, user_id=user.id)
        if "alerts:write" not in org_member.get_scopes():
            return False
    except OrganizationMember.DoesNotExist:
        pass
    # if the goal is to mute the rule just for the user, ensure they belong to the organization
    if user_id:
        if organization not in Organization.objects.get_for_user(user):
            return False
        return True
    # if the rule is owned by a team, allow edit (same permission as delete)
    # if the rule is unassigned, anyone can edit it
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
            raise PermissionDenied(
                detail="Requesting user cannot mute this rule.", code=status.HTTP_403_FORBIDDEN
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

        analytics.record(
            "rule.snoozed",
            user_id=request.user.id,
            organization_id=project.organization_id,
            project_id=project.id,
            rule_id=rule_id,
            rule_type=self.rule_field,
            target=data.get("target"),
            until=data.get("until"),
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
        rule = self.get_rule(rule_id)

        # find if there is a mute for all that I can remove
        shared_snooze = None
        deletion_type = None
        kwargs = {self.rule_field: rule, "user_id": None}
        try:
            shared_snooze = RuleSnooze.objects.get(**kwargs)
        except RuleSnooze.DoesNotExist:
            pass

        # if user can edit then delete it
        if shared_snooze and can_edit_alert_rule(rule, project.organization, None, request.user):
            shared_snooze.delete()
            deletion_type = "everyone"

        # next check if there is a mute for me that I can remove
        kwargs = {self.rule_field: rule, "user_id": request.user.id}
        my_snooze = None
        try:
            my_snooze = RuleSnooze.objects.get(**kwargs)
        except RuleSnooze.DoesNotExist:
            pass
        else:
            my_snooze.delete()
            # everyone takes priority over me
            if not deletion_type:
                deletion_type = "me"

        if deletion_type:
            analytics.record(
                "rule.unsnoozed",
                user_id=request.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                rule_id=rule_id,
                rule_type=self.rule_field,
                target=deletion_type,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        # didn't find a match but there is a shared snooze
        if shared_snooze:
            raise PermissionDenied(
                detail="Requesting user cannot unmute this rule.", code=status.HTTP_403_FORBIDDEN
            )
        # no snooze at all found
        return Response(
            {"detail": "This rulesnooze object doesn't exist."},
            status=status.HTTP_404_NOT_FOUND,
        )


@region_silo_endpoint
class RuleSnoozeEndpoint(BaseRuleSnoozeEndpoint):
    rule_model = Rule
    rule_field = "rule"


@region_silo_endpoint
class MetricRuleSnoozeEndpoint(BaseRuleSnoozeEndpoint):
    rule_model = AlertRule
    rule_field = "alert_rule"
