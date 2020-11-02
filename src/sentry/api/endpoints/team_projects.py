from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint, TeamPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize, ProjectSummarySerializer
from sentry.models import Project, ProjectStatus, AuditLogEntryEvent
from sentry.signals import project_created

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"


class ProjectSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=50, required=True)
    slug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50, required=False, allow_null=True)
    platform = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    default_rules = serializers.BooleanField(required=False, initial=True)

    def validate_platform(self, value):
        if Project.is_valid_platform(value):
            return value
        raise serializers.ValidationError("Invalid platform")


# While currently the UI suggests teams are a parent of a project, in reality
# the project is the core component, and which team it is on is simply an
# attribute. Because you can already change the team of a project via mutating
# it, and because Sentry intends to remove teams as a hierarchy item, we
# allow you to view a teams projects, as well as create a new project as long
# as you are a member of that team and have project scoped permissions.


class TeamProjectPermission(TeamPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class TeamProjectsEndpoint(TeamEndpoint, EnvironmentMixin):
    permission_classes = (TeamProjectPermission,)

    def get(self, request, team):
        """
        List a Team's Projects
        ``````````````````````

        Return a list of projects bound to a team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to list the projects of.
        :auth: required
        """
        if request.auth and hasattr(request.auth, "project"):
            queryset = Project.objects.filter(id=request.auth.project.id)
        else:
            queryset = Project.objects.filter(teams=team, status=ProjectStatus.VISIBLE)

        stats_period = request.GET.get("statsPeriod")
        if stats_period not in (None, "", "24h", "14d", "30d"):
            return Response(
                {"error": {"params": {"stats_period": {"message": ERR_INVALID_STATS_PERIOD}}}},
                status=400,
            )
        elif not stats_period:
            # disable stats
            stats_period = None

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=lambda x: serialize(
                x,
                request.user,
                ProjectSummarySerializer(
                    environment_id=self._get_environment_id_from_request(
                        request, team.organization.id
                    ),
                    stats_period=stats_period,
                ),
            ),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, team):
        """
        Create a New Project
        ````````````````````

        Create a new project bound to a team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to create a new project
                                  for.
        :param string name: the name for the new project.
        :param string slug: optionally a slug for the new project.  If it's
                            not provided a slug is generated from the name.
        :param bool default_rules: create default rules (defaults to True)
        :auth: required
        """
        serializer = ProjectSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            with transaction.atomic():
                try:
                    with transaction.atomic():
                        project = Project.objects.create(
                            name=result["name"],
                            slug=result.get("slug"),
                            organization=team.organization,
                            platform=result.get("platform"),
                        )
                except IntegrityError:
                    return Response(
                        {"detail": "A project with this slug already exists."}, status=409
                    )
                else:
                    project.add_team(team)

                # XXX: create sample event?

                self.create_audit_entry(
                    request=request,
                    organization=team.organization,
                    target_object=project.id,
                    event=AuditLogEntryEvent.PROJECT_ADD,
                    data=project.get_audit_log_data(),
                )

                project_created.send(
                    project=project,
                    user=request.user,
                    default_rules=result.get("default_rules", True),
                    sender=self,
                )

            return Response(serialize(project, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
