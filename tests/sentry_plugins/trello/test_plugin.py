from __future__ import absolute_import

import responses

from exam import fixture
from django.test import RequestFactory
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.trello.plugin import TrelloPlugin


class TrelloPluginTestBase(PluginTestCase):
    @fixture
    def plugin(self):
        return TrelloPlugin()

    @fixture
    def request(self):
        return RequestFactory()


class TrelloPluginTest(TrelloPluginTestBase):
    def test_conf_key(self):
        assert self.plugin.conf_key == "trello"

    def test_entry_point(self):
        self.assertPluginInstalled("trello", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        # test new and old format
        assert self.plugin.get_issue_label(group, "rPPDb") == "Trello-rPPDb"
        assert (
            self.plugin.get_issue_label(group, "5dafd/https://trello.com/c/rPPDb/75-title")
            == "Trello-5dafd"
        )

    def test_get_issue_url(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        # test new and old format
        assert self.plugin.get_issue_url(group, "rPPDb") == "https://trello.com/c/rPPDb"
        assert self.plugin.get_issue_url(group, {"id": "rPPDb"}) == "https://trello.com/c/rPPDb"
        assert (
            self.plugin.get_issue_url(group, "5dafd/https://trello.com/c/rPPDb/75-title")
            == "https://trello.com/c/rPPDb/75-title"
        )

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("token", "7c8951d1", self.project)
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("key", "39g", self.project)
        assert self.plugin.is_configured(None, self.project) is True


class TrelloPluginApiTests(TrelloPluginTestBase):
    def setUp(self):
        self.group = self.create_group(message="Hello world", culprit="foo.bar")
        self.plugin.set_option("token", "7c8951d1", self.project)
        self.plugin.set_option("key", "39g", self.project)
        self.plugin.set_option("organization", "f187", self.project)

        self.login_as(self.user)

    def test_get_config_no_org(self):
        self.plugin.unset_option("organization", self.project)
        out = self.plugin.get_config(self.project)
        assert out == [
            {
                "default": "39g",
                "required": True,
                "type": "text",
                "name": "key",
                "label": "Trello API Key",
            },
            {
                "name": "token",
                "default": None,
                "required": False,
                "label": "Trello API Token",
                "prefix": "7c895",
                "type": "secret",
                "has_saved_value": True,
            },
        ]

    @responses.activate
    def test_get_config_include_additional(self):
        self.plugin.unset_option("organization", self.project)

        responses.add(
            responses.GET,
            "https://api.trello.com/1/members/me/organizations",
            json=[{"name": "team 1", "id": "2d8e"}, {"name": "team 2", "id": "d0cc"}],
        )
        out = self.plugin.get_config(self.project, add_additial_fields=True)
        assert out == [
            {
                "default": "39g",
                "required": True,
                "type": "text",
                "name": "key",
                "label": "Trello API Key",
            },
            {
                "name": "token",
                "default": None,
                "required": False,
                "label": "Trello API Token",
                "prefix": "7c895",
                "type": "secret",
                "has_saved_value": True,
            },
            {
                "name": "organization",
                "default": None,
                "required": False,
                "choices": [("2d8e", "team 1"), ("d0cc", "team 2")],
                "label": "Trello Organization",
                "type": "select",
            },
        ]

    @responses.activate
    def test_create_issue(self):
        responses.add(responses.POST, "https://api.trello.com/1/cards", json={"shortLink": "rds43"})

        form_data = {
            "title": "Hello",
            "description": "Fix this.",
            "board": "ads23f",
            "list": "23tds",
        }
        request = self.make_request(user=self.user, method="POST")

        assert self.plugin.create_issue(request, self.group, form_data) == "rds43"
        request = responses.calls[0].request
        assert request.url == "https://api.trello.com/1/cards?token=7c8951d1&key=39g"
        payload = json.loads(request.body)
        assert payload == {"name": "Hello", "desc": "Fix this.", "idList": "23tds"}

    @responses.activate
    def test_link_issue(self):
        responses.add(
            responses.GET,
            "https://api.trello.com/1/cards/SstgnBIQ",
            json={"idShort": 2, "name": "MyTitle", "shortLink": "SstgnBIQ"},
        )
        responses.add(
            responses.POST, "https://api.trello.com/1/cards/SstgnBIQ/actions/comments", json={}
        )

        form_data = {"comment": "please fix this", "issue_id": "SstgnBIQ"}
        request = self.make_request(user=self.user, method="POST")

        assert self.plugin.link_issue(request, self.group, form_data) == {
            "title": "MyTitle",
            "id": "SstgnBIQ",
        }

        request = responses.calls[0].request
        assert (
            request.url
            == "https://api.trello.com/1/cards/SstgnBIQ?fields=name%2CshortLink%2CidShort&token=7c8951d1&key=39g"
        )

        request = responses.calls[1].request
        assert (
            request.url
            == "https://api.trello.com/1/cards/SstgnBIQ/actions/comments?text=please+fix+this&token=7c8951d1&key=39g"
        )

    @responses.activate
    def test_view_options(self):
        responses.add(
            responses.GET,
            "https://api.trello.com/1/boards/f34/lists",
            json=[{"id": "8f3", "name": "list 1"}, {"id": "j8f", "name": "list 2"}],
        )

        request = self.make_request(user=self.user, method="GET")
        request.GET["option_field"] = "list"
        request.GET["board"] = "f34"

        response = self.plugin.view_options(request, self.group)
        assert response.data == {"list": [("8f3", "list 1"), ("j8f", "list 2")]}

        request = responses.calls[0].request
        assert request.url == "https://api.trello.com/1/boards/f34/lists?token=7c8951d1&key=39g"

    @responses.activate
    def test_view_autocomplete(self):
        responses.add(
            responses.GET,
            "https://api.trello.com/1/search",
            json={
                "cards": [
                    {"id": "4fsdafad", "name": "KeyError", "idShort": 1, "shortLink": "0lr"},
                    {"id": "f4usdfa", "name": "Key Missing", "idShort": 3, "shortLink": "9lf"},
                ]
            },
        )

        request = self.make_request(user=self.user, method="GET")
        request.GET["autocomplete_field"] = "issue_id"
        request.GET["autocomplete_query"] = "Key"

        response = self.plugin.view_autocomplete(request, self.group)
        assert response.data == {
            "issue_id": [
                {"id": "0lr", "text": "(#1) KeyError"},
                {"id": "9lf", "text": "(#3) Key Missing"},
            ]
        }

        request = responses.calls[0].request
        assert (
            request.url
            == "https://api.trello.com/1/search?cards_limit=100&partial=true&card_fields=name%2CshortLink%2CidShort&key=39g&query=Key&modelTypes=cards&token=7c8951d1&idOrganizations=f187"
        )

    @responses.activate
    def test_view_autocomplete_no_org(self):
        self.plugin.unset_option("organization", self.project)

        responses.add(
            responses.GET,
            "https://api.trello.com/1/search",
            json={
                "cards": [
                    {"id": "4fsdafad", "name": "KeyError", "idShort": 1, "shortLink": "0lr"},
                    {"id": "f4usdfa", "name": "Key Missing", "idShort": 3, "shortLink": "9lf"},
                ]
            },
        )

        request = self.make_request(user=self.user, method="GET")
        request.GET["autocomplete_field"] = "issue_id"
        request.GET["autocomplete_query"] = "Key"

        response = self.plugin.view_autocomplete(request, self.group)
        assert response.data == {
            "issue_id": [
                {"id": "0lr", "text": "(#1) KeyError"},
                {"id": "9lf", "text": "(#3) Key Missing"},
            ]
        }

        request = responses.calls[0].request
        assert (
            request.url
            == "https://api.trello.com/1/search?cards_limit=100&partial=true&modelTypes=cards&token=7c8951d1&card_fields=name%2CshortLink%2CidShort&key=39g&query=Key"
        )
