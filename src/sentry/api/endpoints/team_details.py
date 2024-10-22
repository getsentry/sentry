from uuid import uuid4

from django.db import router, transaction
from drf_spectacular.utils import extend_schema, extend_schema_serializer
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
from sentry.api.serializers.models.team import TeamSerializer as TeamRequestSerializer
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import GlobalParams, TeamParams
from sentry.db.models.fields.slug import DEFAULT_SLUG_MAX_LENGTH
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.team import Team, TeamStatus


@extend_schema_serializer(exclude_fields=["name"])
class TeamDetailsSerializer(CamelSnakeModelSerializer):
    slug = SentrySerializerSlugField(
        max_length=DEFAULT_SLUG_MAX_LENGTH,
        help_text="Uniquely identifies a team. This is must be available.",
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


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class TeamDetailsEndpoint(TeamEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    # OrganizationSCIMTeamDetails inherits this endpoint, but toggles this setting
    _allow_idp_changes = False

    def can_modify_idp_team(self, team: Team):
        if not team.idp_provisioned:
            return True
        return self._allow_idp_changes

    @extend_schema(
        operation_id="Retrieve a Team",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.TEAM_ID_OR_SLUG,
            TeamParams.EXPAND,
            TeamParams.COLLAPSE,
        ],
        responses={
            200: TeamRequestSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.RETRIEVE_TEAM_DETAILS,
    )
    def get(self, request: Request, team) -> Response:
        """
        Return details on an individual team.
        """
        collapse = request.GET.getlist("collapse", [])
        expand = request.GET.getlist("expand", [])

        # A little hack to preserve existing behavior.
        if "organization" in collapse:
            collapse.remove("organization")
        else:
            expand.append("organization")

        return Response(
            serialize(team, request.user, TeamRequestSerializer(collapse=collapse, expand=expand))
        )

    @extend_schema(
        operation_id="Update a Team",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.TEAM_ID_OR_SLUG],
        request=TeamDetailsSerializer,
        responses={
            200: TeamRequestSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.UPDATE_TEAM,
    )
    def put(self, request: Request, team) -> Response:
        """
        Update various attributes and configurable settings for the given
        team.
        """

        if not self.can_modify_idp_team(team):
            return Response(
                {"detail": "This team is managed through your organization's identity provider."},
                status=403,
            )

        serializer = TeamDetailsSerializer(team, data=request.data, partial=True)
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

    @extend_schema(
        operation_id="Delete a Team",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.TEAM_ID_OR_SLUG],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @sudo_required
    def delete(self, request: Request, team) -> Response:
        """
        Schedules a team for deletion.

        **Note:** Deletion happens asynchronously and therefore is not
        immediate. Teams will have their slug released while waiting for deletion.
        """

        if not self.can_modify_idp_team(team):
            return Response(
                {"detail": "This team is managed through your organization's identity provider."},
                status=403,
            )

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
