from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSerializer
from sentry.models import (
    AuditLogEntryEvent,
    ExternalActor,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
    TeamStatus,
)
from sentry.search.utils import tokenize_query
from sentry.signals import team_created

CONFLICTING_SLUG_ERROR = "A team with this slug already exists."


# OrganizationPermission + team:write
class OrganizationTeamsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin", "team:write"],
        "PUT": ["org:write", "org:admin", "team:write"],
        "DELETE": ["org:admin", "team:write"],
    }


class TeamPostSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_null=True, allow_blank=True)
    slug = serializers.RegexField(
        r"^[a-z0-9_\-]+$",
        max_length=50,
        required=False,
        allow_null=True,
        error_messages={
            "invalid": _(
                "Enter a valid slug consisting of lowercase letters, "
                "numbers, underscores or hyphens."
            )
        },
    )

    def validate(self, attrs):
        if not (attrs.get("name") or attrs.get("slug")):
            raise serializers.ValidationError("Name or slug is required")
        return attrs


class OrganizationTeamsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationTeamsPermission,)

    def team_serializer_for_post(self):
        # allow child routes to supply own serializer, used in SCIM teams route
        return TeamSerializer()

    def get(self, request, organization):
        """
        List an Organization's Teams
        ````````````````````````````

        Return a list of teams bound to a organization.

        :pparam string organization_slug: the slug of the organization for
                                          which the teams should be listed.
        :param string detailed: Specify "0" to return team details that do not include projects
        :auth: required
        """
        # TODO(dcramer): this should be system-wide default for organization
        # based endpoints
        if request.auth and hasattr(request.auth, "project"):
            return Response(status=403)

        queryset = Team.objects.filter(
            organization=organization, status=TeamStatus.VISIBLE
        ).order_by("slug")

        query = request.GET.get("query")

        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "hasExternalTeams":
                    has_external_teams = "true" in value
                    if has_external_teams:
                        queryset = queryset.filter(
                            actor_id__in=ExternalActor.objects.filter(
                                organization=organization
                            ).values_list("actor_id")
                        )
                    else:
                        queryset = queryset.exclude(
                            actor_id__in=ExternalActor.objects.filter(
                                organization=organization
                            ).values_list("actor_id")
                        )

                elif key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                elif key == "slug":
                    queryset = queryset.filter(slug__in=value)
                else:
                    queryset = queryset.none()

        is_detailed = request.GET.get("detailed", "1") != "0"

        expand = ["projects", "externalTeams"] if is_detailed else []

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=lambda x: serialize(x, request.user, TeamSerializer(expand=expand)),
            paginator_cls=OffsetPaginator,
        )

    def should_add_creator_to_team(self, request):
        return request.user.is_authenticated

    def post(self, request, organization, **kwargs):
        """
        Create a new Team
        ``````````````````

        Create a new team bound to an organization.  Only the name of the
        team is needed to create it, the slug can be auto generated.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string name: the optional name of the team.
        :param string slug: the optional slug for this team.  If
                            not provided it will be auto generated from the
                            name.
        :auth: required
        """
        serializer = TeamPostSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            try:
                with transaction.atomic():
                    team = Team.objects.create(
                        name=result.get("name") or result["slug"],
                        slug=result.get("slug"),
                        organization=organization,
                    )
            except IntegrityError:
                return Response(
                    {
                        "non_field_errors": [CONFLICTING_SLUG_ERROR],
                        "detail": CONFLICTING_SLUG_ERROR,
                    },
                    status=409,
                )
            else:
                team_created.send_robust(
                    organization=organization, user=request.user, team=team, sender=self.__class__
                )
            if self.should_add_creator_to_team(request):
                try:
                    member = OrganizationMember.objects.get(
                        user=request.user, organization=organization
                    )
                except OrganizationMember.DoesNotExist:
                    pass
                else:
                    OrganizationMemberTeam.objects.create(team=team, organizationmember=member)

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_ADD,
                data=team.get_audit_log_data(),
            )
            return Response(
                serialize(team, request.user, self.team_serializer_for_post()),
                status=201,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
