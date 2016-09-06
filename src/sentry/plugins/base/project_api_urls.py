from __future__ import absolute_import

import logging
import re

from django.core.urlresolvers import RegexURLResolver, RegexURLPattern
from django.conf.urls import patterns, include, url

from sentry.plugins import plugins

logger = logging.getLogger('sentry.plugins')


def load_plugin_urls(plugins):
    urlpatterns = patterns('')

    for _plugin in plugins:
        try:
            _plugin_project_urls = _plugin.get_project_urls()
            # We're definitely allowed to not have any urls
            if not _plugin_project_urls:
                continue
            # Once we have urls, we need to assert that the
            # routes are the correct type. If not, once they
            # are registered in Django, they will error very
            # loudly later when trying to do url resolution.
            for u in _plugin_project_urls:
                if not isinstance(u, (RegexURLResolver, RegexURLPattern)):
                    raise TypeError(
                        'url must be RegexURLResolver or RegexURLPattern, not %r: %r' % (type(u).__name__, u)
                    )
        except Exception:
            logger.exception('routes.failed', extra={
                'plugin': type(_plugin).__name__,
            })
        else:
            urlpatterns.append(
                url(r'^%s/' % re.escape(_plugin.slug), include(_plugin_project_urls))
            )

    return urlpatterns


urlpatterns = load_plugin_urls(plugins.all())
