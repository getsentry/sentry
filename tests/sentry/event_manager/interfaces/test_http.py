from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_http_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"request": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("request")

        insta_snapshot({"errors": evt.data.get("errors"), "to_json": interface.to_json()})

    return inner


def test_basic(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com"))


def test_full(make_http_snapshot):
    make_http_snapshot(
        dict(
            method="GET",
            url="http://example.com",
            query_string="foo=bar",
            fragment="foobar",
            headers={"x-foo-bar": "baz"},
            cookies={"foo": "bar"},
            env={"bing": "bong"},
            data="hello world",
        )
    )


def test_query_string_as_dict(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", query_string={"foo": "bar"}))


def test_query_string_as_pairlist(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", query_string=[["foo", "bar"]]))


def test_data_as_dict(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", data={"foo": "bar"}))


def test_urlencoded_data(make_http_snapshot):
    make_http_snapshot(
        dict(
            url="http://example.com",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data="foo=bar",
        )
    )


def test_infer_urlencoded_content_type(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", data="foo=bar"))


def test_json_data(make_http_snapshot):
    make_http_snapshot(
        dict(
            url="http://example.com",
            headers={"Content-Type": "application/json"},
            data='{"foo":"bar"}',
        )
    )


def test_infer_json_content_type(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", data='{"foo":"bar"}'))


def test_cookies_as_string(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", cookies="a=b;c=d"))
    make_http_snapshot(dict(url="http://example.com", cookies="a=b;c=d"))


def test_cookies_in_header(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", headers={"Cookie": "a=b;c=d"}))


def test_cookies_in_header2(make_http_snapshot):
    make_http_snapshot(
        dict(url="http://example.com", headers={"Cookie": "a=b;c=d"}, cookies={"foo": "bar"})
    )


def test_query_string_and_fragment_as_params(make_http_snapshot):
    make_http_snapshot(
        dict(url="http://example.com", query_string=u"foo\ufffd=bar\u2026", fragment="fragment")
    )


def test_query_string_and_fragment_in_url(make_http_snapshot):
    make_http_snapshot(dict(url=u"http://example.com?foo\ufffd=bar#fragment\u2026"))


def test_header_value_list(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", headers={"Foo": ["1", "2"]}))


def test_header_value_str(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", headers={"Foo": 1}))


def test_invalid_method(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", method="1234"))


def test_invalid_method2(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", method="A" * 33))


def test_invalid_method3(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", method="A"))


def test_unknown_method(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", method="TEST"))


def test_unknown_method2(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", method="FOO-BAR"))


def test_unknown_method3(make_http_snapshot):
    make_http_snapshot(dict(url="http://example.com", method="FOO_BAR"))
