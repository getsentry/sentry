import pickle
from unittest import mock

import pytest

from sentry import eventstore, nodestore
from sentry.db.models.fields.node import NodeData, NodeIntegrityFailure
from sentry.eventstore.models import Event, GroupEvent
from sentry.grouping.enhancer import Enhancements
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.models.environment import Environment
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import snuba
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


@region_silo_test
class EventTest(TestCase, PerformanceIssueTestCase):
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
        nodedata_getstate = hasattr(NodeData, "__getstate__")
        with mock.patch.object(NodeData, "__getstate__", nodedata_getstate):
            del NodeData.__getstate__

            # Old worker loading
            event2 = pickle.loads(data)
            assert event2.data == event.data
        assert hasattr(NodeData, "__getstate__")

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

        assert event1.group is not None
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

    def test_transaction_email_subject(self):
        self.project.update_option(
            "mail:subject_template",
            "$shortID - ${tag:environment}@${tag:release} $title",
        )

        event = self.create_performance_issue()
        assert event.get_email_subject() == "BAR-1 - production@0.1 N+1 Query"

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
            assert event.get_environment() == environment

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
                tenant_ids={"referrer": "r", "organization_id": 1234},
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

    def test_snuba_data_transaction(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "timestamp": iso_format(before_now(minutes=1)),
                "start_timestamp": iso_format(before_now(minutes=1, seconds=5)),
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )

        event_from_nodestore = Event(project_id=self.project.id, event_id="a" * 32)

        event_from_snuba = Event(
            project_id=self.project.id,
            event_id="a" * 32,
            snuba_data=snuba.raw_query(
                dataset=Dataset.Transactions,
                selected_columns=[
                    "event_id",
                    "project_id",
                    "group_ids",
                    "timestamp",
                    "message",
                    "type",
                    "transaction",
                    "tags.key",
                    "tags.value",
                ],
                filter_keys={"project_id": [self.project.id], "event_id": ["a" * 32]},
                tenant_ids={"referrer": "r", "organization_id": 1234},
            )["data"][0],
        )
        # TODO: Remove this once snuba is writing group_ids, and we can create groups as part
        # of self.store_event
        event_from_snuba.groups = [self.group]

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

        # Group IDs must be fetched from Snuba since they are not present in nodestore
        assert not event_from_snuba.group_id
        assert event_from_snuba.groups == [self.group]
        assert not event_from_snuba.group

        assert not event_from_nodestore.group_id
        assert not event_from_nodestore.groups
        assert not event_from_nodestore.group

    def test_grouping_reset(self):
        """
        Regression test against a specific mutability bug involving grouping,
        stacktrace normalization and memoized interfaces
        """
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "Hello",
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "foo",
                                },
                                {
                                    "function": "bar",
                                },
                            ]
                        },
                    }
                ]
            },
        }

        enhancement = Enhancements.from_config_string(
            """
            function:foo category=foo_like
            category:foo_like -group
            """,
        )
        grouping_config = {
            "enhancements": enhancement.dumps(),
            "id": "mobile:2021-02-12",
        }

        event1 = Event(
            event_id="a" * 32,
            data=event_data,
            project_id=self.project.id,
        )
        variants1 = event1.get_grouping_variants(grouping_config, normalize_stacktraces=True)

        event2 = Event(
            event_id="b" * 32,
            data=event_data,
            project_id=self.project.id,
        )
        event2.interfaces  # Populate cache
        variants2 = event2.get_grouping_variants(grouping_config, normalize_stacktraces=True)

        assert sorted(v.as_dict()["hash"] for v in variants1.values()) == sorted(
            v.as_dict()["hash"] for v in variants2.values()
        )


