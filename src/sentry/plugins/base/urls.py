from __future__ import absolute_import

from django.conf.urls import patterns

from sentry.plugins import plugins


urlpatterns = patterns('')

for _plugin in plugins.all():
    _plugin_patterns = _plugin.get_url_patterns()
    if _plugin_patterns:
        urlpatterns += _plugin_patterns
