from __future__ import absolute_import

from django.core.cache import cache
from rest_framework.response import Response

from sentry import http
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import PLATFORM_LIST
from sentry.models import ProjectKey

DOC_URL = 'https://docs.getsentry.com/hosted/_wizards/{platform}.json'

PLATFORM_SET = frozenset(PLATFORM_LIST)


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
        if platform not in PLATFORM_SET:
            raise ResourceDoesNotExist

        cache_key = 'docs:{}'.format(platform)
        result = cache.get(cache_key)
        if result is None:
            session = http.build_session()
            result = session.get(DOC_URL.format(platform=platform)).json()
            cache.set(cache_key, result, 3600)

        project_key = ProjectKey.get_default(project)

        return Response({
            'id': platform,
            'name': result['name'],
            'html': replace_keys(result['body'], project_key),
            'sdk': result['client_lib'],
            'isFramework': result['is_framework'],
            'link': result['doc_link'],
        })
