from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.examples.sentry_app_examples import SentryAppExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializerResponse,
)
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue


@extend_schema(tags=["Integration"])
@region_silo_endpoint
class GroupExternalIssuesEndpoint(GroupEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve custom integration issue links for the given Sentry issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "GroupExternalIssueResponse", list[PlatformExternalIssueSerializerResponse]
            ),
        },
        examples=SentryAppExamples.GET_PLATFORM_EXTERNAL_ISSUE,
    )
    def get(self, request: Request, group) -> Response:
        """
        Retrieve custom integration issue links for the given Sentry issue

        """
        external_issues = PlatformExternalIssue.objects.filter(group_id=group.id)

        return self.paginate(
            request=request,
            queryset=external_issues,
            order_by="id",
            on_results=lambda x: serialize(x, request.user),
        )
