from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SignedRequestAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import Endpoint
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications.service import notifications_service
from sentry.types.integrations import ExternalProviders


@region_silo_endpoint
class OrganizationUnsubscribeProject(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.HYBRID_CLOUD
    authentication_classes = (SignedRequestAuthentication,)
    permission_classes = ()

    def get_project(self, request: Request, organization_slug: str, project_id: int) -> Project:
        # For now we only support getting here from the signed link.
        if not request.user_from_signed_request:
            raise NotFound()
        try:
            project = Project.objects.select_related("organization").get(id=project_id)
        except Project.DoesNotExist:
            raise NotFound()
        if project.organization.slug != organization_slug:
            raise NotFound()
        if not OrganizationMember.objects.filter(
            user_id=request.user.pk, organization_id=project.organization_id
        ).exists():
            raise NotFound()
        return project

    def get(self, request: Request, organization_slug: str, project_id: int, **kwargs) -> Response:
        project = self.get_project(request, organization_slug, project_id)
        data = {
            "viewUrl": project.get_absolute_url(),
            "type": "project",
            "slug": project.slug,
        }
        return Response(data, 200)

    def post(self, request: Request, organization_slug: str, project_id: int, **kwargs) -> Response:
        project = self.get_project(request, organization_slug, project_id)

        if request.data.get("cancel"):
            notifications_service.update_settings(
                external_provider=ExternalProviders.EMAIL,
                notification_type=NotificationSettingTypes.ISSUE_ALERTS,
                setting_option=NotificationSettingOptionValues.NEVER,
                actor=RpcActor(id=request.user.pk, actor_type=ActorType.USER),
                project_id=project.id,
            )
        return Response(status=201)
