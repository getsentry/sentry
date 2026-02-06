from datetime import datetime, timezone
from typing import Any

from django.db import router, transaction

from sentry import deletions, tsdb
from sentry.auth.access import Access, OrganizationGlobalMembership, from_user
from sentry.auth.services.auth.model import AuthenticationContext
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_apps.external_issues.external_issue_creator import ExternalIssueCreator
from sentry.sentry_apps.external_issues.issue_link_creator import IssueLinkCreator
from sentry.sentry_apps.external_requests.select_requester import SelectRequester
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.sentry_apps.services.region.model import (
    RpcEmptyResult,
    RpcInteractionStatsResult,
    RpcPlatformExternalIssueResult,
    RpcSelectRequesterResult,
    RpcSentryAppError,
    RpcServiceHookProjectsResult,
    RpcTimeSeriesPoint,
)
from sentry.sentry_apps.services.region.serial import (
    serialize_platform_external_issue,
    serialize_service_hook_project,
)
from sentry.sentry_apps.services.region.service import SentryAppRegionService
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.tsdb.base import TSDBModel
from sentry.users.services.user import RpcUser

COMPONENT_TYPES = ["stacktrace-link", "issue-link"]


class DatabaseBackedSentryAppRegionService(SentryAppRegionService):
    def get_select_options(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        uri: str,
        project_id: int | None = None,
        query: str | None = None,
        dependent_data: str | None = None,
    ) -> RpcSelectRequesterResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_external_requests.py @ GET
        """

        project_slug: str | None = None
        if project_id is not None:
            project = Project.objects.filter(id=project_id, organization_id=organization_id).first()
            if project:
                project_slug = project.slug

        try:
            result = SelectRequester(
                install=installation,
                uri=uri,
                query=query,
                dependent_data=dependent_data,
                project_slug=project_slug,
            ).run()
        except (SentryAppIntegratorError, SentryAppSentryError) as e:
            return RpcSelectRequesterResult(error=RpcSentryAppError.from_exc(e))

        return RpcSelectRequesterResult(
            choices=list(result.get("choices", [])),
            default_value=result.get("defaultValue"),
        )

    def create_issue_link(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        group_id: int,
        action: str,
        fields: dict[str, Any],
        uri: str,
        user: RpcUser,
    ) -> RpcPlatformExternalIssueResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_external_issue_actions.py @ POST
        """
        try:
            group = Group.objects.get(
                id=group_id,
                project_id__in=Project.objects.filter(organization_id=organization_id),
            )
        except Group.DoesNotExist:
            return RpcPlatformExternalIssueResult(
                error=RpcSentryAppError(
                    message="Could not find the corresponding issue for the given groupId",
                    status_code=404,
                )
            )

        try:
            external_issue = IssueLinkCreator(
                install=installation,
                group=group,
                action=action,
                fields=fields,
                uri=uri,
                user=user,
            ).run()
        except (SentryAppIntegratorError, SentryAppSentryError) as e:
            return RpcPlatformExternalIssueResult(error=RpcSentryAppError.from_exc(e))

        return RpcPlatformExternalIssueResult(
            external_issue=serialize_platform_external_issue(external_issue)
        )

    def create_external_issue(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        group_id: int,
        web_url: str,
        project: str,
        identifier: str,
    ) -> RpcPlatformExternalIssueResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_external_issues.py @ POST
        """
        try:
            group = Group.objects.get(
                id=group_id,
                project_id__in=Project.objects.filter(organization_id=organization_id),
            )
        except Group.DoesNotExist:
            return RpcPlatformExternalIssueResult(
                error=RpcSentryAppError(
                    message="Could not find the corresponding issue for the given issueId",
                    status_code=404,
                )
            )

        try:
            external_issue = ExternalIssueCreator(
                install=installation,
                group=group,
                web_url=web_url,
                project=project,
                identifier=identifier,
            ).run()
        except SentryAppSentryError as e:
            return RpcPlatformExternalIssueResult(error=RpcSentryAppError.from_exc(e))

        return RpcPlatformExternalIssueResult(
            external_issue=serialize_platform_external_issue(external_issue)
        )

    def delete_external_issue(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        external_issue_id: int,
    ) -> RpcEmptyResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_external_issue_details.py @ DELETE
        """
        try:
            platform_external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id,
                project__organization_id=organization_id,
                service_type=installation.sentry_app.slug,
            )
        except PlatformExternalIssue.DoesNotExist:
            return RpcEmptyResult(
                success=False,
                error=RpcSentryAppError(
                    message="Could not find the corresponding external issue from given external_issue_id",
                    status_code=404,
                ),
            )

        deletions.exec_sync(platform_external_issue)

        return RpcEmptyResult()

    def _determine_access(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        auth_context: AuthenticationContext,
    ) -> Access:
        try:
            organization = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            raise SentryAppSentryError(message="Organization not found")
        if not (user := auth_context.user):
            raise SentryAppSentryError(message="User not found")
        if user.is_sentry_app:
            return OrganizationGlobalMembership(
                organization=organization,
                scopes=installation.sentry_app.scope_list,
                sso_is_valid=True,
            )
        return from_user(user=user, organization=organization)

    def get_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        auth_context: AuthenticationContext,
    ) -> RpcServiceHookProjectsResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_service_hook_projects.py @ GET
        """
        try:
            access = self._determine_access(
                organization_id=organization_id,
                installation=installation,
                auth_context=auth_context,
            )
        except SentryAppSentryError as e:
            return RpcServiceHookProjectsResult(error=RpcSentryAppError.from_exc(e))

        try:
            hook = ServiceHook.objects.get(
                installation_id=installation.id, organization_id=organization_id
            )
        except ServiceHook.DoesNotExist:
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Service hook not found for installation",
                    status_code=404,
                )
            )

        hook_projects = list(
            ServiceHookProject.objects.filter(service_hook_id=hook.id).order_by("project_id")
        )
        projects = Project.objects.filter(
            id__in={hp.project_id for hp in hook_projects}, organization_id=organization_id
        )
        if any(not access.has_project_access(project) for project in projects):
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Some projects are not accessible",
                    status_code=403,
                )
            )
        return RpcServiceHookProjectsResult(
            service_hook_projects=[serialize_service_hook_project(hp) for hp in hook_projects],
        )

    def set_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        project_identifiers: list[int | str],
        auth_context: AuthenticationContext,
    ) -> RpcServiceHookProjectsResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_service_hook_projects.py @ POST
        """
        try:
            access = self._determine_access(
                organization_id=organization_id,
                installation=installation,
                auth_context=auth_context,
            )
        except SentryAppSentryError as e:
            return RpcServiceHookProjectsResult(error=RpcSentryAppError.from_exc(e))

        try:
            hook = ServiceHook.objects.get(
                installation_id=installation.id, organization_id=organization_id
            )
        except ServiceHook.DoesNotExist:
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Service hook not found for installation",
                    status_code=404,
                )
            )

        if not project_identifiers:
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Projects list cannot be empty",
                    status_code=400,
                )
            )

        incoming_project_ids = []
        incoming_project_slugs = []
        for project_identifier in project_identifiers:
            if isinstance(project_identifier, int):
                incoming_project_ids.append(project_identifier)
            else:
                incoming_project_slugs.append(project_identifier)

        with transaction.atomic(router.db_for_write(ServiceHookProject)):
            new_projects = Project.objects.filter(
                id__in=incoming_project_ids, organization_id=organization_id
            ).union(
                Project.objects.filter(
                    slug__in=incoming_project_slugs, organization_id=organization_id
                )
            )
            new_project_ids = {p.id for p in new_projects}

            if len(new_project_ids) != len(project_identifiers):
                return RpcServiceHookProjectsResult(
                    error=RpcSentryAppError(
                        message="One or more project identifier is duplicate, not accessible, or does not exist.",
                        status_code=400,
                    )
                )

            current_project_ids = set(
                ServiceHookProject.objects.filter(service_hook_id=hook.id).values_list(
                    "project_id", flat=True
                )
            )
            current_projects = Project.objects.filter(
                id__in=current_project_ids, organization_id=organization_id
            )

            projects_to_add = new_project_ids - current_project_ids
            projects_to_remove = current_project_ids - new_project_ids

            if any(not access.has_project_access(project) for project in new_projects):
                return RpcServiceHookProjectsResult(
                    error=RpcSentryAppError(
                        message="Some projects affected by this request are not accessible",
                        status_code=403,
                    )
                )

            projects_to_remove_objs = current_projects.filter(id__in=projects_to_remove)
            if any(not access.has_project_access(project) for project in projects_to_remove_objs):
                return RpcServiceHookProjectsResult(
                    error=RpcSentryAppError(
                        message="Cannot remove projects that are not accessible",
                        status_code=403,
                    )
                )

            ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id__in=projects_to_remove
            ).delete()

            for project_id in projects_to_add:
                ServiceHookProject.objects.create(
                    project_id=project_id,
                    service_hook_id=hook.id,
                )

        hook_projects = ServiceHookProject.objects.filter(service_hook_id=hook.id).order_by(
            "project_id"
        )
        return RpcServiceHookProjectsResult(
            service_hook_projects=[serialize_service_hook_project(hp) for hp in hook_projects],
        )

    def delete_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        auth_context: AuthenticationContext,
    ) -> RpcEmptyResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_service_hook_projects.py @ DELETE
        """
        try:
            access = self._determine_access(
                organization_id=organization_id,
                installation=installation,
                auth_context=auth_context,
            )
        except SentryAppSentryError as e:
            return RpcEmptyResult(
                success=False,
                error=RpcSentryAppError.from_exc(e),
            )
        try:
            hook = ServiceHook.objects.get(
                installation_id=installation.id, organization_id=organization_id
            )
        except ServiceHook.DoesNotExist:
            return RpcEmptyResult(
                success=False,
                error=RpcSentryAppError(
                    message="Service hook not found for installation",
                    status_code=404,
                ),
            )
        with transaction.atomic(router.db_for_write(ServiceHookProject)):
            hook_projects = ServiceHookProject.objects.filter(service_hook_id=hook.id)

            projects = Project.objects.filter(
                id__in={hp.project_id for hp in hook_projects}, organization_id=organization_id
            )
            if any(not access.has_project_access(project) for project in projects):
                return RpcEmptyResult(
                    success=False,
                    error=RpcSentryAppError(
                        message="Some projects are not accessible",
                        status_code=403,
                    ),
                )
            deletions.exec_sync_many(list(hook_projects))

        return RpcEmptyResult()

    def get_interaction_stats(
        self,
        *,
        sentry_app: RpcSentryApp,
        component_types: list[str],
        since: float,
        until: float,
        resolution: int | None = None,
    ) -> RpcInteractionStatsResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/sentry_app_interaction.py @ GET
        """

        start_dt = datetime.fromtimestamp(since, tz=timezone.utc)
        end_dt = datetime.fromtimestamp(until, tz=timezone.utc)

        tsdb_kwargs: dict[str, Any] = {
            "start": start_dt,
            "end": end_dt,
            "tenant_ids": {"organization_id": sentry_app.owner_id},
        }
        if resolution is not None:
            tsdb_kwargs["rollup"] = resolution

        views_data = tsdb.backend.get_range(
            model=TSDBModel.sentry_app_viewed,
            keys=[sentry_app.id],
            **tsdb_kwargs,
        ).get(sentry_app.id, [])
        views = [RpcTimeSeriesPoint(time=t, count=c) for t, c in views_data]

        component_keys = [
            self.get_component_interaction_key(sentry_app.slug, ct) for ct in component_types
        ]
        component_data = tsdb.backend.get_range(
            model=TSDBModel.sentry_app_component_interacted,
            keys=component_keys,
            **tsdb_kwargs,
        )
        component_interactions = {
            key.split(":")[1]: [RpcTimeSeriesPoint(time=t, count=c) for t, c in value]
            for key, value in component_data.items()
        }

        return RpcInteractionStatsResult(
            views=views,
            component_interactions=component_interactions,
        )

    def record_interaction(
        self,
        *,
        sentry_app: RpcSentryApp,
        tsdb_field: str,
        component_type: str | None = None,
    ) -> RpcEmptyResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/sentry_app_interaction.py @ POST
        """
        model = getattr(TSDBModel, tsdb_field, None)

        if model == TSDBModel.sentry_app_component_interacted:
            if component_type is None or component_type not in COMPONENT_TYPES:
                return RpcEmptyResult(
                    success=False,
                    error=RpcSentryAppError(
                        message=f"The field componentType is required and must be one of {COMPONENT_TYPES}",
                        status_code=400,
                    ),
                )
            key = self.get_component_interaction_key(sentry_app.slug, component_type)
            tsdb.backend.incr(model, key)
        elif model == TSDBModel.sentry_app_viewed:
            tsdb.backend.incr(model, sentry_app.id)
        else:
            return RpcEmptyResult(
                success=False,
                error=RpcSentryAppError(
                    message="The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted",
                    status_code=400,
                ),
            )

        return RpcEmptyResult()
