from __future__ import absolute_import

from django import template
from django.conf import settings

from sentry.cache import default_cache
from sentry.models import ProjectKey


register = template.Library()


def _get_project_key(project_id):
    try:
        return ProjectKey.objects.filter(
            project=project_id,
            roles=ProjectKey.roles.store,
        )[0]
    except IndexError:
        return None


@register.simple_tag
def public_dsn():
    project_id = settings.SENTRY_FRONTEND_PROJECT or settings.SENTRY_PROJECT
    cache_key = 'dsn:%s' % (project_id,)

    result = default_cache.get(cache_key)
    if result is None:
        key = _get_project_key(project_id)
        if key:
            result = key.dsn_public
        else:
            result = ''
        default_cache.set(cache_key, result, 60)
    return result
