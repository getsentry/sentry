# -*- coding: utf-8 -*-

"""
camplight.api
~~~~~~~~~~~~~

This module implements the Campfire API.

"""

import requests
import json

from .exceptions import *

__all__ = ["Request", "Campfire", "Room", "MessageType", "Sound"]


class Request(object):
    def __init__(self, url, token, verbose=None):
        self.url = url
        self._auth = (token, "")
        self.verbose = verbose

    def _request(self, method, path, data=None):
        url = self.url + path + ".json"

        headers = None
        if data is not None:
            data = json.dumps(data)
            headers = {"Content-Type": "application/json"}

        r = requests.request(method, url, data=data, headers=headers, auth=self._auth)
        r.raise_for_status()

        if self.verbose is not None:
            self.verbose.write(r.text + "\n")

        return r.json() if r.text.strip() else None

    def get(self, *args, **kwargs):
        return self._request("GET", *args, **kwargs)

    def post(self, *args, **kwargs):
        return self._request("POST", *args, **kwargs)

    def put(self, *args, **kwargs):
        return self._request("PUT", *args, **kwargs)


class Campfire(object):
    def __init__(self, request):
        self.request = request

    def account(self):
        return self.request.get("/account")["account"]

    def rooms(self):
        return self.request.get("/rooms")["rooms"]

    def _room_by_name(self, name):
        try:
            return [r for r in self.rooms() if r["name"] == name][0]
        except IndexError:
            raise RoomNotFoundError('Cannot find room "%s"' % name)

    def room(self, room_id):
        try:
            int(room_id)
        except (TypeError, ValueError, OverflowError):
            room_id = self._room_by_name(room_id)["id"]
        return Room(self.request, room_id)

    def user(self, user_id=None):
        if user_id is None:
            user_id = "me"
        return self.request.get("/users/%s" % user_id)["user"]

    def presence(self):
        return self.request.get("/presence")["rooms"]

    def search(self, term):
        return self.request.get("/search/%s" % term)["messages"]


class Room(object):
    def __init__(self, request, room_id):
        self.request = request
        self.room_id = room_id
        self._path = "/room/%s" % self.room_id

    def status(self):
        return self.request.get(self._path)["room"]

    def recent(self):
        return self.request.get(self._path + "/recent")["messages"]

    def transcript(self, date=None):
        if date is not None:
            path = self._path + "/transcript/" + date
        else:
            path = self._path + "/transcript"
        return self.request.get(path)["messages"]

    def uploads(self):
        return self.request.get(self._path + "/uploads")["uploads"]

    def join(self):
        self.request.post(self._path + "/join")

    def leave(self):
        self.request.post(self._path + "/leave")

    def lock(self):
        self.request.post(self._path + "/lock")

    def unlock(self):
        self.request.post(self._path + "/unlock")

    def speak(self, message, type_=None):
        params = {"body": message}
        if type_ is not None:
            params["type"] = type_
        data = {"message": params}
        return self.request.post(self._path + "/speak", data=data)["message"]

    def paste(self, message):
        return self.speak(message, MessageType.PASTE)

    def play(self, sound):
        return self.speak(sound, MessageType.SOUND)

    def update(self, name=None, topic=None):
        params = {}
        if name is not None:
            params["name"] = name
        if topic is not None:
            params["topic"] = topic
        self.request.put(self._path, data={"room": params})

    def set_name(self, name):
        return self.update(name=name)

    def set_topic(self, topic):
        return self.update(topic=topic)


class MessageType(object):
    TEXT = "TextMessage"
    PASTE = "PasteMessage"
    SOUND = "SoundMessage"
    TWEET = "TweetMessage"


class Sound(object):
    # hard to keep this list up-to-date
    FIFTYSIXK = "56k"
    BUELLER = "bueller"
    CRICKETS = "crickets"
    DANGERZONE = "dangerzone"
    DEEPER = "deeper"
    DRAMA = "drama"
    GREATJOB = "greatjob"
    HORN = "horn"
    HORROR = "horror"
    INCONCEIVABLE = "inconceivable"
    LIVE = "live"
    LOGGINS = "loggins"
    NOOOO = "noooo"
    NYAN = "nyan"
    OHMY = "ohmy"
    OHYEAH = "ohyeah"
    PUSHIT = "pushit"
    RIMSHOT = "rimshot"
    SAX = "sax"
    SECRET = "secret"
    TADA = "tada"
    TMYK = "tmyk"
    TROMBONE = "trombone"
    VUVUZELA = "vuvuzela"
    YEAH = "yeah"
    YODEL = "yodel"
