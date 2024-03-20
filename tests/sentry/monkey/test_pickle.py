import pickle

import pytest

from sentry.testutils.helpers.options import override_options


@pytest.fixture(autouse=True)
def assert_using_monkeypatched_pickle():
    assert pickle.loads.__module__.startswith("sentry.")


def _load_bad_pickle():
    # a python 2 pickle of `u'\u2603'.encode('UTF-8')` with protocol 2
    # results in mojibake
    assert pickle.loads(b"\x80\x02U\x03\xe2\x98\x83q\x00.") == "â\x98\x83"


@override_options({"pickle.send-error-to-sentry": 0})
def test_pickle_loads_no_logging_to_sentry_when_disabled(caplog):
    _load_bad_pickle()

    # no sentry logging when we have disabled the option
    assert not caplog.records


@override_options({"pickle.send-error-to-sentry": 1})
def test_pickle_loads_logging_to_sentry(caplog):
    _load_bad_pickle()

    (record,) = caplog.records
    assert record.levelname == "ERROR"
    assert record.exc_info == (None, None, None)
    expected = "pickle.compat_pickle_loads.had_unicode_decode_error.UnicodeDecodeError: 'ascii' codec can't decode byte 0xe2 in position 0: ordinal not in range(128)"
    assert record.message == expected
