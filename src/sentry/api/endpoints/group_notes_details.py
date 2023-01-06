from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.models import Activity
from sentry.signals import comment_deleted, comment_updated
from sentry.types.activity import ActivityType


@region_silo_endpoint
class GroupNotesDetailsEndpoint(GroupEndpoint):
    # We explicitly don't allow a request with an ApiKey
    # since an ApiKey is bound to the Organization, not
    # an individual. Not sure if we'd want to allow an ApiKey
    # to delete/update other users' comments
    def delete(self, request: Request, group, note_id) -> Response:
        if not request.user.is_authenticated:
            raise PermissionDenied(detail="Key doesn't have permission to delete Note")

        try:
            note = Activity.objects.get(
                group=group, type=ActivityType.NOTE.value, user_id=request.user.id, id=note_id
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

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

        return Response(status=204)

    def put(self, request: Request, group, note_id) -> Response:
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
            # TODO adding mentions to a note doesn't do subscriptions
            # or notifications. Should it?
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
