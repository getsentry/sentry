import unittest

import pytest

from sentry.testutils.helpers.options import override_options
from sentry.utils.canonical import CanonicalKeyDict


@pytest.fixture(autouse=True)
def _disable_fallback_logging():
    with override_options({"canonical-fallback.send-error-to-sentry": 0}):
        yield


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
        assert "user" in d
        assert "sentry.interfaces.User" in d

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


def _trigger_canonical_fallback():
    CanonicalKeyDict({"message": "hi"})


@override_options({"canonical-fallback.send-error-to-sentry": 0})
def test_canonical_no_logging_to_sentry_when_disabled(caplog):
    _trigger_canonical_fallback()

    assert not caplog.records


@override_options({"canonical-fallback.send-error-to-sentry": 1})
def test_canonical_logging_to_sentry_when_enabled(caplog):
    _trigger_canonical_fallback()

    (record,) = caplog.records
    assert record.levelname == "ERROR"
    assert record.exc_info == (None, None, None)
    assert record.message == "canonical fallback"
