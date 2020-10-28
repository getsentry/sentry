# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import unittest

from collections import OrderedDict

from sentry.utils.canonical import CanonicalKeyView, CanonicalKeyDict


class CanonicalKeyViewTests(unittest.TestCase):
    canonical_data = OrderedDict(
        [
            ("release", "asdf"),
            ("exception", {"type": "DemoException"}),
            ("user", {"id": "DemoUser"}),
        ]
    )

    legacy_data = OrderedDict(
        [
            ("release", "asdf"),
            ("sentry.interfaces.Exception", {"type": "DemoException"}),
            ("sentry.interfaces.User", {"id": "DemoUser"}),
        ]
    )

    mixed_data = OrderedDict(
        [
            ("release", "asdf"),
            ("sentry.interfaces.User", {"id": "INVALID"}),
            ("exception", {"type": "DemoException"}),
            ("user", {"id": "DemoUser"}),
            ("sentry.interfaces.Exception", {"type": "INVALID"}),
        ]
    )

    def test_len(self):
        assert len(CanonicalKeyView(self.canonical_data)) == 3
        assert len(CanonicalKeyView(self.legacy_data)) == 3
        assert len(CanonicalKeyView(self.mixed_data)) == 3

    def test_iter(self):
        assert list(CanonicalKeyView(self.canonical_data).keys()) == [
            "release",
            "exception",
            "user",
        ]
        assert list(CanonicalKeyView(self.legacy_data).keys()) == ["release", "exception", "user"]
        assert list(CanonicalKeyView(self.mixed_data).keys()) == ["release", "exception", "user"]

    def test_contains(self):
        assert "user" in CanonicalKeyView(self.canonical_data)
        assert "user" in CanonicalKeyView(self.legacy_data)
        assert "user" in CanonicalKeyView(self.mixed_data)

        assert "sentry.interfaces.User" in CanonicalKeyView(self.canonical_data)
        assert "sentry.interfaces.User" in CanonicalKeyView(self.legacy_data)
        assert "sentry.interfaces.User" in CanonicalKeyView(self.mixed_data)

    def test_getitem(self):
        assert CanonicalKeyView(self.canonical_data)["user"] == {"id": "DemoUser"}
        assert CanonicalKeyView(self.legacy_data)["user"] == {"id": "DemoUser"}
        assert CanonicalKeyView(self.mixed_data)["user"] == {"id": "DemoUser"}

        assert CanonicalKeyView(self.canonical_data)["sentry.interfaces.User"] == {"id": "DemoUser"}
        assert CanonicalKeyView(self.legacy_data)["sentry.interfaces.User"] == {"id": "DemoUser"}
        assert CanonicalKeyView(self.mixed_data)["sentry.interfaces.User"] == {"id": "DemoUser"}


class CanonicalKeyDictTests(unittest.TestCase):
    canonical_data = {
        "release": "asdf",
        "exception": {"type": "DemoException"},
        "user": {"id": "DemoUser"},
    }

    def test_canonical(self):
        assert (
            CanonicalKeyDict(
                {
                    "release": "asdf",
                    "exception": {"type": "DemoException"},
                    "user": {"id": "DemoUser"},
                }
            )
            == self.canonical_data
        )

    def test_legacy(self):
        assert (
            CanonicalKeyDict(
                {
                    "release": "asdf",
                    "sentry.interfaces.Exception": {"type": "DemoException"},
                    "sentry.interfaces.User": {"id": "DemoUser"},
                }
            )
            == self.canonical_data
        )

    def test_mixed(self):
        assert (
            CanonicalKeyDict(
                {
                    "release": "asdf",
                    "exception": {"type": "DemoException"},
                    "user": {"id": "DemoUser"},
                    "sentry.interfaces.Exception": {"type": "INVALID"},
                    "sentry.interfaces.User": {"id": "INVALID"},
                }
            )
            == self.canonical_data
        )

    def test_getitem_setitem(self):
        d = CanonicalKeyDict({"user": {"id": "DemoUser"}})
        d["user"] = {"id": "other"}
        assert d["user"] == {"id": "other"}
        assert d["sentry.interfaces.User"] == {"id": "other"}

        d = CanonicalKeyDict({"user": {"id": "DemoUser"}})
        d["sentry.interfaces.User"] = {"id": "other"}
        assert d["user"] == {"id": "other"}
        assert d["sentry.interfaces.User"] == {"id": "other"}

    def test_delitem(self):
        d = CanonicalKeyDict({"user": {"id": "DemoUser"}})
        del d["user"]
        assert d == {}

        d = CanonicalKeyDict({"user": {"id": "DemoUser"}})
        del d["sentry.interfaces.User"]
        assert d == {}

    def test_contains(self):
        d = CanonicalKeyDict({"user": {"id": "DemoUser"}})
        "user" in d
        "sentry.interfaces.User" in d

    def test_len(self):
        assert (
            len(
                CanonicalKeyDict(
                    {
                        "release": "asdf",
                        "exception": {"type": "DemoException"},
                        "user": {"id": "DemoUser"},
                        "sentry.interfaces.Exception": {"type": "INVALID"},
                        "sentry.interfaces.User": {"id": "INVALID"},
                    }
                )
            )
            == 3
        )


