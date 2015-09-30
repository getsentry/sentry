from __future__ import absolute_import

from rest_framework.response import Response

from sentry import options
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import ProjectKey


class ProjectDocsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        data = options.get('sentry:docs')
        project_key = ProjectKey.get_default(project)

        context = {
            'platforms': data['platforms'],
        }
        if project_key:
            context['dsn'] = project_key.dsn_private
            context['dsnPublic'] = project_key.dsn_public

        return Response(context)
