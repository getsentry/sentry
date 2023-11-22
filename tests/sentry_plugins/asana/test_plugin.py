from functools import cached_property

import pytest
import responses
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from sentry.exceptions import PluginError
from sentry.testutils.cases import PluginTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry_plugins.asana.plugin import AsanaPlugin


@region_silo_test
class AsanaPluginTest(PluginTestCase):
    @cached_property
    def plugin(self):
        return AsanaPlugin()

    @cached_property
    def request(self):
        return RequestFactory()

    def test_conf_key(self):
        assert self.plugin.conf_key == "asana"

    def test_entry_point(self):
        self.assertPluginInstalled("asana", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, 1) == "Asana Issue"

    def test_get_issue_url(self):
        self.plugin.set_option("repo", "getsentry/sentry", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_url(group, 1) == "https://app.asana.com/0/0/1"

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("workspace", 12345678, self.project)
        assert self.plugin.is_configured(None, self.project) is True

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.POST,
            "https://app.asana.com/api/1.0/tasks",
            json={"data": {"name": "Hello world!", "notes": "Fix this.", "gid": 1}},
        )

        self.plugin.set_option("workspace", "12345678", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"title": "Hello", "description": "Fix this."}
        with pytest.raises(PluginError):
            self.plugin.create_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        self.create_usersocialauth(
            user=self.user, provider=self.plugin.auth_provider, extra_data={"access_token": "foo"}
        )

        assert self.plugin.create_issue(request, group, form_data) == 1
        request = responses.calls[0].request
        payload = json.loads(request.body)
        assert payload == {"data": {"notes": "Fix this.", "name": "Hello", "workspace": "12345678"}}

    @responses.activate
    def test_view_create_no_auth(self):
        responses.add(
            responses.POST,
            "https://app.asana.com/api/1.0/tasks",
            json={"data": {"name": "Hello world!", "notes": "Fix this.", "gid": 1}},
        )

        self.plugin.set_option("workspace", "12345678", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        self.login_as(self.user)

        request = self.request.get("/")
        request.user = self.user
        response = self.plugin.view_create(request, group)
        assert response.status_code == 400
        # URL needs to be absolute so that we don't get customer domains
        # Asana redirect_urls are set to the root domain.
        assert "http://testserver" in response.data["auth_url"]

    @responses.activate
    def test_link_issue(self):
        responses.add(
            responses.GET,
            "https://app.asana.com/api/1.0/tasks/1",
            json={"data": {"gid": 1, "name": "Hello", "notes": "Fix this."}},
        )
        responses.add(
            responses.POST,
            "https://app.asana.com/api/1.0/tasks/1/stories/",
            json={"data": {"text": "hello"}},
        )

        self.plugin.set_option("workspace", 12345678, self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"comment": "please fix this", "issue_id": "1"}
        with pytest.raises(PluginError):
            self.plugin.link_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        self.create_usersocialauth(
            user=self.user, provider=self.plugin.auth_provider, extra_data={"access_token": "foo"}
        )

        assert self.plugin.link_issue(request, group, form_data) == {"title": "Hello"}
        request = responses.calls[-1].request
        payload = json.loads(request.body)
        assert payload == {"data": {"text": "please fix this"}}
