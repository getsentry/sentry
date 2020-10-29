from __future__ import absolute_import

import logging
from uuid import uuid4

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, Team, TeamStatus
from sentry.tasks.deletion import delete_team

delete_logger = logging.getLogger("sentry.deletions.api")


class TeamSerializer(serializers.ModelSerializer):
    slug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50)

    class Meta:
        model = Team
        fields = ("name", "slug")

    def validate_slug(self, value):
        qs = Team.objects.filter(slug=value, organization=self.instance.organization).exclude(
            id=self.instance.id
        )
        if qs.exists():
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value,))
        return value


class TeamDetailsEndpoint(TeamEndpoint):
    def get(self, request, team):
        """
        Retrieve a Team
        ```````````````

        Return details on an individual team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :auth: required
        """
        context = serialize(team, request.user)
        context["organization"] = serialize(team.organization, request.user)

        return Response(context)

    def put(self, request, team):
        """
        Update a Team
        `````````````

        Update various attributes and configurable settings for the given
        team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :param string name: the new name for the team.
        :param string slug: a new slug for the team.  It has to be unique
                            and available.
        :auth: required
        """
        serializer = TeamSerializer(team, data=request.data, partial=True)
        if serializer.is_valid():
            team = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_EDIT,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, team):
        """
        Delete a Team
        `````````````

        Schedules a team for deletion.

        **Note:** Deletion happens asynchronously and therefore is not
        immediate.  However once deletion has begun the state of a project
        changes and will be hidden from most public views.
        """
        updated = Team.objects.filter(id=team.id, status=TeamStatus.VISIBLE).update(
            status=TeamStatus.PENDING_DELETION
        )
        if updated:
            transaction_id = uuid4().hex

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_REMOVE,
                data=team.get_audit_log_data(),
                transaction_id=transaction_id,
            )

            delete_team.apply_async(kwargs={"object_id": team.id, "transaction_id": transaction_id})

            delete_logger.info(
                "object.delete.queued",
                extra={
                    "object_id": team.id,
                    "transaction_id": transaction_id,
                    "model": type(team).__name__,
                },
            )

        return Response(status=204)
