from rest_framework.request import Request
from rest_framework.response import Response

from sentry import deletions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log import ActionType, publish_action, resolve_action_source
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue


@cell_silo_endpoint
class GroupExternalIssueDetailsEndpoint(GroupEndpoint):
    owner = ApiOwner.PROJECT_MANAGEMENT_INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-external-issues-details"])
    def delete(self, request: Request, external_issue_id, group) -> Response:
        try:
            external_issue = PlatformExternalIssue.objects.get(
                id=external_issue_id, group_id=group.id
            )
        except PlatformExternalIssue.DoesNotExist:
            return Response(status=404)

        deletions.exec_sync(external_issue)

        publish_action(
            action=ActionType.UNLINK_EXTERNAL_ISSUE,
            source=resolve_action_source(request),
            group_id=group.id,
            organization_id=group.project.organization_id,
            project_id=group.project_id,
            actor_id=request.user.id if request.user.is_authenticated else None,
            metadata={"external_issue_display_name": external_issue.display_name},
        )

        return Response(status=204)
