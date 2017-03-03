from __future__ import absolute_import

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.group_notes import NoteSerializer
from sentry.models import Activity


class GroupNotesDetailsEndpoint(GroupEndpoint):
    # We explicitly don't allow a request with an ApiKey
    # since an ApiKey is bound to the Organization, not
    # an individual. Not sure if we'd want to allow an ApiKey
    # to delete/update other users' comments
    def delete(self, request, group, note_id):
        if not request.user.is_authenticated():
            raise PermissionDenied(detail="Key doesn't have permission to delete Note")

        try:
            note = Activity.objects.get(
                group=group,
                type=Activity.NOTE,
                user=request.user,
                id=note_id,
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

        note.delete()

        return Response(status=204)

    def put(self, request, group, note_id):
        if not request.user.is_authenticated():
            raise PermissionDenied(detail="Key doesn't have permission to edit Note")

        try:
            note = Activity.objects.get(
                group=group,
                type=Activity.NOTE,
                user=request.user,
                id=note_id,
            )
        except Activity.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = NoteSerializer(data=request.DATA)

        if serializer.is_valid():
            # Would be nice to have a last_modified timestamp we could bump here
            note.data = dict(serializer.object)
            note.save()

            return Response(serialize(note, request.user), status=200)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
