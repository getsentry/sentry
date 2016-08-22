from __future__ import absolute_import

from django.conf.urls import patterns, include, url

from sentry.plugins import plugins


urlpatterns = patterns('')

for _plugin in plugins.all():
    _plugin_project_urls = _plugin.get_project_urls()
    if _plugin_project_urls:
        urlpatterns.append(
            url(r'^%s/' % _plugin.slug, include(_plugin_project_urls))
        )
