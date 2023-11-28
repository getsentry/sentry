from __future__ import annotations

from typing import Any, Generic, TypeVar

from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SignedRequestAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.db.models.base import BaseModel
from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications.service import notifications_service

T = TypeVar("T", bound=BaseModel)


class OrganizationUnsubscribeBase(Endpoint, Generic[T]):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.HYBRID_CLOUD
    authentication_classes = (SignedRequestAuthentication,)
    permission_classes = ()

    object_type = "unknown"

    def fetch_instance(self, request: Request, organization_slug: str, id: int) -> T:
        raise NotImplementedError()

    def unsubscribe(self, request: Request, instance: T):
        raise NotImplementedError()

    def add_instance_data(self, data: dict[str, Any], instance: T) -> dict[str, Any]:
        return data

    def get(self, request: Request, organization_slug: str, id: int, **kwargs) -> Response:
        if not request.user_from_signed_request:
            raise NotFound()
        instance = self.fetch_instance(request, organization_slug, id)
        view_url = ""
        if hasattr(instance, "get_absolute_url"):
            view_url = str(instance.get_absolute_url())
        display_name = ""
        user = request.user
        if hasattr(user, "get_display_name"):
            display_name = str(user.get_display_name())

        data = {
            "viewUrl": view_url,
            "type": self.object_type,
            "displayName": display_name,
        }
        return Response(self.add_instance_data(data, instance), 200)

    def post(self, request: Request, organization_slug: str, id: int, **kwargs) -> Response:
        if not request.user_from_signed_request:
            raise NotFound()
        instance = self.fetch_instance(request, organization_slug, id)

        if request.data.get("cancel"):
            self.unsubscribe(request, instance)
        return Response(status=201)


@region_silo_endpoint
class OrganizationUnsubscribeProject(OrganizationUnsubscribeBase[Project]):
    object_type = "project"

    def fetch_instance(self, request: Request, organization_slug: str, id: int) -> Project:
        try:
            project = Project.objects.select_related("organization").get(id=id)
        except Project.DoesNotExist:
            raise NotFound()
        if project.organization.slug != organization_slug:
            raise NotFound()
        if not OrganizationMember.objects.filter(
            user_id=request.user.pk, organization_id=project.organization_id
        ).exists():
            raise NotFound()
        return project

    def add_instance_data(self, data: dict[str, Any], instance: Project) -> dict[str, Any]:
        data["slug"] = instance.slug

        return data

    def unsubscribe(self, request: Request, instance: Project):
        notifications_service.update_notification_options(
            actor=RpcActor(id=request.user.pk, actor_type=ActorType.USER),
            type=NotificationSettingEnum.ISSUE_ALERTS,
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=instance.id,
            value=NotificationSettingsOptionEnum.NEVER,
        )


@region_silo_endpoint
class OrganizationUnsubscribeIssue(OrganizationUnsubscribeBase[Group]):
    object_type = "issue"

    def fetch_instance(self, request: Request, organization_slug: str, issue_id: int) -> Group:
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

    def unsubscribe(self, request: Request, instance: Group):
        GroupSubscription.objects.create_or_update(
            group=instance,
            project_id=instance.project_id,
            user_id=request.user.pk,
            values={"is_active": False},
        )
