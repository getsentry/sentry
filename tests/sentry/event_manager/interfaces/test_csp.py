# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.interfaces.security import Csp
from sentry.event_manager import EventManager


@pytest.fixture
def make_csp_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"csp": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        interface = evt.interfaces.get("csp")

        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "message": interface and interface.get_message(),
                "culprit": interface and interface.get_culprit(),
                "origin": interface and interface.get_origin(),
                "tags": interface and interface.get_tags(),
            }
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
            violated_directive="style-src http://cdn.example.com",
            effective_directive="style-src",
        ),
        dict(
            document_uri="http://example.com/foo",
            violated_directive="style-src cdn.example.com",
            effective_directive="style-src",
        ),
        dict(
            document_uri="https://example.com/foo",
            violated_directive="style-src cdn.example.com",
            effective_directive="style-src",
        ),
        dict(
            document_uri="http://example.com/foo",
            violated_directive="style-src https://cdn.example.com",
            effective_directive="style-src",
        ),
        dict(
            document_uri="http://example.com/foo",
            violated_directive="style-src http://example.com",
            effective_directive="style-src",
        ),
        dict(
            document_uri="http://example.com/foo",
            violated_directive="style-src http://example2.com example.com",
            effective_directive="style-src",
        ),
    ],
)
def test_get_culprit(make_csp_snapshot, input):
    make_csp_snapshot(input)


def test_get_tags_stripe(make_csp_snapshot):
    make_csp_snapshot(
        dict(
            document_uri="https://example.com",
            blocked_uri="https://api.stripe.com/v1/tokens?card[number]=xxx",
            effective_directive="script-src",
        )
    )


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


def test_real_report(make_csp_snapshot):
    raw_report = {
        "csp-report": {
            "document-uri": "https://sentry.io/sentry/csp/issues/88513416/",
            "referrer": "https://sentry.io/sentry/sentry/releases/7329107476ff14cfa19cf013acd8ce47781bb93a/",
            "violated-directive": "script-src",
            "effective-directive": "script-src",
            "original-policy": "default-src *; script-src 'make_csp_snapshot' 'unsafe-eval' 'unsafe-inline' e90d271df3e973c7.global.ssl.fastly.net cdn.ravenjs.com assets.zendesk.com ajax.googleapis.com ssl.google-analytics.com www.googleadservices.com analytics.twitter.com platform.twitter.com *.pingdom.net js.stripe.com api.stripe.com statuspage-production.s3.amazonaws.com s3.amazonaws.com *.google.com www.gstatic.com aui-cdn.atlassian.com *.atlassian.net *.jira.com *.zopim.com; font-src * data:; connect-src * wss://*.zopim.com; style-src 'make_csp_snapshot' 'unsafe-inline' e90d271df3e973c7.global.ssl.fastly.net s3.amazonaws.com aui-cdn.atlassian.com fonts.googleapis.com; img-src * data: blob:; report-uri https://sentry.io/api/54785/csp-report/?sentry_key=f724a8a027db45f5b21507e7142ff78e&sentry_release=39662eb9734f68e56b7f202260bb706be2f4cee7",
            "disposition": "enforce",
            "blocked-uri": "http://baddomain.com/test.js?_=1515535030116",
            "line-number": 24,
            "column-number": 66270,
            "source-file": "https://e90d271df3e973c7.global.ssl.fastly.net/_static/f0c7c026a4b2a3d2b287ae2d012c9924/sentry/dist/vendor.js",
            "status-code": 0,
            "script-sample": "",
        }
    }
    interface = Csp.from_raw(raw_report)
    make_csp_snapshot(interface.to_json())
