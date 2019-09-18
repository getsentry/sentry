from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.models import AlertRule


class ProjectAlertRuleEndpoint(ProjectEndpoint):
    def convert_args(self, request, alert_rule_id, *args, **kwargs):
        args, kwargs = super(ProjectAlertRuleEndpoint, self).convert_args(request, *args, **kwargs)
        project = kwargs["project"]

        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        if not request.access.has_project_access(project):
            raise PermissionDenied

        try:
            kwargs["alert_rule"] = AlertRule.objects.get(
                query_subscriptions__project=project, id=alert_rule_id
            )
        except AlertRule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class OrganizationAlertRuleEndpoint(OrganizationEndpoint):
    def convert_args(self, request, alert_rule_id, *args, **kwargs):
        args, kwargs = super(OrganizationAlertRuleEndpoint, self).convert_args(
            request, *args, **kwargs
        )
        organization = kwargs["organization"]

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            kwargs["alert_rule"] = AlertRule.objects.get(
                organization=organization, id=alert_rule_id
            )
        except AlertRule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs
