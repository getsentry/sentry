from __future__ import absolute_import

import pytest

from sentry.utils.compat import pickle
from sentry.db.models.fields.node import NodeData
from sentry.eventstore.models import Event
from sentry.models import Environment
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils import snuba


class EventTest(TestCase):
    def test_pickling_compat(self):
        event = self.store_event(
            data={
                "message": "Hello World!",
                "tags": {"logger": "foobar", "site": "foo", "server_name": "bar"},
            },
            project_id=self.project.id,
        )

        # Ensure we load and memoize the interfaces as well.
        assert len(event.interfaces) > 0

        # When we pickle an event we need to make sure our canonical code
        # does not appear here or it breaks old workers.
        data = pickle.dumps(event, protocol=2)
        assert b"canonical" not in data

        # For testing we remove the backwards compat support in the
        # `NodeData` as well.
        nodedata_getstate = NodeData.__getstate__
        del NodeData.__getstate__

        # Old worker loading
        try:
            event2 = pickle.loads(data)
            assert event2.data == event.data
        finally:
            NodeData.__getstate__ = nodedata_getstate

        # New worker loading
        event2 = pickle.loads(data)
        assert event2.data == event.data

    def test_event_as_dict(self):
        event = self.store_event(data={"message": "Hello World!"}, project_id=self.project.id)

        d = event.as_dict()
        assert d["logentry"] == {"formatted": "Hello World!", "message": None, "params": None}

    def test_email_subject(self):
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Foo bar",
                "level": "info",
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Foo bar",
                "level": "error",
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        group = event1.group

        group.level = 30

        assert event1.get_email_subject() == "BAR-1 - Foo bar"
        assert event2.get_email_subject() == "BAR-1 - Foo bar"

    def test_email_subject_with_template(self):
        self.project.update_option(
            "mail:subject_template",
            "$shortID - ${tag:environment}@${tag:release} $$ $title ${tag:invalid} $invalid",
        )

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "production",
                "level": "info",
                "release": "0",
                "message": "baz",
            },
            project_id=self.project.id,
        )

        assert event1.get_email_subject() == "BAR-1 - production@0 $ baz ${tag:invalid} $invalid"

    def test_as_dict_hides_client_ip(self):
        event = self.store_event(
            data={"sdk": {"name": "foo", "version": "1.0", "client_ip": "127.0.0.1"}},
            project_id=self.project.id,
        )
        result = event.as_dict()
        assert result["sdk"] == {
            "name": "foo",
            "version": "1.0",
            "integrations": None,
            "packages": None,
        }

    def test_get_environment(self):
        environment = Environment.get_or_create(self.project, "production")
        event = self.store_event(data={"environment": "production"}, project_id=self.project.id)

        assert event.get_environment() == environment

        with self.assertNumQueries(0):
            event.get_environment() == environment

    def test_ip_address(self):
        event = self.store_event(
            data={
                "user": {"ip_address": "127.0.0.1"},
                "request": {"url": "http://some.com", "env": {"REMOTE_ADDR": "::1"}},
            },
            project_id=self.project.id,
        )
        assert event.ip_address == "127.0.0.1"

        event = self.store_event(
            data={
                "user": {"ip_address": None},
                "request": {"url": "http://some.com", "env": {"REMOTE_ADDR": "::1"}},
            },
            project_id=self.project.id,
        )
        assert event.ip_address == "::1"

        event = self.store_event(
            data={
                "user": None,
                "request": {"url": "http://some.com", "env": {"REMOTE_ADDR": "::1"}},
            },
            project_id=self.project.id,
        )
        assert event.ip_address == "::1"

        event = self.store_event(
            data={"request": {"url": "http://some.com", "env": {"REMOTE_ADDR": "::1"}}},
            project_id=self.project.id,
        )
        assert event.ip_address == "::1"

        event = self.store_event(
            data={"request": {"url": "http://some.com", "env": {"REMOTE_ADDR": None}}},
            project_id=self.project.id,
        )
        assert event.ip_address is None

        event = self.store_event(data={}, project_id=self.project.id)
        assert event.ip_address is None

    def test_issueless_event(self):
        min_ago = iso_format(before_now(minutes=1))

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "timestamp": min_ago,
                "start_timestamp": min_ago,
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        assert event.group is None
        assert event.culprit == "app/components/events/eventEntries in map"

    def test_snuba_data(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Hello World!",
                "tags": {"logger": "foobar", "site": "foo", "server_name": "bar"},
                "user": {"id": "test", "email": "test@test.com"},
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )

        event_from_nodestore = Event(project_id=self.project.id, event_id="a" * 32)

        event_from_snuba = Event(
            project_id=self.project.id,
            event_id="a" * 32,
            snuba_data=snuba.raw_query(
                selected_columns=[
                    "event_id",
                    "project_id",
                    "group_id",
                    "timestamp",
                    "culprit",
                    "location",
                    "message",
                    "title",
                    "type",
                    "transaction",
                    "tags.key",
                    "tags.value",
                    "email",
                    "ip_address",
                    "user_id",
                    "username",
                ],
                filter_keys={"project_id": [self.project.id], "event_id": ["a" * 32]},
            )["data"][0],
        )

        assert event_from_nodestore.event_id == event_from_snuba.event_id
        assert event_from_nodestore.project_id == event_from_snuba.project_id
        assert event_from_nodestore.project == event_from_snuba.project
        assert event_from_nodestore.timestamp == event_from_snuba.timestamp
        assert event_from_nodestore.datetime == event_from_snuba.datetime
        assert event_from_nodestore.title == event_from_snuba.title
        assert event_from_nodestore.message == event_from_snuba.message
        assert event_from_nodestore.platform == event_from_snuba.platform
        assert event_from_nodestore.location == event_from_snuba.location
        assert event_from_nodestore.culprit == event_from_snuba.culprit

        assert event_from_nodestore.get_minimal_user() == event_from_snuba.get_minimal_user()
        assert event_from_nodestore.ip_address == event_from_snuba.ip_address
        assert event_from_nodestore.tags == event_from_snuba.tags

        # Group ID must be fetched from Snuba since it is not present in nodestore
        assert event_from_snuba.group_id
        assert event_from_snuba.group

        assert not event_from_nodestore.group_id
        assert not event_from_nodestore.group


@pytest.mark.django_db
def test_renormalization(monkeypatch, factories, task_runner, default_project):
    from sentry_relay.processing import StoreNormalizer

    old_normalize = StoreNormalizer.normalize_event
    normalize_mock_calls = []

    def normalize(*args, **kwargs):
        normalize_mock_calls.append(1)
        return old_normalize(*args, **kwargs)

    monkeypatch.setattr("sentry_relay.processing.StoreNormalizer.normalize_event", normalize)

    with task_runner():
        factories.store_event(
            data={"event_id": "a" * 32, "environment": "production"}, project_id=default_project.id
        )

    # Assert we only renormalize this once. If this assertion fails it's likely
    # that you will encounter severe performance issues during event processing
    # or postprocessing.
    assert len(normalize_mock_calls) == 1
