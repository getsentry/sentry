from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers.models.activity import (
    GroupNoteSerializerResponse,
    serialize_group_notes,
)
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log.read_metrics import (
    ActivityReadResult,
    activity_read_endpoint,
    record_activity_read,
)
from sentry.issues.action_log.request import resolve_action_source
from sentry.issues.comments import create_comment
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.types.activity import ActivityType


@cell_silo_endpoint
class GroupNotesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        responses={
            200: inline_sentry_response_serializer(
                "ListGroupNotes", list[GroupNoteSerializerResponse]
            )
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-notes",
        url_names=["sentry-api-0-group-notes"],
    )
    def get(self, request: Request, group: Group) -> Response:
        notes = Activity.objects.filter(group=group, type=ActivityType.NOTE.value)

        response = self.paginate(
            request=request,
            queryset=notes,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=lambda page: serialize_group_notes(group, page, request.user),
        )
        record_activity_read(activity_read_endpoint(request), ActivityReadResult.ACTIVITY)
        return response

    @extend_schema(
        request=NoteSerializer,
        responses={
            201: inline_sentry_response_serializer("CreateGroupNote", GroupNoteSerializerResponse)
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-notes",
        url_names=["sentry-api-0-group-notes"],
    )
    def post(self, request: Request, group: Group) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to create Note")

        serializer = NoteSerializer(
            data=request.data,
            context={
                "organization": group.organization,
                "organization_id": group.organization.id,
                "projects": [group.project],
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = dict(serializer.validated_data)
        if "mentions" in data:
            data["mentions"] = [m.dict() for m in data["mentions"]]

        activity = create_comment(
            group=group, user=request.user, data=data, source=resolve_action_source(request)
        )
        if activity is None:
            return Response(
                {"detail": "You have already posted that comment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record_activity_read(activity_read_endpoint(request), ActivityReadResult.ACTIVITY)
        return Response(serialize_group_notes(group, [activity], request.user)[0], status=201)
