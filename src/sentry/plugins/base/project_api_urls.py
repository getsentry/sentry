from __future__ import absolute_import

import re

from django.conf.urls import patterns, include, url

from sentry.plugins import plugins


def ensure_url(u):
    if isinstance(u, (tuple, list)):
        return url(*u)
    return u


def build_urls():
    urlpatterns = patterns('')
    for plugin in plugins.all():
        urls = plugin.get_project_urls()
        if not urls:
            continue
        urls = [ensure_url(u) for u in urls]
        urlpatterns.append(
            url(r'^%s/' % re.escape(plugin.slug), include(urls))
        )
    return urlpatterns


urlpatterns = build_urls()
