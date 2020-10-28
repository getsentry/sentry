from __future__ import absolute_import

from hashlib import md5
from sentry.testutils import TestCase
from sentry.models import EventUser


class EventUserTestCase(TestCase):
    def test_build_hash(self):
        cases = [
            (
                {
                    "ident": "ident",
                    "username": "username",
                    "email": "email",
                    "ip_address": "127.0.0.1",
                },
                "67217d8b401cf5e72bbf5103d60f3e97",
            ),
            (
                {"username": "username", "email": "email", "ip_address": "127.0.0.1"},
                "14c4b06b824ec593239362517f538b29",
            ),
            ({"email": "email", "ip_address": "127.0.0.1"}, "0c83f57c786a0b4a39efab23731c7ebc"),
            ({"ip_address": "127.0.0.1"}, "f528764d624db129b32c21fbca0cb8d6"),
            ({}, None),
        ]
        for kw, value in cases:
            assert EventUser(**kw).build_hash() == value

    def test_tag_value(self):
        cases = [
            (
                {
                    "ident": "ident",
                    "username": "username",
                    "email": "email",
                    "ip_address": "127.0.0.1",
                },
                "id:ident",
            ),
            (
                {"username": "username", "email": "email", "ip_address": "127.0.0.1"},
                "username:username",
            ),
            ({"email": "email", "ip_address": "127.0.0.1"}, "email:email"),
            ({"ip_address": "127.0.0.1"}, "ip:127.0.0.1"),
            ({}, None),
        ]
        for kw, value in cases:
            assert EventUser(**kw).tag_value == value

    def test_attr_from_keyword(self):
        cases = [
            ("id", "ident"),
            ("username", "username"),
            ("email", "email"),
            ("ip", "ip_address"),
        ]
        for keyword, attr in cases:
            assert EventUser.attr_from_keyword(keyword) == attr

    def test_hash_from_tag(self):
        assert EventUser.hash_from_tag("foo:bar:baz") == md5(b"bar:baz").hexdigest()

    def test_for_tags(self):
        eu = EventUser.objects.create(project_id=1, ident="matt")
        assert EventUser.for_tags(1, ["id:matt"]) == {"id:matt": eu}
        assert EventUser.for_tags(1, ["id:doesnotexist"]) == {}
        assert EventUser.for_tags(1, ["id:matt", "id:doesnotexist"]) == {"id:matt": eu}
