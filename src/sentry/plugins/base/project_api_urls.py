from __future__ import absolute_import

import logging
import re

from django.core.urlresolvers import RegexURLResolver, RegexURLPattern
from django.conf.urls import patterns, include, url

from sentry.plugins import plugins

logger = logging.getLogger('sentry.plugins')


def is_valid_urls(urls):
    if not urls:
        return False

    for u in urls:
        if not isinstance(u, (RegexURLResolver, RegexURLPattern)):
            return False

    return True


def load_plugin_urls(plugins):
    urlpatterns = patterns('')

    for _plugin in plugins:
        try:
            _plugin_project_urls = _plugin.get_project_urls()
            assert is_valid_urls(_plugin_project_urls)
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
