import re

from django.conf.urls import include
from django.urls import re_path

from sentry.plugins.base import plugins

urlpatterns = []

for _plugin in plugins.all():
    _plugin_url_module = _plugin.get_url_module()
    if _plugin_url_module:
        urlpatterns += (re_path("^%s/" % re.escape(_plugin.slug), include(_plugin_url_module)),)