@region_silo_test
class EventGroupsTest(TestCase):
    def test_none(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        assert event.groups == []

    def test_snuba(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            snuba_data={"group_ids": [self.group.id]},
            project_id=self.project.id,
        )
        assert event.groups == [self.group]

    def test_passed_explicitly(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
            groups=[self.group],
        )
        assert event.groups == [self.group]

    def test_from_group(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
            group_id=self.group.id,
        )
        assert event.groups == [self.group]

    def test_from_group_snuba(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            snuba_data={"group_id": self.group.id},
            project_id=self.project.id,
        )
        assert event.groups == [self.group]


@region_silo_test
class EventBuildGroupEventsTest(TestCase):
    def test_none(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        assert list(event.build_group_events()) == []

    def test(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
            groups=[self.group],
        )
        assert list(event.build_group_events()) == [GroupEvent.from_event(event, self.group)]

    def test_multiple(self):
        self.group_2 = self.create_group()
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
            groups=[self.group, self.group_2],
        )
        sort_key = lambda group_event: (group_event.event_id, group_event.group_id)
        assert sorted(event.build_group_events(), key=sort_key) == sorted(
            [GroupEvent.from_event(event, self.group), GroupEvent.from_event(event, self.group_2)],
            key=sort_key,
        )


@region_silo_test
class EventForGroupTest(TestCase):
    def test(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        assert GroupEvent.from_event(event, self.group) == GroupEvent(
            self.project.id, event.event_id, self.group, event.data, event._snuba_data
        )


@region_silo_test
class GroupEventFromEventTest(TestCase):
    def test(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        group_event = GroupEvent.from_event(event, self.group)
        assert event.for_group(self.group) == group_event
        # Since event didn't have a cached project, we should query here to fetch it
        with self.assertNumQueries(1):
            group_event.project

    def test_project_cache(self):
        event = Event(
            event_id="a" * 32,
            data={
                "level": "info",
                "message": "Foo bar",
                "culprit": "app/components/events/eventEntries in map",
                "type": "transaction",
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        # This causes the project to be cached
        event.project
        group_event = GroupEvent.from_event(event, self.group)
        # Make sure we don't make additional queries when accessing project here
        with self.assertNumQueries(0):
            group_event.project


@region_silo_test
class GroupEventOccurrenceTest(TestCase, OccurrenceTestMixin):
    def test(self):
        occurrence_data = self.build_occurrence_data(project_id=self.project.id)
        occurrence, group_info = process_event_and_issue_occurrence(
            occurrence_data,
            event_data={
                "event_id": occurrence_data["event_id"],
                "project_id": occurrence_data["project_id"],
                "level": "info",
            },
        )
        assert group_info is not None

        event = Event(
            occurrence_data["project_id"],
            occurrence_data["event_id"],
            group_info.group.id,
            data={},
            snuba_data={"occurrence_id": occurrence.id},
        )
        assert event.group is not None
        with mock.patch.object(IssueOccurrence, "fetch", wraps=IssueOccurrence.fetch) as fetch_mock:
            group_event = event.for_group(event.group)
            assert group_event.occurrence == occurrence
            assert fetch_mock.call_count == 1
            # Access the property again, call count shouldn't increase since we're cached
            group_event.occurrence
            assert fetch_mock.call_count == 1
            # Call count should increase if we do it a second time
            group_event.occurrence = None
            assert group_event.occurrence == occurrence
            assert fetch_mock.call_count == 2


@django_db_all
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


@region_silo_test
class EventNodeStoreTest(TestCase):
    def test_event_node_id(self):
        # Create an event without specifying node_id. A node_id should be generated
        e1 = Event(project_id=1, event_id="abc", data={"foo": "bar"})
        assert e1.data.id is not None, "We should have generated a node_id for this event"
        e1_node_id = e1.data.id
        e1.data.save()
        e1_body = nodestore.backend.get(e1_node_id)
        assert e1_body == {"foo": "bar"}, "The event body should be in nodestore"

        e1 = Event(project_id=1, event_id="abc")

        assert e1.data.data == {"foo": "bar"}, "The event body should be loaded from nodestore"
        assert e1.data.id == e1_node_id, "The event's node_id should be the same after load"

        # Event with no data should not be saved to nodestore
        e2 = Event(project_id=1, event_id="mno", data=None)
        e2_node_id = e2.data.id
        assert e2.data.data == {}  # NodeData returns {} by default
        eventstore.backend.bind_nodes([e2], "data")
        assert e2.data.data == {}
        e2_body = nodestore.backend.get(e2_node_id)
        assert e2_body is None

    def test_screams_bloody_murder_when_ref_fails(self):
        project1 = self.create_project()
        project2 = self.create_project()
        invalid_event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project1.id,
        )
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-2"],
            },
            project_id=project2.id,
        )
        event.data.bind_ref(invalid_event)
        event.data.save()

        assert event.data.get_ref(event) != event.data.get_ref(invalid_event)

        # Unload node data to force reloading from nodestore
        event.data._node_data = None

        with pytest.raises(NodeIntegrityFailure):
            eventstore.backend.bind_nodes([event])

    def test_accepts_valid_ref(self):
        self.store_event(data={"event_id": "a" * 32}, project_id=self.project.id)
        event = Event(project_id=self.project.id, event_id="a" * 32)
        event.data.bind_ref(event)
        assert event.data.ref == event.project.id

    def test_basic_ref_binding(self):
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.data.get_ref(event) == event.project.id
