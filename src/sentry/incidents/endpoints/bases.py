from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.models import AlertRule, AlertRuleTrigger, AlertRuleTriggerAction


class ProjectAlertRuleEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    def convert_args(self, request: Request, alert_rule_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        # Allow orgs that have downgraded plans to delete metric alerts
        if request.method != "DELETE" and not features.has(
            "organizations:incidents", project.organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        if not request.access.has_project_access(project):
            raise PermissionDenied

        try:
            kwargs["alert_rule"] = AlertRule.objects.get(
                snuba_query__subscriptions__project=project, id=alert_rule_id
            )
        except AlertRule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class OrganizationAlertRuleEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAlertRulePermission,)

    def convert_args(self, request: Request, alert_rule_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]

        # Allow orgs that have downgraded plans to delete metric alerts
        if request.method != "DELETE" and not features.has(
            "organizations:incidents", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        try:
            kwargs["alert_rule"] = AlertRule.objects.get(
                organization=organization, id=alert_rule_id
            )
        except AlertRule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class OrganizationAlertRuleTriggerEndpoint(OrganizationAlertRuleEndpoint):
    def convert_args(self, request: Request, alert_rule_trigger_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]
        alert_rule = kwargs["alert_rule"]

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            kwargs["alert_rule_trigger"] = AlertRuleTrigger.objects.get(
                alert_rule=alert_rule, id=alert_rule_trigger_id
            )
        except AlertRuleTrigger.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class OrganizationAlertRuleTriggerActionEndpoint(OrganizationAlertRuleTriggerEndpoint):
    def convert_args(self, request: Request, alert_rule_trigger_action_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]
        trigger = kwargs["alert_rule_trigger"]

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            kwargs["alert_rule_trigger_action"] = AlertRuleTriggerAction.objects.get(
                alert_rule_trigger=trigger, id=alert_rule_trigger_action_id
            )
        except AlertRuleTriggerAction.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
