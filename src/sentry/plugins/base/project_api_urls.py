from __future__ import absolute_import

import logging
import re

from django.core.urlresolvers import RegexURLResolver, RegexURLPattern
from django.conf.urls import patterns, include, url

from sentry.plugins import plugins

logger = logging.getLogger('sentry.plugins')


def ensure_url(u):
    if isinstance(u, (tuple, list)):
        return url(*u)
    elif not isinstance(u, (RegexURLResolver, RegexURLPattern)):
        raise TypeError(
            'url must be RegexURLResolver or RegexURLPattern, not %r: %r' % (type(u).__name__, u)
        )
    return u


def load_plugin_urls(plugins):
    urlpatterns = patterns('')
    for plugin in plugins:
        try:
            urls = plugin.get_project_urls()
            if not urls:
                continue
            urls = [ensure_url(u) for u in urls]
        except Exception:
            logger.exception('routes.failed', extra={
                'plugin': type(plugin).__name__,
            })
        else:
            urlpatterns.append(
                url(r'^%s/' % re.escape(plugin.slug), include(urls))
            )

    return urlpatterns


urlpatterns = load_plugin_urls(plugins.all())
