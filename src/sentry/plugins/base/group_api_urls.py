from __future__ import absolute_import

import logging
import re

from django.conf.urls import include, url, RegexURLResolver, RegexURLPattern

from sentry.plugins.base import plugins

logger = logging.getLogger("sentry.plugins")


def load_plugin_urls(plugins):
    urlpatterns = []
    for plugin in plugins:
        urls = plugin.get_group_urls()
        if not urls:
            continue
        try:
            # a plugin's get_group_urls should return an iterable of url()'s,
            # which can either be RegexURLResolver or RegexURLPattern
            for u in urls:
                if not isinstance(u, (RegexURLResolver, RegexURLPattern)):
                    raise TypeError(
                        "url must be RegexURLResolver or RegexURLPattern, not %r: %r"
                        % (type(u).__name__, u)
                    )
        except Exception:
            logger.exception("routes.failed", extra={"plugin": type(plugin).__name__})
        else:
            urlpatterns.append(url(r"^%s/" % re.escape(plugin.slug), include(urls)))

    return urlpatterns


urlpatterns = load_plugin_urls(plugins.all())
