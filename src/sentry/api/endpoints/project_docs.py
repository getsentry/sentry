from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import ProjectKey
from sentry.utils.integrationdocs import load_doc


class ProjectDocsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        data = load_doc('_platforms')
        if data is None:
            raise RuntimeError('Docs not built')
        project_key = ProjectKey.get_default(project)

        context = {
            'platforms': data['platforms'],
        }
        if project_key:
            context['dsn'] = project_key.dsn_private
            context['dsnPublic'] = project_key.dsn_public

        return Response(context)
