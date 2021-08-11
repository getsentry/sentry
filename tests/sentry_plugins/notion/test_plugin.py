from urllib.parse import urlparse

import responses
from django.test import RequestFactory
from exam import fixture

from sentry.testutils import PluginTestCase
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry_plugins.notion.plugin import NotionPlugin


class NotionPluginTestBase(PluginTestCase):
    @fixture
    def plugin(self):
        return NotionPlugin()

    @fixture
    def request(self):
        return RequestFactory()


class NotionPluginTest(NotionPluginTestBase):
    def test_conf_key(self):
        assert self.plugin.conf_key == "notion"

    def test_entry_point(self):
        self.assertPluginInstalled("notion", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        # test new and old format
        assert self.plugin.get_issue_label(group, "rPPDb") == "Notion Page"
        assert (
            self.plugin.get_issue_label(group, "https://www.notion.so/75-title-crPPDb")
            == "Notion Page"
        )

    def test_get_page_url(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        # test new and old format
        assert (
            self.plugin.get_issue_url(group, "https://www.notion.so/rPPDb")
            == "https://www.notion.so/rPPDb"
        )

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("key", "39g", self.project)
        assert self.plugin.is_configured(None, self.project) is True


class NotionPluginApiTests(NotionPluginTestBase):
    def setUp(self):
        self.group = self.create_group(message="Hello world", culprit="foo.bar")
        self.plugin.set_option("key", "39g", self.project)
        self.plugin.set_option("database", "db_f187", self.project)

        self.login_as(self.user)

    @responses.activate
    def test_get_config_no_default_database(self):
        self.plugin.unset_option("database", self.project)

        responses.add(
            responses.POST,
            "https://api.notion.com/v1/search",
            json={
                "results": [
                    {"id": "4fsdafad", "title": [{"plain_text": "First page"}]},
                    {"id": "f4usdfae", "title": [{"plain_text": "Second page"}]},
                ]
            },
        )

        out = self.plugin.get_config(self.project)
        assert out == [
            {
                "name": "key",
                "type": "secret",
                "required": True,
                "label": "Notion Internal Integration Token",
                "default": "39g",
                "has_saved_value": True,
                "prefix": "39g",
            }
        ]

    @responses.activate
    def test_get_config_with_default_database(self):
        responses.add(
            responses.POST,
            "https://api.notion.com/v1/search",
            json={
                "results": [
                    {"id": "4fsdafad", "title": [{"plain_text": "First page"}]},
                    {"id": "f4usdfae", "title": [{"plain_text": "Second page"}]},
                ]
            },
        )

        out = self.plugin.get_config(self.project)
        assert out == [
            {
                "name": "key",
                "type": "secret",
                "required": True,
                "label": "Notion Internal Integration Token",
                "default": "39g",
                "has_saved_value": True,
                "prefix": "39g",
            },
            {
                "name": "database",
                "label": "Default Notion Database",
                "choices": [("4fsdafad", "First page"), ("f4usdfae", "Second page")],
                "type": "select",
                "required": False,
                "default": "db_f187",
                "has_autocomplete": True,
            },
        ]

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.POST,
            "https://api.notion.com/v1/pages",
            json={"url": "https://www.notion.so/rds43"},
        )

        form_data = {
            "title": "Hello",
            "description": "Fix this.",
            "database": "ads23f",
        }
        request = self.make_request(user=self.user, method="POST")

        assert (
            self.plugin.create_issue(request, self.group, form_data)
            == "https://www.notion.so/rds43"
        )
        request = responses.calls[0].request
        assert request.url == "https://api.notion.com/v1/pages"
        payload = json.loads(request.body)
        expected_payload = {
            "parent": {"database_id": form_data["database"]},
            "properties": {"Name": {"title": [{"text": {"content": form_data["title"]}}]}},
            "children": [
                {
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {
                        "text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": self.group.qualified_short_id,
                                    "link": {
                                        "url": absolute_uri(
                                            self.group.get_absolute_url(
                                                params={"referrer": "notion_integration"}
                                            )
                                        )
                                    },
                                },
                            }
                        ]
                    },
                },
                {"object": "block", "type": "paragraph", "paragraph": {"text": []}},
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "text": [{"type": "text", "text": {"content": form_data["description"]}}]
                    },
                },
            ],
        }
        assert payload == expected_payload

    @responses.activate
    def test_link_issue(self):
        comment_payload = {
            "comment": "lorem ipsum",
            "page_id": "SstgnBIQ",
            "url": "https://www.notion.so/SstgnBIQ",
            "issue_id": "O8mns",
        }

        responses.add(
            responses.GET,
            "https://api.notion.com/v1/pages/%s" % comment_payload["page_id"],
            json={"url": comment_payload["url"]},
        )

        payload = {
            "children": [
                {
                    "object": "block",
                    "type": "heading_3",
                    "heading_3": {
                        "text": [
                            {"type": "text", "text": {"content": "Sentry issue: "}},
                            {
                                "type": "text",
                                "text": {
                                    "content": comment_payload["issue_id"],
                                    "link": {"url": comment_payload["url"]},
                                },
                            },
                        ]
                    },
                },
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "text": [
                            {
                                "type": "text",
                                "text": {
                                    "content": comment_payload["comment"],
                                },
                            }
                        ]
                    },
                },
            ]
        }
        responses.add(
            responses.PATCH,
            "https://api.notion.com/v1/blocks/%s/children" % comment_payload["page_id"],
            json=payload,
        )

        form_data = {
            "comment": comment_payload["comment"],
            "notion_page_id": comment_payload["page_id"],
        }
        request = self.make_request(user=self.user, method="PATCH")

        assert self.plugin.link_issue(request, self.group, form_data) == {
            "id": comment_payload["url"],
        }

        request = responses.calls[0].request
        assert request.url == "https://api.notion.com/v1/pages/%s" % comment_payload["page_id"]

        request = responses.calls[1].request
        assert (
            request.url
            == "https://api.notion.com/v1/blocks/%s/children" % comment_payload["page_id"]
        )

    @responses.activate
    def test_view_autocomplete(self):
        responses.add(
            responses.POST,
            "https://api.notion.com/v1/search",
            json={
                "results": [
                    {
                        "id": "4fsdafad",
                        "parent": {"type": "database_id"},
                        "properties": {"Name": {"title": [{"plain_text": "DB title"}]}},
                    },
                    {
                        "id": "f4usdfae",
                        "parent": {"type": "workspace"},
                        "properties": {"title": {"title": [{"plain_text": "Page title"}]}},
                    },
                ]
            },
        )

        request = self.make_request(user=self.user, method="POST")
        request.GET["autocomplete_field"] = "notion_page_id"
        request.GET["autocomplete_query"] = "Key"

        response = self.plugin.view_autocomplete(request, self.group)
        assert response.data == {
            "notion_page_id": [
                {"id": "4fsdafad", "text": "DB title"},
                {"id": "f4usdfae", "text": "Page title"},
            ]
        }

        request = responses.calls[0].request
        url = urlparse(request.url)
        assert url.path == "/v1/search"

        payload = json.loads(request.body)
        assert payload == {"filter": {"value": "page", "property": "object"}, "query": "Key"}

    @responses.activate
    def test_view_autocomplete_no_pages(self):
        responses.add(
            responses.POST,
            "https://api.notion.com/v1/search",
            json={"results": []},
        )

        request = self.make_request(user=self.user, method="GET")
        request.GET["autocomplete_field"] = "notion_page_id"
        request.GET["autocomplete_query"] = "Missing Key"

        response = self.plugin.view_autocomplete(request, self.group)
        assert response.data == {"notion_page_id": []}

        request = responses.calls[0].request
        url = urlparse(request.url)
        assert url.path == "/v1/search"

        payload = json.loads(request.body)
        assert payload == {
            "filter": {"value": "page", "property": "object"},
            "query": "Missing Key",
        }
