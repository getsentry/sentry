from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import comment_deleted, comment_updated
from sentry.types.activity import ActivityType


@region_silo_endpoint
class GroupNotesDetailsEndpoint(GroupEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }

    # We explicitly don't allow a request with an ApiKey
    # since an ApiKey is bound to the Organization, not
    # an individual. Not sure if we'd want to allow an ApiKey
    # to delete/update other users' comments
    def delete(self, request: Request, group: Group, note_id: str) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to delete Note")

        notes_by_user = Activity.objects.filter(
            group=group, type=ActivityType.NOTE.value, user_id=request.user.id
        )
        if not len(notes_by_user):
            raise ResourceDoesNotExist

        user_note = [n for n in notes_by_user if n.id == int(note_id)]
        if not user_note or len(user_note) > 1:
            raise ResourceDoesNotExist
        note = user_note[0]

        webhook_data = {
            "comment_id": note.id,
            "timestamp": note.datetime,
            "comment": note.data.get("text"),
            "project_slug": note.project.slug,
        }

        note.delete()

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

    def put(self, request: Request, group: Group, note_id: str) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to edit Note")

        try:
            note = Activity.objects.get(
                group=group, type=ActivityType.NOTE.value, user_id=request.user.id, id=note_id
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = NoteSerializer(data=request.data, context={"organization": group.organization})

        if serializer.is_valid():
            payload = serializer.validated_data
            # TODO: adding mentions to a note doesn't send notifications. Should it?
            # Remove mentions as they shouldn't go into the database
            payload.pop("mentions", [])

            # Would be nice to have a last_modified timestamp we could bump here
            note.data.update(dict(payload))
            note.save()

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
            return Response(serialize(note, request.user), status=200)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
