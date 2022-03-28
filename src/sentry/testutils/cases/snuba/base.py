from __future__ import annotations

import time
from contextlib import contextmanager
from unittest import mock
from uuid import uuid4

import pytest
import requests
from django.conf import settings

from sentry import eventstore
from sentry.eventstream.snuba import SnubaEventStream
from sentry.tagstore.snuba import SnubaTagStorage
from sentry.utils import json
from sentry.utils.snuba import _snuba_pool

from ...factories import Factories
from ...skips import requires_snuba
from ..base import BaseTestCase


@pytest.mark.snuba
@requires_snuba
class SnubaTestCase(BaseTestCase):
    """
    Mixin for enabling test case classes to talk to snuba
    Useful when you are working on acceptance tests or integration
    tests that require snuba.
    """

    def setUp(self):
        super().setUp()
        self.init_snuba()

    @pytest.fixture(autouse=True)
    def initialize(self, reset_snuba, call_snuba):
        self.call_snuba = call_snuba

    @contextmanager
    def disable_snuba_query_cache(self):
        self.snuba_update_config({"use_readthrough_query_cache": 0, "use_cache": 0})
        yield
        self.snuba_update_config({"use_readthrough_query_cache": None, "use_cache": None})

    @classmethod
    def snuba_get_config(cls):
        return _snuba_pool.request("GET", "/config.json").data

    @classmethod
    def snuba_update_config(cls, config_vals):
        return _snuba_pool.request("POST", "/config.json", body=json.dumps(config_vals))

    def init_snuba(self):
        self.snuba_eventstream = SnubaEventStream()
        self.snuba_tagstore = SnubaTagStorage()

    def store_event(self, *args, **kwargs):
        with mock.patch("sentry.eventstream.insert", self.snuba_eventstream.insert):
            stored_event = Factories.store_event(*args, **kwargs)
            stored_group = stored_event.group
            if stored_group is not None:
                self.store_group(stored_group)
            return stored_event

    def wait_for_event_count(self, project_id, total, attempts=2):
        """
        Wait until the event count reaches the provided value or until attempts is reached.

        Useful when you're storing several events and need to ensure that snuba/clickhouse
        state has settled.
        """
        # Verify that events have settled in snuba's storage.
        # While snuba is synchronous, clickhouse isn't entirely synchronous.
        attempt = 0
        snuba_filter = eventstore.Filter(project_ids=[project_id])
        last_events_seen = 0

        while attempt < attempts:
            events = eventstore.get_events(snuba_filter)
            last_events_seen = len(events)
            if len(events) >= total:
                break
            attempt += 1
            time.sleep(0.05)
        if attempt == attempts:
            assert (
                False
            ), f"Could not ensure that {total} event(s) were persisted within {attempt} attempt(s). Event count is instead currently {last_events_seen}."

    def bulk_store_sessions(self, sessions):
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/sessions/insert", data=json.dumps(sessions)
            ).status_code
            == 200
        )

    def build_session(self, **kwargs):
        session = {
            "session_id": str(uuid4()),
            "distinct_id": str(uuid4()),
            "status": "ok",
            "seq": 0,
            "retention_days": 90,
            "duration": 60.0,
            "errors": 0,
            "started": time.time() // 60 * 60,
            "received": time.time(),
        }
        # Support both passing the values for these field directly, and the full objects
        translators = [
            ("release", "version", "release"),
            ("environment", "name", "environment"),
            ("project_id", "id", "project"),
            ("org_id", "id", "organization"),
        ]
        for key, attr, default_attr in translators:
            if key not in kwargs:
                kwargs[key] = getattr(self, default_attr)
            val = kwargs[key]
            kwargs[key] = getattr(val, attr, val)
        session.update(kwargs)
        return session

    def store_session(self, session):
        self.bulk_store_sessions([session])

    def store_group(self, group):
        data = [self.__wrap_group(group)]
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/groupedmessage/insert", data=json.dumps(data)
            ).status_code
            == 200
        )

    def store_outcome(self, group):
        data = [self.__wrap_group(group)]
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/outcomes/insert", data=json.dumps(data)
            ).status_code
            == 200
        )

    def to_snuba_time_format(self, datetime_value):
        date_format = "%Y-%m-%d %H:%M:%S%z"
        return datetime_value.strftime(date_format)

    def __wrap_group(self, group):
        return {
            "event": "change",
            "kind": "insert",
            "table": "sentry_groupedmessage",
            "columnnames": [
                "id",
                "logger",
                "level",
                "message",
                "status",
                "times_seen",
                "last_seen",
                "first_seen",
                "data",
                "score",
                "project_id",
                "time_spent_total",
                "time_spent_count",
                "resolved_at",
                "active_at",
                "is_public",
                "platform",
                "num_comments",
                "first_release_id",
                "short_id",
            ],
            "columnvalues": [
                group.id,
                group.logger,
                group.level,
                group.message,
                group.status,
                group.times_seen,
                self.to_snuba_time_format(group.last_seen),
                self.to_snuba_time_format(group.first_seen),
                group.data,
                group.score,
                group.project.id,
                group.time_spent_total,
                group.time_spent_count,
                group.resolved_at,
                self.to_snuba_time_format(group.active_at),
                group.is_public,
                group.platform,
                group.num_comments,
                group.first_release.id if group.first_release else None,
                group.short_id,
            ],
        }

    def snuba_insert(self, events):
        "Write a (wrapped) event (or events) to Snuba."

        if not isinstance(events, list):
            events = [events]

        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/events/insert", data=json.dumps(events)
            ).status_code
            == 200
        )
