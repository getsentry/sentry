from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.team import TeamEndpoint, TeamPermission
from sentry.api.serializers import serialize
from sentry.models import Project, ProjectStatus, AuditLogEntryEvent
from sentry.signals import project_created
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.samples import create_sample_event


@scenario('ListTeamProjects')
def list_team_projects_scenario(runner):
    runner.request(
        method='GET',
        path='/teams/%s/%s/projects/' % (
            runner.org.slug, runner.default_team.slug)
    )


@scenario('CreateNewProject')
def create_project_scenario(runner):
    runner.request(
        method='POST',
        path='/teams/%s/%s/projects/' % (
            runner.org.slug, runner.default_team.slug),
        data={
            'name': 'The Spoiled Yoghurt'
        }
    )


class ProjectSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=True)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50,
                                  required=False)


# While currently the UI suggests teams are a parent of a project, in reality
# the project is the core component, and which team it is on is simply an
# attribute. Because you can already change the team of a project via mutating
# it, and because Sentry intends to remove teams as a hierarchy item, we
# allow you to view a teams projects, as well as create a new project as long
# as you are a member of that team and have project scoped permissions.
class TeamProjectPermission(TeamPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete'],
        'POST': ['project:write', 'project:delete'],
        'PUT': ['project:write', 'project:delete'],
        'DELETE': ['project:delete'],
    }


class TeamProjectIndexEndpoint(TeamEndpoint):
    doc_section = DocSection.TEAMS
    permission_classes = (TeamProjectPermission,)

    @attach_scenarios([list_team_projects_scenario])
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
        if request.user.is_authenticated():
            results = list(Project.objects.get_for_user(
                team=team, user=request.user))
        else:
            # TODO(dcramer): status should be selectable
            results = list(Project.objects.filter(
                team=team,
                status=ProjectStatus.VISIBLE,
            ))

        return Response(serialize(results, request.user))

    @attach_scenarios([create_project_scenario])
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
        :auth: required
        """
        serializer = ProjectSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            try:
                with transaction.atomic():
                    project = Project.objects.create(
                        name=result['name'],
                        slug=result.get('slug'),
                        organization=team.organization,
                        team=team
                    )
            except IntegrityError:
                return Response(
                    {'detail': 'A project with this slug already exists.'},
                    status=409,
                )

            # XXX: create sample event?

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_ADD,
                data=project.get_audit_log_data(),
            )

            project_created.send(project=project, user=request.user, sender=self)

            create_sample_event(project, platform='javascript')

            return Response(serialize(project, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
