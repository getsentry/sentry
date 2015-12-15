from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ProjectKey
from sentry.utils.integrationdocs import load_doc


def replace_keys(html, project_key):
    if project_key is None:
        return html
    html = html.replace('___DSN___', project_key.dsn_private)
    html = html.replace('___PUBLIC_DSN___', project_key.dsn_public)
    html = html.replace('___PUBLIC_KEY___', project_key.public_key)
    html = html.replace('___SECRET_KEY___', project_key.secret_key)
    html = html.replace('___PROJECT_ID___', str(project_key.project_id))
    return html


class ProjectDocsPlatformEndpoint(ProjectEndpoint):
    def get(self, request, project, platform):
        data = load_doc(platform)
        if not data:
            raise ResourceDoesNotExist

        project_key = ProjectKey.get_default(project)

        return Response({
            'id': data['id'],
            'name': data['name'],
            'html': replace_keys(data['html'], project_key),
            'link': data['link'],
        })
