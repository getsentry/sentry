from uuid import uuid4

from django.db import router, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSerializer as ModelTeamSerializer
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.models.team import Team, TeamStatus


class TeamSerializer(CamelSnakeModelSerializer):
    slug = SentrySerializerSlugField(
        max_length=50,
    )

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


@region_silo_endpoint
class TeamDetailsEndpoint(TeamEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, team) -> Response:
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

    def put(self, request: Request, team) -> Response:
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
        :param string orgRole: an organization role for the team. Only
                               owners can set this value.
        :auth: required
        """
        serializer = TeamSerializer(team, data=request.data, partial=True)
        if serializer.is_valid():
            team = serializer.save()

            data = team.get_audit_log_data()
            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=audit_log.get_event_id("TEAM_EDIT"),
                data=data,
            )

            return Response(serialize(team, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request: Request, team) -> Response:
        """
        Delete a Team
        `````````````

        Schedules a team for deletion.

        **Note:** Deletion happens asynchronously and therefore is not
        immediate. Teams will have their slug released while waiting for deletion.
        """
        suffix = uuid4().hex
        new_slug = f"{team.slug}-{suffix}"[0:50]
        try:
            with transaction.atomic(router.db_for_write(Team)):
                team = Team.objects.get(id=team.id, status=TeamStatus.ACTIVE)
                team.update(slug=new_slug, status=TeamStatus.PENDING_DELETION)
                scheduled = RegionScheduledDeletion.schedule(team, days=0, actor=request.user)
            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=audit_log.get_event_id("TEAM_REMOVE"),
                data=team.get_audit_log_data(),
                transaction_id=scheduled.id,
            )
        except Team.DoesNotExist:
            pass

        return Response(status=204)
