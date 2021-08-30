from uuid import uuid4

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSerializer as ModelTeamSerializer
from sentry.models import AuditLogEntryEvent, ScheduledDeletion, Team, TeamStatus


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
            raise serializers.ValidationError(f'The slug "{value}" is already in use.')
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
        :qparam list expand: an optional list of strings to opt in to additional
            data. Supports `projects`, `externalTeams`.
        :qparam list collapse: an optional list of strings to opt out of certain
            pieces of data. Supports `organization`.
        :auth: required
        """
        collapse = request.GET.getlist("collapse", [])
        expand = request.GET.getlist("expand", [])

        # A little hack to preserve existing behavior.
        if "organization" in collapse:
            collapse.remove("organization")
        else:
            expand.append("organization")

        return Response(
            serialize(team, request.user, ModelTeamSerializer(collapse=collapse, expand=expand))
        )

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
        immediate. Teams will have their slug released while waiting for deletion.
        """
        suffix = uuid4().hex
        new_slug = f"{team.slug}-{suffix}"[0:50]
        updated = Team.objects.filter(id=team.id, status=TeamStatus.VISIBLE).update(
            slug=new_slug, status=TeamStatus.PENDING_DELETION
        )
        if updated:
            scheduled = ScheduledDeletion.schedule(team, days=0, actor=request.user)
            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_REMOVE,
                data=team.get_audit_log_data(),
                transaction_id=scheduled.id,
            )

        return Response(status=204)
