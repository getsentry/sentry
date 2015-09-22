from __future__ import absolute_import

from django.core.cache import cache
from rest_framework.response import Response

from sentry import http
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist

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
])


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

        return Response({
            'name': result['name'],
            'html': result['body'],
            'sdk': result['client_lib'],
            'isFramework': result['is_framework'],
            'link': result['doc_link'],
        })
