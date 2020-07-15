# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_csp_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"csp": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        interface = evt.interfaces.get("csp")

        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


def test_basic(make_csp_snapshot):
    make_csp_snapshot(
        dict(
            document_uri="http://example.com",
            violated_directive="style-src cdn.example.com",
            blocked_uri="http://example.com/lol.css",
            effective_directive="style-src",
        )
    )


def test_coerce_blocked_uri_if_missing(make_csp_snapshot):
    make_csp_snapshot(dict(document_uri="http://example.com", effective_directive="script-src"))


@pytest.mark.parametrize(
    "input",
    [
        dict(
            document_uri="http://example.com/foo",
            effective_directive="img-src",
            blocked_uri="http://google.com/foo",
        ),
        dict(
            document_uri="http://example.com/foo", effective_directive="style-src", blocked_uri=""
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="script-src",
            blocked_uri="",
            violated_directive="script-src 'unsafe-inline'",
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="script-src",
            blocked_uri="",
            violated_directive="script-src 'unsafe-eval'",
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="script-src",
            blocked_uri="",
            violated_directive="script-src example.com",
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="script-src",
            blocked_uri="data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D",
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="script-src",
            blocked_uri="data",
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="style-src-elem",
            blocked_uri="http://fonts.google.com/foo",
        ),
        dict(
            document_uri="http://example.com/foo",
            effective_directive="script-src-elem",
            blocked_uri="http://cdn.ajaxapis.com/foo",
        ),
    ],
)
def test_get_message(make_csp_snapshot, input):
    make_csp_snapshot(input)
