from __future__ import absolute_import
from django.conf.urls import url
from sentry.plugins.base.project_api_urls import load_plugin_urls
from sentry.plugins.base.response import JSONResponse


def test_json_response():
    resp = JSONResponse({}).respond(None)
    assert resp.status_code == 200


def test_json_response_with_status_kwarg():
    resp = JSONResponse({}, status=400).respond(None)
    assert resp.status_code == 400


def test_load_plugin_urls():
    class BadPluginA(object):
        def get_project_urls(self):
            assert False

    class BadPluginB(object):
        def get_project_urls(self):
            return 'lol'

    class BadPluginC(object):
        def get_project_urls(self):
            return None

    class BadPluginD(object):
        def get_project_urls(self):
            return [('foo', 'bar')]

    class GoodPlugin(object):
        slug = 'thing'

        def get_project_urls(self):
            return [
                url('', None),
            ]

    patterns = load_plugin_urls((
        BadPluginA(),
        BadPluginB(),
        BadPluginC(),
        BadPluginD(),
        GoodPlugin(),
    ))

    assert len(patterns) == 1
