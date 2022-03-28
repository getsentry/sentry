from __future__ import annotations

import hashlib

import requests
from django.conf import settings

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.utils import json

from ..base import SnubaTestCase


class SessionMetricsTestCase(SnubaTestCase):
    """Store metrics instead of sessions"""

    snuba_endpoint = "/tests/entities/{entity}/insert"

    def store_session(self, session):
        """Mimic relays behavior of always emitting a metric for a started session,
        and emitting an additional one if the session is fatal
        https://github.com/getsentry/relay/blob/e3c064e213281c36bde5d2b6f3032c6d36e22520/relay-server/src/actors/envelopes.rs#L357
        """
        user = session.get("distinct_id")

        # This check is not yet reflected in relay, see https://getsentry.atlassian.net/browse/INGEST-464
        user_is_nil = user is None or user == "00000000-0000-0000-0000-000000000000"

        # seq=0 is equivalent to relay's session.init, init=True is transformed
        # to seq=0 in Relay.
        if session["seq"] == 0:  # init
            self._push_metric(
                session, "counter", SessionMetricKey.SESSION, {"session.status": "init"}, +1
            )
            if not user_is_nil:
                self._push_metric(
                    session, "set", SessionMetricKey.USER, {"session.status": "init"}, user
                )

        status = session["status"]

        # Mark the session as errored, which includes fatal sessions.
        if session.get("errors", 0) > 0 or status not in ("ok", "exited"):
            self._push_metric(
                session, "set", SessionMetricKey.SESSION_ERROR, {}, session["session_id"]
            )
            if not user_is_nil:
                self._push_metric(
                    session, "set", SessionMetricKey.USER, {"session.status": "errored"}, user
                )

        if status in ("abnormal", "crashed"):  # fatal
            self._push_metric(
                session, "counter", SessionMetricKey.SESSION, {"session.status": status}, +1
            )
            if not user_is_nil:
                self._push_metric(
                    session, "set", SessionMetricKey.USER, {"session.status": status}, user
                )

        if status != "ok":  # terminal
            if session["duration"] is not None:
                self._push_metric(
                    session,
                    "distribution",
                    SessionMetricKey.SESSION_DURATION,
                    {"session.status": status},
                    session["duration"],
                )

    def bulk_store_sessions(self, sessions):
        for session in sessions:
            self.store_session(session)

    @classmethod
    def _push_metric(cls, session, type, key: SessionMetricKey, tags, value):
        def metric_id(key: SessionMetricKey):
            res = indexer.record(1, key.value)
            assert res is not None, key
            return res

        def tag_key(name):
            res = indexer.record(1, name)
            assert res is not None, name
            return res

        def tag_value(name):
            res = indexer.record(1, name)
            assert res is not None, name
            return res

        base_tags = {
            tag_key(tag): tag_value(session[tag])
            for tag in (
                "release",
                "environment",
            )
            if session[tag] is not None
        }

        extra_tags = {tag_key(k): tag_value(v) for k, v in tags.items()}

        if type == "set":
            # Relay uses a different hashing algorithm, but that's ok
            value = [int.from_bytes(hashlib.md5(value.encode()).digest()[:8], "big")]
        elif type == "distribution":
            value = [value]

        msg = {
            "org_id": session["org_id"],
            "project_id": session["project_id"],
            "metric_id": metric_id(key),
            "timestamp": session["started"],
            "tags": {**base_tags, **extra_tags},
            "type": {"counter": "c", "set": "s", "distribution": "d"}[type],
            "value": value,
            "retention_days": 90,
        }

        cls._send_buckets([msg], entity=f"metrics_{type}s")

    @classmethod
    def _send_buckets(cls, buckets, entity):
        assert (
            requests.post(
                settings.SENTRY_SNUBA + cls.snuba_endpoint.format(entity=entity),
                data=json.dumps(buckets),
            ).status_code
            == 200
        )
