from __future__ import absolute_import

import responses

from exam import fixture
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from sentry.plugins.bases.issue2 import PluginError
from sentry.testutils import PluginTestCase

from social_auth.models import UserSocialAuth

from sentry_plugins.bitbucket.plugin import BitbucketPlugin


class BitbucketPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return BitbucketPlugin()

    @fixture
    def request(self):
        return RequestFactory()

    def test_conf_key(self):
        assert self.plugin.conf_key == "bitbucket"

    def test_entry_point(self):
        self.assertPluginInstalled("bitbucket", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, 1) == "Bitbucket-1"

    def test_get_issue_url(self):
        self.plugin.set_option("repo", "maxbittker/newsdiffs", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert (
            self.plugin.get_issue_url(group, 1)
            == "https://bitbucket.org/maxbittker/newsdiffs/issue/1/"
        )

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("repo", "maxbittker/newsdiffs", self.project)
        assert self.plugin.is_configured(None, self.project) is True

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.POST,
            "https://api.bitbucket.org/1.0/repositories/maxbittker/newsdiffs/issues",
            json={"local_id": 1, "title": "Hello world"},
        )

        self.plugin.set_option("repo", "maxbittker/newsdiffs", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {
            "title": "Hello",
            "description": "Fix this.",
            "issue_type": "bug",
            "priority": "trivial",
        }
        with self.assertRaises(PluginError):
            self.plugin.create_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        UserSocialAuth.objects.create(
            user=self.user,
            provider=self.plugin.auth_provider,
            extra_data={
                "access_token": (
                    "oauth_token=123456789abcdefghi&"
                    "oauth_token_secret="
                    "123456789123456789abcdefghijklmn"
                )
            },
        )

        assert self.plugin.create_issue(request, group, form_data) == 1

        request = responses.calls[-1].request
        assert request.headers.get("Authorization", "").startswith("OAuth ")

    @responses.activate
    def test_link_issue(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/1.0/repositories/maxbittker/newsdiffs/issues/1",
            json={"local_id": 1, "title": "Hello world"},
        )
        responses.add(
            responses.POST,
            "https://api.bitbucket.org/1.0/repositories/maxbittker/newsdiffs/issues/1/comments",
            json={"body": "Hello"},
        )

        self.plugin.set_option("repo", "maxbittker/newsdiffs", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"comment": "Hello", "issue_id": "1"}
        with self.assertRaises(PluginError):
            self.plugin.link_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        UserSocialAuth.objects.create(
            user=self.user,
            provider=self.plugin.auth_provider,
            extra_data={
                "access_token": (
                    "oauth_token=123456789abcdefghi&oauth_token_secret="
                    "123456789123456789abcdefghijklmn"
                )
            },
        )

        assert self.plugin.link_issue(request, group, form_data) == {"title": "Hello world"}