class LegacyCanonicalKeyDictTests(unittest.TestCase):
    canonical_data = {
        "release": "asdf",
        "sentry.interfaces.Exception": {"type": "DemoException"},
        "sentry.interfaces.User": {"id": "DemoUser"},
    }

    def test_canonical(self):
        assert (
            CanonicalKeyDict(
                {
                    "release": "asdf",
                    "exception": {"type": "DemoException"},
                    "user": {"id": "DemoUser"},
                },
                legacy=True,
            )
            == self.canonical_data
        )

    def test_legacy(self):
        assert (
            CanonicalKeyDict(
                {
                    "release": "asdf",
                    "sentry.interfaces.Exception": {"type": "DemoException"},
                    "sentry.interfaces.User": {"id": "DemoUser"},
                },
                legacy=True,
            )
            == self.canonical_data
        )

    def test_mixed(self):
        assert (
            CanonicalKeyDict(
                {
                    "release": "asdf",
                    "sentry.interfaces.Exception": {"type": "DemoException"},
                    "sentry.interfaces.User": {"id": "DemoUser"},
                    "exception": {"type": "INVALID"},
                    "user": {"id": "INVALID"},
                },
                legacy=True,
            )
            == self.canonical_data
        )

    def test_getitem_setitem(self):
        d = CanonicalKeyDict({"user": {"id": "DemoUser"}}, legacy=True)
        d["user"] = {"id": "other"}
        assert d["user"] == {"id": "other"}
        assert d["sentry.interfaces.User"] == {"id": "other"}

        d = CanonicalKeyDict({"user": {"id": "DemoUser"}}, legacy=True)
        d["sentry.interfaces.User"] = {"id": "other"}
        assert d["user"] == {"id": "other"}
        assert d["sentry.interfaces.User"] == {"id": "other"}


class DoubleAliasingTests(unittest.TestCase):
    def test_canonical(self):
        view = CanonicalKeyView({"logentry": "foo"})
        assert len(view) == 1
        assert list(view.keys()) == ["logentry"]

        assert "logentry" in view
        assert "sentry.interfaces.Message" in view
        assert "message" in view

        assert view["logentry"] == "foo"
        assert view["sentry.interfaces.Message"] == "foo"
        assert view["message"] == "foo"

    def test_legacy_first(self):
        view = CanonicalKeyView({"sentry.interfaces.Message": "foo"})
        assert len(view) == 1
        assert list(view.keys()) == ["logentry"]

        assert "logentry" in view
        assert "sentry.interfaces.Message" in view
        assert "message" in view

        assert view["logentry"] == "foo"
        assert view["sentry.interfaces.Message"] == "foo"
        assert view["message"] == "foo"

    def test_legacy_second(self):
        view = CanonicalKeyView({"message": "foo"})
        assert len(view) == 1
        assert list(view.keys()) == ["logentry"]

        assert "logentry" in view
        assert "sentry.interfaces.Message" in view
        assert "message" in view

        assert view["logentry"] == "foo"
        assert view["sentry.interfaces.Message"] == "foo"
        assert view["message"] == "foo"

    def test_override(self):
        view = CanonicalKeyView({"logentry": "foo", "sentry.interfaces.Message": "bar"})
        assert len(view) == 1
        assert list(view.keys()) == ["logentry"]

        assert "logentry" in view
        assert "sentry.interfaces.Message" in view
        assert "message" in view

        assert view["logentry"] == "foo"
        assert view["sentry.interfaces.Message"] == "foo"
        assert view["message"] == "foo"

    def test_two_legacy(self):
        view = CanonicalKeyView({"message": "bar", "sentry.interfaces.Message": "foo"})
        assert len(view) == 1
        assert list(view.keys()) == ["logentry"]

        assert "logentry" in view
        assert "sentry.interfaces.Message" in view
        assert "message" in view

        assert view["logentry"] == "foo"
        assert view["sentry.interfaces.Message"] == "foo"
        assert view["message"] == "foo"
