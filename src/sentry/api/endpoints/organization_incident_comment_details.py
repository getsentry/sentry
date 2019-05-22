from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases.incident import (
    IncidentEndpoint,
    IncidentPermission,
)
from sentry.api.serializers import serialize
from sentry.incidents.models import IncidentActivity
from sentry.incidents.logic import (
    delete_comment,
    update_comment,
)


class CommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False)


class OrganizationIncidentCommentDetailsEndpoint(IncidentEndpoint):
    # See GroupNotesDetailsEndpoint:
    #   We explicitly don't allow a request with an ApiKey
    #   since an ApiKey is bound to the Organization, not
    #   an individual. Not sure if we'd want to allow an ApiKey
    #   to delete/update other users' comments
    permission_classes = (IncidentPermission, )

    def delete(self, request, organization, incident, activity_id):
        """
        Delete a comment
        ````````````````
        :auth: required
        """

        if not request.user.is_authenticated():
            raise PermissionDenied(detail="Key doesn't have permission to delete Note")

        try:
            delete_comment(incident=incident, user=request.user, activity_id=activity_id)
        except IncidentActivity.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(status=204)

    def put(self, request, organization, incident, activity_id):
        """
        Update an existing comment
        ``````````````````````````
        :auth: required
        """

        if not request.user.is_authenticated():
            raise PermissionDenied(detail="Key doesn't have permission to delete Note")

        serializer = CommentSerializer(data=request.DATA)
        if serializer.is_valid():
            result = serializer.object

            try:
                comment = update_comment(
                    incident=incident,
                    activity_id=activity_id,
                    user=request.user,
                    comment=result.get('comment'),
                )
            except IncidentActivity.DoesNotExist:
                raise ResourceDoesNotExist

            return Response(serialize(comment, request.user), status=200)
        return Response(serializer.errors, status=400)
