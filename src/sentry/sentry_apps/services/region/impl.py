from typing import Any

from sentry import deletions
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.sentry_apps.external_issues.external_issue_creator import ExternalIssueCreator
from sentry.sentry_apps.external_issues.issue_link_creator import IssueLinkCreator
from sentry.sentry_apps.external_requests.select_requester import SelectRequester
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.services.region.model import (
    RpcEmptyResult,
    RpcPlatformExternalIssue,
    RpcPlatformExternalIssueResult,
    RpcSelectRequesterResult,
    RpcSentryAppError,
)
from sentry.sentry_apps.services.region.service import SentryAppRegionService
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.users.services.user import RpcUser


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
