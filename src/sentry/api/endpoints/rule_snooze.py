import datetime
from typing import Any, Generic, TypeVar

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import BadRequest
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.db.models.base import Model
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze


def can_edit_alert_rule(organization, request):
    mute_for_user = request.data.get("target") == "me"
    user = request.user

    # Skip scope and user validation if using token authentication, excluding
    # user tokens.
    if request.auth and (isinstance(user, AnonymousUser) or user.is_sentry_app):
        # Raise an exception if the user is anonymous, but the request is to mute for the user.
        if mute_for_user:
            raise BadRequest(
                {
                    "detail": "Cannot mute for the request user because the user is anonymous.",
                }
            )
        return True

    # Ensure that the user has the 'alerts:write' scope.
    try:
        org_member = OrganizationMember.objects.get(organization=organization, user_id=user.id)
        if "alerts:write" not in org_member.get_scopes():
            return False
    except OrganizationMember.DoesNotExist:
        pass
    # if the goal is to mute the rule just for the user, ensure they belong to the organization
    if mute_for_user:
        return organization in Organization.objects.get_for_user(user)
    # if the rule is owned by a team, allow edit (same permission as delete)
    # if the rule is unassigned, anyone can edit it
    return True


class RuleSnoozeValidator(CamelSnakeSerializer):
    target = serializers.CharField(required=True, allow_null=False)
    until = serializers.DateTimeField(required=False, allow_null=True)


@register(RuleSnooze)
class RuleSnoozeSerializer(Serializer):
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


T = TypeVar("T", bound=Model)


class BaseRuleSnoozeEndpoint(ProjectEndpoint, Generic[T]):
    permission_classes = (ProjectAlertRulePermission,)
    rule_field: str  # abstract, value comes from child class

    def convert_args(self, request: Request, rule_id: int, *args, **kwargs):
        (args, kwargs) = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]
        try:
            queryset = self.fetch_rule_list(project=project)
            rule = queryset.get(id=rule_id)
        except ObjectDoesNotExist:
            raise NotFound(detail="Rule does not exist")

        kwargs["rule"] = rule

        return (args, kwargs)

    def post(self, request: Request, project: Project, rule: T) -> Response:
        serializer = RuleSnoozeValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        if not can_edit_alert_rule(project.organization, request):
            raise PermissionDenied(detail="Requesting user cannot mute this rule.")

        user_id = request.user.id if data.get("target") == "me" else None

        try:
            rule_snooze = self.fetch_instance(
                user_id=user_id,
                rule=rule,
            )
            # don't allow editing of a rulesnooze object for a given rule and user (or no user)
            return Response(
                {"detail": "RuleSnooze already exists for this rule and scope."},
                status=status.HTTP_410_GONE,
            )
        except RuleSnooze.DoesNotExist:
            rule_snooze = self.create_instance(
                rule=rule,
                user_id=user_id,
                owner_id=request.user.id,
                until=data.get("until"),
                date_added=datetime.datetime.now(datetime.UTC),
            )

        if not user_id:
            # create an audit log entry if the rule is snoozed for everyone
            self.record_audit_log_entry(
                request=request, organization=project.organization, rule=rule
            )

        analytics.record(
            "rule.snoozed",
            user_id=request.user.id,
            organization_id=project.organization_id,
            project_id=project.id,
            rule_id=rule.id,
            rule_type=self.rule_field,
            target=data.get("target"),
            until=data.get("until"),
        )

        return Response(
            serialize(rule_snooze, request.user, RuleSnoozeSerializer()),
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request: Request, project: Project, rule: T) -> Response:
        # find if there is a mute for all that I can remove
        shared_snooze = None
        deletion_type = None
        try:
            shared_snooze = self.fetch_instance(user_id=None, rule=rule)
        except RuleSnooze.DoesNotExist:
            pass

        # if user can edit then delete it
        if shared_snooze and can_edit_alert_rule(project.organization, request):
            shared_snooze.delete()
            deletion_type = "everyone"

        # next check if there is a mute for me that I can remove
        my_snooze = None
        try:
            my_snooze = self.fetch_instance(user_id=request.user.id, rule=rule)
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
                rule_id=rule.id,
                rule_type=self.rule_field,
                target=deletion_type,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        # didn't find a match but there is a shared snooze
        if shared_snooze:
            raise PermissionDenied(
                detail="Requesting user cannot unmute this rule.",
            )
        # no snooze at all found
        return Response(
            {"detail": "This rulesnooze object doesn't exist."},
            status=status.HTTP_404_NOT_FOUND,
        )

    def record_audit_log_entry(
        self, request: Request, organization: Organization, rule: T, **kwargs: Any
    ) -> None:
        raise NotImplementedError()

    def fetch_instance(self, rule: T, user_id: int | None, **kwargs: Any) -> RuleSnooze:
        raise NotImplementedError()

    def create_instance(self, rule: T, user_id: int | None, **kwargs: Any) -> RuleSnooze:
        raise NotImplementedError()

    def fetch_rule_list(self, project: Project) -> BaseQuerySet[T]:
        raise NotImplementedError()


@region_silo_endpoint
class RuleSnoozeEndpoint(BaseRuleSnoozeEndpoint[Rule]):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    rule_field = "rule"

    def fetch_rule_list(self, project: Project) -> BaseQuerySet[Rule]:
        queryset = Rule.objects.filter(project=project)

        return queryset

    def fetch_instance(self, rule: Rule, user_id: int | None, **kwargs: Any) -> RuleSnooze:
        rule_snooze = RuleSnooze.objects.get(user_id=user_id, rule=rule, **kwargs)

        return rule_snooze

    def create_instance(self, rule: Rule, user_id: int | None, **kwargs: Any) -> RuleSnooze:
        rule_snooze = RuleSnooze.objects.create(user_id=user_id, rule=rule, **kwargs)

        return rule_snooze

    def record_audit_log_entry(
        self, request: Request, organization: Organization, rule: Rule, **kwargs: Any
    ) -> None:
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_SNOOZE"),
            data=rule.get_audit_log_data(),
            **kwargs,
        )


@region_silo_endpoint
class MetricRuleSnoozeEndpoint(BaseRuleSnoozeEndpoint[AlertRule]):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    rule_field = "alert_rule"

    def fetch_rule_list(self, project: Project) -> BaseQuerySet[AlertRule]:
        queryset = AlertRule.objects.fetch_for_project(project=project)

        return queryset

    def fetch_instance(self, rule: AlertRule, user_id: int | None, **kwargs: Any) -> RuleSnooze:
        rule_snooze = RuleSnooze.objects.get(user_id=user_id, alert_rule=rule, **kwargs)

        return rule_snooze

    def create_instance(self, rule: AlertRule, user_id: int | None, **kwargs: Any) -> RuleSnooze:
        rule_snooze = RuleSnooze.objects.create(user_id=user_id, alert_rule=rule, **kwargs)

        return rule_snooze

    def record_audit_log_entry(
        self, request: Request, organization: Organization, rule: AlertRule, **kwargs: Any
    ) -> None:
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=rule.id,
            event=audit_log.get_event_id("ALERT_RULE_SNOOZE"),
            data=rule.get_audit_log_data(),
            **kwargs,
        )
