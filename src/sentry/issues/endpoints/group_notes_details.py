from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers.models.activity import (
    GroupNoteSerializerResponse,
    serialize_group_notes,
)
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import RESPONSE_NO_CONTENT
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log.read_metrics import (
    ActivityReadResult,
    activity_read_endpoint,
    record_activity_read,
)
from sentry.issues.action_log.request import resolve_action_source
from sentry.issues.comments import delete_comment, update_comment
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.types.activity import ActivityType


@cell_silo_endpoint
class GroupNotesDetailsEndpoint(GroupEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    # We explicitly don't allow a request with an ApiKey
    # since an ApiKey is bound to the Organization, not
    # an individual. Not sure if we'd want to allow an ApiKey
    # to delete/update other users' comments
    @extend_schema(responses={204: RESPONSE_NO_CONTENT})
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-note-details",
        url_names=["sentry-api-0-group-note-details"],
    )
    def delete(self, request: Request, group: Group, note_id: str) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to delete Note")

        note_id_int = to_valid_int_id("note_id", note_id, raise_404=True)

        try:
            note = Activity.objects.get(
                group=group, type=ActivityType.NOTE.value, user_id=request.user.id, id=note_id_int
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            delete_comment(
                note,
                user=request.user,
                source=resolve_action_source(request),
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

        record_activity_read(activity_read_endpoint(request), ActivityReadResult.ACTIVITY)
        return Response(status=204)

    @extend_schema(
        request=NoteSerializer,
        responses={
            200: inline_sentry_response_serializer("UpdateGroupNote", GroupNoteSerializerResponse)
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-note-details",
        url_names=["sentry-api-0-group-note-details"],
    )
    def put(self, request: Request, group: Group, note_id: str) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to edit Note")

        note_id_int = to_valid_int_id("note_id", note_id, raise_404=True)

        try:
            note = Activity.objects.get(
                group=group, type=ActivityType.NOTE.value, user_id=request.user.id, id=note_id_int
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = NoteSerializer(data=request.data, context={"organization": group.organization})

        if serializer.is_valid():
            payload = serializer.validated_data
            # TODO: adding mentions to a note doesn't send notifications. Should it?
            # Remove mentions as they shouldn't go into the database
            payload.pop("mentions", None)

            try:
                note = update_comment(
                    note,
                    user=request.user,
                    data=dict(payload),
                    source=resolve_action_source(request),
                )
            except Activity.DoesNotExist:
                raise ResourceDoesNotExist

            record_activity_read(activity_read_endpoint(request), ActivityReadResult.ACTIVITY)
            return Response(serialize_group_notes(group, [note], request.user)[0], status=200)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
