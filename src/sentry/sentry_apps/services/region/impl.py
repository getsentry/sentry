from datetime import datetime, timezone
from typing import Any

from sentry import deletions, tsdb
from sentry.models.group import Group
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
    RpcPlatformExternalIssue,
    RpcPlatformExternalIssueResult,
    RpcSelectRequesterResult,
    RpcSentryAppError,
    RpcServiceHookProject,
    RpcServiceHookProjectsResult,
    RpcTimeSeriesPoint,
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
            error = RpcSentryAppError(
                message=e.message,
                webhook_context=e.webhook_context,
                status_code=e.status_code,
            )
            return RpcSelectRequesterResult(error=error)

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
                    webhook_context={},
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
            return RpcPlatformExternalIssueResult(
                error=RpcSentryAppError(
                    message=e.message,
                    webhook_context=e.webhook_context,
                    status_code=e.status_code,
                )
            )

        return RpcPlatformExternalIssueResult(
            external_issue=RpcPlatformExternalIssue(
                id=str(external_issue.id),
                issue_id=str(external_issue.group_id),
                service_type=external_issue.service_type,
                display_name=external_issue.display_name,
                web_url=external_issue.web_url,
            )
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
                    webhook_context={},
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
            return RpcPlatformExternalIssueResult(
                error=RpcSentryAppError(
                    message=e.message,
                    webhook_context=e.webhook_context,
                    status_code=e.status_code,
                )
            )

        return RpcPlatformExternalIssueResult(
            external_issue=RpcPlatformExternalIssue(
                id=str(external_issue.id),
                issue_id=str(external_issue.group_id),
                service_type=external_issue.service_type,
                display_name=external_issue.display_name,
                web_url=external_issue.web_url,
            )
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
                    webhook_context={},
                    status_code=404,
                ),
            )

        deletions.exec_sync(platform_external_issue)

        return RpcEmptyResult()

    def get_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
    ) -> RpcServiceHookProjectsResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_service_hook_projects.py @ GET
        """
        try:
            hook = ServiceHook.objects.get(
                installation_id=installation.id, organization_id=organization_id
            )
        except ServiceHook.DoesNotExist:
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Service hook not found for installation",
                    webhook_context={},
                    status_code=404,
                )
            )

        hook_projects = ServiceHookProject.objects.filter(service_hook_id=hook.id).order_by(
            "project_id"
        )

        return RpcServiceHookProjectsResult(
            service_hook_projects=[
                RpcServiceHookProject(id=hp.id, project_id=hp.project_id) for hp in hook_projects
            ],
        )

    def set_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        project_ids: list[int],
    ) -> RpcServiceHookProjectsResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_service_hook_projects.py @ POST
        """
        from django.db import router, transaction

        if not project_ids:
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Projects list cannot be empty",
                    webhook_context={},
                    status_code=400,
                )
            )

        unique_project_ids = set(project_ids)
        valid_project_count = Project.objects.filter(
            organization_id=organization_id, id__in=unique_project_ids
        ).count()
        if valid_project_count != len(unique_project_ids):
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="One or more project IDs do not belong to the organization",
                    webhook_context={},
                    status_code=400,
                )
            )

        try:
            hook = ServiceHook.objects.get(
                installation_id=installation.id, organization_id=organization_id
            )
        except ServiceHook.DoesNotExist:
            return RpcServiceHookProjectsResult(
                error=RpcSentryAppError(
                    message="Service hook not found for installation",
                    webhook_context={},
                    status_code=404,
                )
            )

        new_project_ids = set(project_ids)

        with transaction.atomic(router.db_for_write(ServiceHookProject)):
            existing_project_ids = set(
                ServiceHookProject.objects.filter(service_hook_id=hook.id).values_list(
                    "project_id", flat=True
                )
            )

            projects_to_add = new_project_ids - existing_project_ids
            projects_to_remove = existing_project_ids - new_project_ids

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
            service_hook_projects=[
                RpcServiceHookProject(id=hp.id, project_id=hp.project_id) for hp in hook_projects
            ],
        )

    def delete_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
    ) -> RpcEmptyResult:
        """
        Matches: src/sentry/sentry_apps/api/endpoints/installation_service_hook_projects.py @ DELETE
        """
        try:
            hook = ServiceHook.objects.get(
                installation_id=installation.id, organization_id=organization_id
            )
        except ServiceHook.DoesNotExist:
            return RpcEmptyResult(
                success=False,
                error=RpcSentryAppError(
                    message="Service hook not found for installation",
                    webhook_context={},
                    status_code=404,
                ),
            )

        hook_projects = ServiceHookProject.objects.filter(service_hook_id=hook.id)
        deletions.exec_sync_many(list(hook_projects))

        return RpcEmptyResult()

    def get_interaction_stats(
        self,
        *,
        organization_id: int,
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
            "tenant_ids": {"organization_id": organization_id},
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
        organization_id: int,
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
                        webhook_context={},
                        status_code=400,
                    ),
                )
            key = self.get_component_interaction_key(sentry_app.slug, component_type)
        elif model == TSDBModel.sentry_app_viewed:
            key = sentry_app.id
        else:
            return RpcEmptyResult(
                success=False,
                error=RpcSentryAppError(
                    message="The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted",
                    webhook_context={},
                    status_code=400,
                ),
            )

        # Timestamp is automatically created
        tsdb.backend.incr(model, key)

        return RpcEmptyResult()
