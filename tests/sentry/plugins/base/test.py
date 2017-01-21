from __future__ import absolute_import

from django.conf.urls import url

from sentry.plugins import Plugin2
from sentry.plugins.base.project_api_urls import load_plugin_urls
from sentry.plugins.base.response import JSONResponse


def test_json_response():
    resp = JSONResponse({}).respond(None)
    assert resp.status_code == 200


def test_json_response_with_status_kwarg():
    resp = JSONResponse({}, status=400).respond(None)
    assert resp.status_code == 400


def test_load_plugin_urls():
    class BadPluginA(Plugin2):
        def get_project_urls(self):
            assert False

    class BadPluginB(Plugin2):
        def get_project_urls(self):
            return 'lol'

    class BadPluginC(Plugin2):
        def get_project_urls(self):
            return None

    class GoodPluginA(Plugin2):
        def get_project_urls(self):
            return [url('', None)]

    class GoodPluginB(Plugin2):
        def get_project_urls(self):
            return [('foo', 'bar')]

    patterns = load_plugin_urls((
        BadPluginA(),
        BadPluginB(),
        BadPluginC(),
        GoodPluginA(),
        GoodPluginB(),
    ))

    assert len(patterns) == 2
