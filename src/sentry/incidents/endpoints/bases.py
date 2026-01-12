from typing import Any

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationAlertRulePermission, OrganizationEndpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization


class OrganizationAlertRuleBaseEndpoint(OrganizationEndpoint):
    """
    Base endpoint for organization-scoped alert rule creation.

    Provides permission checking for alert creation that handles both
    org-level permissions and team admin project-scoped permissions.
    """

    def check_can_create_alert(self, request: Request, organization: Organization) -> None:
        """
        Determine if the requesting user has access to alert creation. If the request does not have the "alerts:write"
        permission, then we must verify that the user is a team admin with "alerts:write" access to the project(s)
        in their request.
        """

        # if the requesting user has any of these org-level permissions, then they can create an alert
        if (
            request.access.has_scope("alerts:write")
            or request.access.has_scope("org:admin")
            or request.access.has_scope("org:write")
        ):
            return

        # team admins should be able to create alerts for the projects they have access to
        projects = self.get_projects(request, organization)
        # team admins will have alerts:write scoped to their projects, members will not
        team_admin_has_access = all(
            [request.access.has_project_scope(project, "alerts:write") for project in projects]
        )
        # all() returns True for empty list, so include a check for it
        if not team_admin_has_access or not projects:
            raise PermissionDenied


class ProjectAlertRuleEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    def convert_args(
        self, request: Request, alert_rule_id: int, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
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
            kwargs["alert_rule"] = AlertRule.objects.get(projects=project, id=alert_rule_id)
        except AlertRule.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


class OrganizationAlertRuleEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAlertRulePermission,)

    def convert_args(
        self, request: Request, alert_rule_id: int, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
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
