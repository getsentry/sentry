from __future__ import absolute_import

from django.http import Http404

from sentry.api.bases.project import ProjectEndpoint, ProjectIntegrationsPermission
from sentry.api.serializers import serialize
from sentry.models import ProjectIntegration, Integration


class ProjectIntegrationDetailsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectIntegrationsPermission, )

    def get(self, request, project, integration_id):
        try:
            integration = ProjectIntegration.objects.get(
                project=project,
                integration_id=integration_id,
            )
        except ProjectIntegration.DoesNotExist:
            raise Http404

        return self.respond(serialize(integration, request.user))

    def put(self, request, project, integration_id):
        # Integrations can only be added to a project if they are already
        # configured for the organization themselves.
        try:
            integration = Integration.objects.get(
                id=integration_id,
                organizations=project.organization_id,
            )
        except Integration.DoesNotExist:
            raise Http404

        created = integration.add_project(project.id)

        return self.respond(status=(201 if created else 204))

    def delete(self, request, project, integration_id):
        ProjectIntegration.objects.filter(
            integration__id=integration_id,
            project=project,
        ).delete()
        return self.respond(status=204)

    def post(self, request, project, integration_id):
        try:
            integration = ProjectIntegration.objects.get(
                integration__id=integration_id,
                project=project,
            )
        except ProjectIntegration.DoesNotExist:
            raise Http404

        config = integration.config
        config.update(request.DATA)
        integration.update(config=config)

        return self.respond(status=200)
