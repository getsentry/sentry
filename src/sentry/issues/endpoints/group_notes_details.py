import logging

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
from sentry.issues.action_log.types import GroupActionType, SentryActorRef
from sentry.issues.comments import delete_comment, update_comment
from sentry.issues.derived.gate import should_serve_action_log_activity
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.types.activity import ActivityType
from sentry.utils.action_log.activity_translator import activity_action_idempotency_key

logger = logging.getLogger(__name__)


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

        notes_by_user = Activity.objects.filter(
            group=group, type=ActivityType.NOTE.value, user_id=request.user.id
        )
        if not len(notes_by_user):
            raise ResourceDoesNotExist

        user_note = [n for n in notes_by_user if n.id == note_id_int]
        if not user_note or len(user_note) > 1:
            raise ResourceDoesNotExist
        note = user_note[0]

        # The Activity lookups above are what signal whether the note exists.
        # When the activity flag is on the GALE is authoritative for existence,
        # so a missing entry means it's already gone -> 404 rather than deleting
        # nothing and returning 204. With the activity flag off we rely on the
        # Activity alone and preserve the pre-existing behavior.
        original_comment_log_action = GroupActionLogEntry.objects.filter(
            group_id=group.id,
            type=GroupActionType.COMMENT.value,
            idempotency_key=activity_action_idempotency_key(note),
        ).first()
        endpoint = activity_read_endpoint(request)
        serve_from_log = should_serve_action_log_activity(
            group.project, request.user, endpoint=endpoint
        )
        if serve_from_log:
            # The log is authoritative for existence whether or not the entry is
            # there: a missing one means the comment is already gone.
            record_activity_read(endpoint, ActivityReadResult.GAL)
        if original_comment_log_action is None and serve_from_log:
            raise ResourceDoesNotExist

        try:
            delete_comment(
                note,
                user=request.user,
                source=resolve_action_source(request),
                original_action_id=original_comment_log_action.id
                if original_comment_log_action
                else None,
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

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
            mentions = [SentryActorRef(**mention.dict()) for mention in payload.pop("mentions", [])]

            # The Activity fetched above is what signals whether the note exists.
            # When the activity flag is on the GALE is authoritative for existence,
            # so a missing entry means it's already gone -> 404 rather than editing
            # the Activity and returning 200. With the activity flag off we rely
            # on the Activity alone and preserve the pre-existing behavior.
            original_comment_log_action = GroupActionLogEntry.objects.filter(
                group_id=group.id,
                type=GroupActionType.COMMENT.value,
                idempotency_key=activity_action_idempotency_key(note),
            ).first()
            endpoint = activity_read_endpoint(request)
            serve_from_log = should_serve_action_log_activity(
                group.project, request.user, endpoint=endpoint
            )
            if serve_from_log:
                record_activity_read(endpoint, ActivityReadResult.GAL)
            if original_comment_log_action is None and serve_from_log:
                raise ResourceDoesNotExist

            try:
                note = update_comment(
                    note,
                    user=request.user,
                    data=dict(payload),
                    mentions=mentions,
                    source=resolve_action_source(request),
                    original_action_id=original_comment_log_action.id
                    if original_comment_log_action
                    else None,
                )
            except Activity.DoesNotExist:
                raise ResourceDoesNotExist

            return Response(serialize_group_notes(group, [note], request.user)[0], status=200)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
