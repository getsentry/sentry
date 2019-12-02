from __future__ import absolute_import

import responses

from exam import fixture
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.clubhouse.plugin import ClubhousePlugin


class ClubhousePluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return ClubhousePlugin()

    @fixture
    def request(self):
        return RequestFactory()

    def test_conf_key(self):
        assert self.plugin.conf_key == "clubhouse"

    def test_entry_point(self):
        self.assertPluginInstalled("clubhouse", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, {"id": 1}) == "Clubhouse Story #1"

    @responses.activate
    def test_get_issue_url(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert (
            self.plugin.get_issue_url(
                group, {"id": 1, "url": "https://app.clubhouse.io/example-org/story/1"}
            )
            == "https://app.clubhouse.io/example-org/story/1"
        )

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("project", "1234", self.project)
        assert self.plugin.is_configured(None, self.project) is True

    def test_validate_config(self):
        # TODO: add method to validate that the config is actually valid.
        # It's unclear what method to call to on the plugin to ensure that the config inputs are indeed valid.
        # See `validate_config()` in plugin.py
        # self.plugin.set_option('token', '12345678-1234-1234-1234-1234567890AB', self.project)
        # self.plugin.set_option('project', 'ABCD123', self.project)
        # assert self.plugin.validate_config(None, self.project, <what to pass in
        # here>, None) is False
        pass

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.POST,
            "https://api.clubhouse.io/api/v2/stories",
            json={
                "app_url": "https://app.clubhouse.io/example/story/567/hello",
                "id": 567,
                "name": "Hello",
                "notes": "Fix this.",
                "project_id": 123,
            },
        )

        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)
        self.plugin.set_option("project", 123, self.project)
        group = self.create_group(message="Hello", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"title": "Hello", "description": "Fix this."}

        assert self.plugin.create_issue(request, group, form_data) == {
            "id": 567,
            "title": "Hello",
            "url": "https://app.clubhouse.io/example/story/567/hello",
        }

        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {
            "description": "Fix this.",
            "name": "Hello",
            "project_id": 123,
            "story_type": "bug",
        }

    @responses.activate
    def test_link_issue(self):
        responses.add(
            responses.GET,
            "https://api.clubhouse.io/api/v2/search/stories",
            json={
                "data": [
                    {
                        "id": 11,
                        "name": "Create Hello World page",
                        "app_url": "https://app.clubhouse.io/example/story/11/create-hello-world-page",
                    }
                ]
            },
        )
        responses.add(
            responses.GET,
            "https://api.clubhouse.io/api/v2/stories/11",
            json={
                "id": 11,
                "name": "Create Hello World page",
                "app_url": "https://app.clubhouse.io/example/story/11/create-hello-world-page",
            },
        )
        responses.add(
            responses.POST, "https://api.clubhouse.io/api/v2/stories/11/comments", json={}
        )

        self.plugin.set_option("token", "12345678-1234-1234-1234-1234567890AB", self.project)

        group = self.create_group(message="Hello world", culprit="foo.bar")
        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"comment": "Hello, this is a comment.", "issue_id": "11"}

        assert self.plugin.link_issue(request, group, form_data) == {
            "id": 11,
            "title": "Create Hello World page",
            "url": "https://app.clubhouse.io/example/story/11/create-hello-world-page",
        }

        request = responses.calls[-1].request
        payload = json.loads(request.body)
        assert payload == {"text": "Hello, this is a comment."}
