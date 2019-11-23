# -*- coding: utf-8 -*-

import os
import sys

camplight_root = os.path.join(os.path.abspath(os.path.dirname(__file__)), "..")
sys.path.insert(0, camplight_root)

import pytest
from httpretty import HTTPretty
from sentry_plugins.camplight import Request, Campfire, RoomNotFoundError, MessageType


def campfire_url(path=""):
    return "https://foo.campfirenow.com" + path


def stub_get(path, *args, **kwargs):
    HTTPretty.register_uri(HTTPretty.GET, campfire_url(path), *args, **kwargs)


class TestCampfire(object):
    def setup_class(self):
        HTTPretty.enable()
        self.request = Request(campfire_url(), "some_token")
        self.campfire = Campfire(self.request)

    def teardown_class(self):
        HTTPretty.disable()

    def test_account(self):
        stub_get(
            "/account.json",
            body="""
            {"account": {"subdomain": "foo", "id": 12345678}}""",
        )
        account = self.campfire.account()
        assert account["subdomain"] == "foo"
        assert account["id"] == 12345678

    def test_rooms(self):
        stub_get(
            "/rooms.json",
            body="""
            {"rooms": [{"name": "Serious"}, {"name": "Danger"}]}""",
        )
        rooms = self.campfire.rooms()
        assert len(rooms) == 2
        assert rooms[0]["name"] == "Serious"
        assert rooms[1]["name"] == "Danger"

    def test_room_by_name(self):
        stub_get(
            "/rooms.json",
            body="""
            {"rooms": [{"name": "Serious", "id": 1000},
                       {"name": "Danger",  "id": 2000}]}""",
        )
        room = self.campfire.room("Serious")
        assert room.room_id == 1000

    def test_room_by_id(self):
        assert self.campfire.room(3000).room_id == 3000

    def test_room_not_found(self):
        stub_get(
            "/rooms.json",
            body="""
            {"rooms": [{"name": "Serious", "id": 1000}]}""",
        )
        with pytest.raises(RoomNotFoundError):
            self.campfire.room("Danger")

    def test_user_me(self):
        stub_get(
            "/users/me.json",
            body="""
            {"user": {"name": "John Doe",
                      "email_address": "john.doe@gmail.com"}}""",
        )
        user = self.campfire.user()
        assert user["name"] == "John Doe"
        assert user["email_address"] == "john.doe@gmail.com"

    def test_user_other(self):
        user_id = 6789
        stub_get(
            "/users/%s.json" % user_id,
            body="""
            {"user": {"name": "Alan Turing"}}""",
        )
        user = self.campfire.user(user_id)
        assert user["name"] == "Alan Turing"

    def test_presence(self):
        stub_get("/presence.json", body="""{"rooms": [{"name": "Serious"}]}""")
        rooms = self.campfire.presence()
        assert len(rooms) == 1
        assert rooms[0]["name"] == "Serious"

    def test_search(self):
        term = "ohai"
        stub_get(
            "/search/%s.json" % term,
            body="""
            {"messages": [{"body": "ohai world", "type": "TextMessage"}]}""",
        )
        messages = self.campfire.search(term)
        assert len(messages) == 1
        assert messages[0]["body"] == "ohai world"
        assert messages[0]["type"] == MessageType.TEXT


if __name__ == "__main__":
    pytest.main(__file__)
