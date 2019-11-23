# -*- coding: utf-8 -*-

import os
import sys

camplight_root = os.path.join(os.path.abspath(os.path.dirname(__file__)), "..")
sys.path.insert(0, camplight_root)


import pytest
from httpretty import HTTPretty
from sentry_plugins.camplight import Request, Campfire, Room, MessageType, Sound


def campfire_url(path=""):
    return "https://foo.campfirenow.com" + path


def stub_get(path, *args, **kwargs):
    HTTPretty.register_uri(HTTPretty.GET, campfire_url(path), *args, **kwargs)


def stub_post(path, *args, **kwargs):
    HTTPretty.register_uri(HTTPretty.POST, campfire_url(path), *args, **kwargs)


def stub_put(path, *args, **kwargs):
    HTTPretty.register_uri(HTTPretty.PUT, campfire_url(path), *args, **kwargs)


class TestRoom(object):
    def setup_class(self):
        HTTPretty.enable()
        self.request = Request(campfire_url(), "some_token")
        self.campfire = Campfire(self.request)
        self.room_id = 27121983
        self.room = Room(self.request, self.room_id)

    def teardown_class(self):
        HTTPretty.disable()

    def test_status(self):
        stub_get(
            "/room/%s.json" % self.room_id,
            body="""
            {"room": {"name": "Danger", "topic": "No serious discussion"}}""",
        )
        room = self.room.status()
        assert room["name"] == "Danger"
        assert room["topic"] == "No serious discussion"

    def test_recent(self):
        stub_get(
            "/room/%s/recent.json" % self.room_id,
            body="""
            {"messages": [{"body": "Hello World", "type": "TextMessage"}]}""",
        )
        messages = self.room.recent()
        assert len(messages) == 1
        assert messages[0]["body"] == "Hello World"
        assert messages[0]["type"] == MessageType.TEXT

    def test_transcript(self):
        stub_get(
            "/room/%s/transcript.json" % self.room_id,
            body="""
            {"messages": [{"body": "Hello World", "type": "TextMessage"}]}""",
        )
        messages = self.room.transcript()
        assert len(messages) == 1
        assert messages[0]["body"] == "Hello World"
        assert messages[0]["type"] == MessageType.TEXT

    def test_transcript_by_date(self):
        date = "2013/08/12"
        stub_get(
            "/room/%s/transcript/%s.json" % (self.room_id, date),
            body="""
            {"messages": [{"body": "Hello World", "type": "TextMessage"}]}""",
        )
        messages = self.room.transcript(date)
        assert len(messages) == 1
        assert messages[0]["body"] == "Hello World"
        assert messages[0]["type"] == MessageType.TEXT

    def test_uploads(self):
        stub_get(
            "/room/%s/uploads.json" % self.room_id,
            body="""
            {"uploads": [{"name": "file.png", "content_type": "image/png"}]}""",
        )
        uploads = self.room.uploads()
        assert len(uploads) == 1
        assert uploads[0]["name"] == "file.png"
        assert uploads[0]["content_type"] == "image/png"

    def test_join(self):
        stub_post("/room/%s/join.json" % self.room_id, body="")
        assert self.room.join() == None

    def test_leave(self):
        stub_post("/room/%s/leave.json" % self.room_id, body="")
        assert self.room.leave() == None

    def test_lock(self):
        stub_post("/room/%s/lock.json" % self.room_id, body="")
        assert self.room.lock() == None

    def test_unlock(self):
        stub_post("/room/%s/unlock.json" % self.room_id, body="")
        assert self.room.unlock() == None

    def test_speak(self):
        body = b'{"message": {"body": "Hello World"}}'
        stub_post("/room/%s/speak.json" % self.room_id, body=body)
        message = self.room.speak("Hello World")
        assert message["body"] == "Hello World"
        assert hasattr(message, "type") == False
        assert HTTPretty.last_request.body == body

    def test_paste(self):
        body = b'{"message": {"body": "Hello World", "type": "PasteMessage"}}'
        stub_post("/room/%s/speak.json" % self.room_id, body=body)
        message = self.room.paste("Hello World")
        assert message["body"] == "Hello World"
        assert message["type"] == MessageType.PASTE
        assert HTTPretty.last_request.body == body

    def test_play(self):
        body = b'{"message": {"body": "yeah", "type": "SoundMessage"}}'
        stub_post("/room/%s/speak.json" % self.room_id, body=body)
        message = self.room.play(Sound.YEAH)
        assert message["body"] == Sound.YEAH
        assert message["type"] == MessageType.SOUND
        assert HTTPretty.last_request.body == body

    def test_set_name(self):
        stub_put("/room/%s.json" % self.room_id, body="")
        assert self.room.set_name("Danger") == None
        assert HTTPretty.last_request.body == b'{"room": {"name": "Danger"}}'

    def test_set_topic(self):
        stub_put("/room/%s.json" % self.room_id, body="")
        assert self.room.set_topic("No serious discussion") == None
        assert HTTPretty.last_request.body == b'{"room": {"topic": "No serious discussion"}}'


if __name__ == "__main__":
    pytest.main(__file__)
