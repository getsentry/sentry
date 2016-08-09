from __future__ import absolute_import

from django.conf.urls import patterns, include, url

from sentry.plugins import plugins, IssueTrackingPlugin2


urlpatterns = patterns('')

for _plugin in plugins.all():
    if isinstance(_plugin, IssueTrackingPlugin2):
        _plugin_group_urls = _plugin.get_group_urls()
        if _plugin_group_urls:
            urlpatterns += (url(r'^%s/' % _plugin.slug, include(_plugin_group_urls)),)
