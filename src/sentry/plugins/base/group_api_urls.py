from __future__ import absolute_import

import re

from django.conf.urls import patterns, include, url

from sentry.plugins import plugins


urlpatterns = patterns('')

for _plugin in plugins.all():
    _plugin_group_urls = _plugin.get_group_urls()
    if _plugin_group_urls:
        urlpatterns.append(
            url(r'^%s/' % re.escape(_plugin.slug), include(_plugin_group_urls))
        )
