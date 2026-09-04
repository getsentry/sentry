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
from sentry.api.serializers import serialize
from sentry.api.serializers.models.activity import ActivitySerializerResponse
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import RESPONSE_NO_CONTENT
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log import (
    GroupActionActor,
    publish_action,
    resolve_action_source,
)
from sentry.issues.action_log.types import CommentDeleteAction, CommentEditAction
from sentry.issues.derived.gate import should_serve_action_log_activity
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import comment_deleted, comment_updated
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
            idempotency_key=activity_action_idempotency_key(note),
        ).first()
        if original_comment_log_action is None and should_serve_action_log_activity(
            group.project, request.user
        ):
            raise ResourceDoesNotExist

        webhook_data = {
            "comment_id": note.id,
            "timestamp": note.datetime,
            "comment": note.data.get("text"),
            "project_slug": note.project.slug,
        }

        note.delete()

        if original_comment_log_action is not None:
            publish_action(
                CommentDeleteAction(comment_id=original_comment_log_action.id),
                source=resolve_action_source(request),
                group_id=group.id,
                project=group.project,
                actor=GroupActionActor.user(request.user.id),
            )
        else:
            logger.info("group_notes.groupactionlogentry.not_found", extra={"group_id": group.id})

        comment_deleted.send_robust(
            project=group.project,
            user=request.user,
            group=group,
            data=webhook_data,
            sender="delete",
        )
        # if the user left more than one comment, we want to keep the subscription
        if len(notes_by_user) == 1:
            GroupSubscription.objects.filter(
                user_id=request.user.id,
                group=group,
                project=group.project,
                reason=GroupSubscriptionReason.comment,
            ).delete()

        return Response(status=204)

    @extend_schema(
        request=NoteSerializer,
        responses={
            200: inline_sentry_response_serializer("UpdateGroupNote", ActivitySerializerResponse)
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
            mentions = [mention.dict() for mention in payload.pop("mentions", [])]

            # The Activity fetched above is what signals whether the note exists.
            # When the activity flag is on the GALE is authoritative for existence,
            # so a missing entry means it's already gone -> 404 rather than editing
            # the Activity and returning 200. With the activity flag off we rely
            # on the Activity alone and preserve the pre-existing behavior.
            original_comment_log_action = GroupActionLogEntry.objects.filter(
                group_id=group.id,
                idempotency_key=activity_action_idempotency_key(note),
            ).first()
            if original_comment_log_action is None and should_serve_action_log_activity(
                group.project, request.user
            ):
                raise ResourceDoesNotExist

            # Would be nice to have a last_modified timestamp we could bump here
            note.data.update(dict(payload))
            note.save()

            if original_comment_log_action is not None:
                publish_action(
                    CommentEditAction(
                        comment_id=original_comment_log_action.id,
                        text=payload.get("text"),
                        mentions=mentions,
                    ),
                    source=resolve_action_source(request),
                    group_id=group.id,
                    project=group.project,
                    actor=GroupActionActor.user(request.user.id),
                )
            else:
                logger.info(
                    "group_notes.groupactionlogentry.not_found", extra={"group_id": group.id}
                )

            if note.data.get("external_id"):
                self.update_external_comment(request, group, note)

            webhook_data = {
                "comment_id": note.id,
                "timestamp": note.datetime,
                "comment": note.data.get("text"),
                "project_slug": note.project.slug,
            }

            comment_updated.send_robust(
                project=group.project,
                user=request.user,
                group=group,
                data=webhook_data,
                sender="put",
            )

            if should_serve_action_log_activity(group.project, request.user):
                if original_comment_log_action is not None:
                    # editing a note doesn't update its COMMENT entry (instead it
                    # appends a separate COMMENT_EDIT entry), so patch in the fresh
                    # text we just published to GALE. The serializer resolves `id`
                    # back to the Activity id from the entry's comment_id, matching
                    # the flag-off contract so clients can edit/delete via note_id.
                    original_comment_log_action.data = {
                        **original_comment_log_action.data,
                        "text": payload.get("text"),
                    }
                    return Response(
                        serialize(original_comment_log_action, request.user), status=200
                    )

            return Response(serialize(note, request.user), status=200)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
