from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project, ProjectStatus, AuditLogEntryEvent
from sentry.utils.apidocs import scenario, attach_scenarios


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
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)


class TeamProjectIndexEndpoint(TeamEndpoint):
    doc_section = DocSection.TEAMS

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

            project = Project.objects.create(
                name=result['name'],
                slug=result.get('slug'),
                organization=team.organization,
                team=team
            )

            # XXX: create sample event?

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.PROJECT_ADD,
                data=project.get_audit_log_data(),
            )

            return Response(serialize(project, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
