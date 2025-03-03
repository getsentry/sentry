from collections.abc import Sequence
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectMoved, ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.projectredirect import ProjectRedirect
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.sdk import Scope, bind_organization_context


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        # PUT checks for permissions based on fields
        "PUT": ["project:read", "project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class RelaxedProjectAndStaffPermission(StaffPermissionMixin, RelaxedProjectPermission):
    pass


class SerializedAvatarFields(TypedDict, total=False):
    avatarType: str
    avatarUuid: str | None
    avatarUrl: str | None


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
    def get_attrs(
        self, item_list: Sequence[Project], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> dict[Project, dict[str, Any]]:
        return {}

    def serialize(
        self,
        obj: Project,
        attrs: dict[str, Any],
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
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (RelaxedProjectAndStaffPermission,)

    def convert_args(
        self,
        request: Request,
        *args,
        **kwargs,
    ):
        if args and args[0] is not None:
            organization_id_or_slug: int | str = args[0]
            # Required so it behaves like the original convert_args, where organization_id_or_slug was another parameter
            # TODO: Remove this once we remove the old `organization_slug` parameter from getsentry
            args = args[1:]
        else:
            organization_id_or_slug = kwargs.pop("organization_id_or_slug", None) or kwargs.pop(
                "organization_slug"
            )

        if args and args[0] is not None:
            project_id_or_slug: int | str = args[0]
            # Required so it behaves like the original convert_args, where project_id_or_slug was another parameter
            args = args[1:]
        else:
            project_id_or_slug = kwargs.pop("project_id_or_slug", None) or kwargs.pop(
                "project_slug"
            )

        try:
            project = (
                Project.objects.filter(
                    organization__slug__id_or_slug=organization_id_or_slug,
                    slug__id_or_slug=project_id_or_slug,
                )
                .select_related("organization")
                .get()
            )
        except Project.DoesNotExist:
            try:
                # Project may have been renamed
                # This will only happen if the passed in project_id_or_slug is a slug and not an id
                redirect = ProjectRedirect.objects.select_related("project").get(
                    organization__slug__id_or_slug=organization_id_or_slug,
                    redirect_slug=project_id_or_slug,
                )
                # Without object permissions don't reveal the rename
                self.check_object_permissions(request, redirect.project)

                # get full path so that we keep query strings
                requested_url = request.get_full_path()
                new_url = requested_url.replace(
                    f"projects/{organization_id_or_slug}/{project_id_or_slug}/overview/",
                    f"projects/{organization_id_or_slug}/{redirect.project.slug}/overview/",  # TODO: get actual path for redirect
                )

                # Resource was moved/renamed if the requested url is different than the new url
                if requested_url != new_url:
                    raise ProjectMoved(new_url, redirect.project.slug)

                # otherwise project doesn't exist
                raise ResourceDoesNotExist
            except ProjectRedirect.DoesNotExist:
                raise ResourceDoesNotExist

        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        Scope.get_isolation_scope().set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization  # type: ignore[attr-defined]  # XXX: we should not be stuffing random attributes into HttpRequest

        kwargs["project"] = project
        return (args, kwargs)

    @extend_schema(
        operation_id="Retrieve a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=None,
        responses={
            200: ProjectOverviewSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.OVERVIEW_PROJECT,
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        Return details on an individual project.
        """
        data = serialize(project, request.user, ProjectOverviewSerializer())

        return Response(data)
