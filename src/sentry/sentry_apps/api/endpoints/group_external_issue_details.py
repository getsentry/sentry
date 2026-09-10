from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import deletions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log import (
    SYSTEM_ACTOR,
    GroupActionActor,
    publish_action,
    resolve_action_source,
)
from sentry.issues.action_log.types import UnlinkPlatformExternalIssueAction
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class GroupExternalIssueDetailsEndpoint(GroupEndpoint):
    owner = ApiOwner.PROJECT_MANAGEMENT_INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="deleteOrganizationIssueExternalIssue",
        summary="Unlink a Custom Integration's External Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            OpenApiParameter(
                name="external_issue_id",
                location="path",
                required=True,
                type=str,
                description="The ID of the custom integration issue link to remove.",
            ),
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-external-issues-details",
        url_names=["sentry-api-0-group-external-issues-details"],
    )
    def delete(self, request: Request, external_issue_id, group) -> Response[None]:
        """Remove a custom integration's association with a Sentry issue. The external issue is not deleted."""
        try:
            external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id, group_id=group.id
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        publish_action(
            UnlinkPlatformExternalIssueAction(
                service_type=external_issue.service_type,
                display_name=external_issue.display_name,
                web_url=external_issue.web_url,
            ),
            source=resolve_action_source(request),
            group_id=group.id,
            project=group.project,
            actor=(
                GroupActionActor.user(request.user.id)
                if request.user.is_authenticated
                else SYSTEM_ACTOR
            ),
        )

        deletions.exec_sync(external_issue)

        return Response(status=204)
