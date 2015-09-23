from __future__ import absolute_import

from django.core.cache import cache
from rest_framework.response import Response

from sentry import http
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ProjectKey, ProjectKeyStatus

DOC_URL = 'https://docs.getsentry.com/hosted/_wizards/{platform}.json'

PLATFORMS = set([
    'python',
    'python-bottle',
    'python-celery',
    'python-django',
    'python-flask',
    'python-pylons',
    'python-pyramid',
    'python-tornado',
    'javascript',
    'node',
    'node-express',
    'node-koa',
    'node-connect',
    'php',
    'ruby',
    'objective-c',
    'java',
    'c-sharp',
    'go',
])


def replace_keys(html, project_key):
    if project_key is None:
        return html
    html = html.replace('___DSN___', project_key.dsn_private)
    html = html.replace('___PUBLIC_DSN___', project_key.dsn_public)
    html = html.replace('___PUBLIC_KEY___', project_key.public_key)
    html = html.replace('___SECRET_KEY___', project_key.secret_key)
    html = html.replace('___PROJECT_ID___', str(project_key.project_id))
    return html


class ProjectPlatformDocsEndpoint(ProjectEndpoint):
    def get(self, request, project, platform):
        if platform not in PLATFORMS:
            raise ResourceDoesNotExist

        cache_key = 'docs:{}'.format(platform)
        result = cache.get(cache_key)
        if result is None:
            session = http.build_session()
            result = session.get(DOC_URL.format(platform=platform)).json()
            cache.set(cache_key, result, 3600)

        try:
            project_key = ProjectKey.objects.filter(
                project=project,
                roles=ProjectKey.roles.store,
                status=ProjectKeyStatus.ACTIVE
            )[0]
        except IndexError:
            project_key = None

        return Response({
            'name': result['name'],
            'html': replace_keys(result['body'], project_key),
            'sdk': result['client_lib'],
            'isFramework': result['is_framework'],
            'link': result['doc_link'],
        })
