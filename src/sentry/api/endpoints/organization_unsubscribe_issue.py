from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SignedRequestAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationmember import OrganizationMember


@region_silo_endpoint
class OrganizationUnsubscribeIssue(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.HYBRID_CLOUD
    authentication_classes = (SignedRequestAuthentication,)
    permission_classes = ()

    def get_issue(self, request: Request, organization_slug: str, issue_id: int) -> Group:
        if not request.user_from_signed_request:
            raise NotFound()
        try:
            issue = Group.objects.get_from_cache(id=issue_id)
        except Group.DoesNotExist:
            raise NotFound()
        if issue.organization.slug != organization_slug:
            raise NotFound()
        if not OrganizationMember.objects.filter(
            user_id=request.user.pk, organization=issue.organization
        ).exists():
            raise NotFound()
        return issue

    def get(self, request: Request, organization_slug: str, issue_id: int, **kwargs) -> Response:
        issue = self.get_issue(request, organization_slug, issue_id)
        data = {
            "viewUrl": issue.get_absolute_url(),
            "type": "issue",
            "slug": None,
        }
        return Response(data, 200)

    def post(self, request: Request, organization_slug: str, issue_id: int, **kwargs) -> Response:
        issue = self.get_issue(request, organization_slug, issue_id)

        if request.data.get("cancel"):
            GroupSubscription.objects.create_or_update(
                group=issue,
                project=issue.project,
                user_id=request.user.pk,
                values={"is_active": False},
            )
        return Response(status=201)
