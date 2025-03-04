from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.types import SerializedAvatarFields
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
    }


class RelaxedProjectAndStaffPermission(StaffPermissionMixin, RelaxedProjectPermission):
    pass


class ProjectOverviewResponse(TypedDict, total=False):
    id: str
    slug: str
    name: str
    platform: str | None
    dateCreated: datetime
    firstEvent: datetime | None
    firstTransactionEvent: bool
    access: list[str]
    hasFeedbacks: bool
    hasFlags: bool
    hasMinifiedStackTrace: bool
    hasMonitors: bool
    hasNewFeedbacks: bool
    hasProfiles: bool
    hasReplays: bool
    hasSessions: bool
    hasInsightsHttp: bool
    hasInsightsDb: bool
    hasInsightsAssets: bool
    hasInsightsAppStart: bool
    hasInsightsScreenLoad: bool
    hasInsightsVitals: bool
    hasInsightsCaches: bool
    hasInsightsQueues: bool
    hasInsightsLlmMonitoring: bool

    isInternal: bool
    isPublic: bool
    avatar: SerializedAvatarFields
    color: str
    status: str


STATUS_LABELS = {
    ObjectStatus.ACTIVE: "active",
    ObjectStatus.DISABLED: "deleted",
    ObjectStatus.PENDING_DELETION: "deleted",
    ObjectStatus.DELETION_IN_PROGRESS: "deleted",
}


class ProjectOverviewSerializer(Serializer):
    def serialize(
        self,
        obj: Project,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ProjectOverviewResponse:
        status_label = STATUS_LABELS.get(obj.status, "unknown")

        context: ProjectOverviewResponse = {
            "id": str(obj.id),
            "slug": obj.slug,
            "name": obj.name,  # Deprecated
            "platform": obj.platform,
            "dateCreated": obj.date_added,
            "firstEvent": obj.first_event,
            "firstTransactionEvent": bool(obj.flags.has_transactions),
            "hasMinifiedStackTrace": bool(obj.flags.has_minified_stack_trace),
            "hasMonitors": bool(obj.flags.has_cron_monitors),
            "hasProfiles": bool(obj.flags.has_profiles),
            "hasReplays": bool(obj.flags.has_replays),
            "hasFeedbacks": bool(obj.flags.has_feedbacks),
            "hasFlags": bool(obj.flags.has_flags),
            "hasNewFeedbacks": bool(obj.flags.has_new_feedbacks),
            "hasSessions": bool(obj.flags.has_sessions),
            # whether first span has been sent for each insight module
            "hasInsightsHttp": bool(obj.flags.has_insights_http),
            "hasInsightsDb": bool(obj.flags.has_insights_db),
            "hasInsightsAssets": bool(obj.flags.has_insights_assets),
            "hasInsightsAppStart": bool(obj.flags.has_insights_app_start),
            "hasInsightsScreenLoad": bool(obj.flags.has_insights_screen_load),
            "hasInsightsVitals": bool(obj.flags.has_insights_vitals),
            "hasInsightsCaches": bool(obj.flags.has_insights_caches),
            "hasInsightsQueues": bool(obj.flags.has_insights_queues),
            "hasInsightsLlmMonitoring": bool(obj.flags.has_insights_llm_monitoring),
            "isInternal": obj.is_internal_project(),
            "isPublic": obj.public,
            # Projects don't have avatar uploads, but we need to maintain the payload shape for
            # compatibility.
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "color": obj.color,
            "status": status_label,
        }
        return context


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectOverviewEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (RelaxedProjectAndStaffPermission,)

    @extend_schema(
        operation_id="Retrieve a Project overview",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=None,
        responses={
            200: ProjectOverviewSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.OVERVIEW_PROJECT,
        summary=(
            "Retrieve a Project overview. This endpoint returns an overview of an individual "
            "project. This only returns high-level information of the project, for more detailed "
            "information use the project details endpoint."
        ),
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        Return details on an individual project.
        """
        data = serialize(project, request.user, ProjectOverviewSerializer())
        return Response(data)
