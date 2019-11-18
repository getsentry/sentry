from __future__ import absolute_import

import re

from django.conf.urls import include, url

from sentry.plugins.base import plugins

urlpatterns = []

for _plugin in plugins.all():
    _plugin_url_module = _plugin.get_url_module()
    if _plugin_url_module:
        urlpatterns += (url("^%s/" % re.escape(_plugin.slug), include(_plugin_url_module)),)
