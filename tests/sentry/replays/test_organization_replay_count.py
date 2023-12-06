from __future__ import annotations

import datetime
import uuid
from typing import Any

import pytest
from django.db.models import F
from django.urls import reverse

from sentry.models.project import Project
from sentry.replays.endpoints.organization_replay_count import project_in_org_has_sent_replay
from sentry.replays.testutils import mock_replay
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import (
    APITestCase,
    PerformanceIssueTestCase,
    ReplaysSnubaTestCase,
    SnubaTestCase,
)
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationReplayCountEndpointTest(
    APITestCase, SnubaTestCase, ReplaysSnubaTestCase, PerformanceIssueTestCase
):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-replay-count",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {"organizations:session-replay": True}

    def test_simple(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay2_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay3_id,
            )
        )
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid.uuid4().hex,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay2_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": "z" * 32},  # a replay id that doesn't exist
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_c = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay3_id},
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        query = {"query": f"issue.id:[{event_a.group.id}, {event_c.group.id}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            event_a.group.id: 2,
            event_c.group.id: 1,
        }
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_simple_return_ids(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay2_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay3_id,
            )
        )
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid.uuid4().hex,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay2_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": "z" * 32},  # a replay id that doesn't exist
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_c = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay3_id},
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        query: dict[str, Any] = {
            "query": f"issue.id:[{event_a.group.id}, {event_c.group.id}]",
            "returnIds": True,
        }
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            event_a.group.id: sorted([replay1_id, replay2_id]),
            event_c.group.id: sorted([replay3_id]),
        }
        assert response.status_code == 200, response.content
        self.assertCountEqual(
            response.data[event_a.group.id],
            expected[event_a.group.id],
        )
        self.assertCountEqual(
            response.data[event_c.group.id],
            expected[event_c.group.id],
        )

    def test_simple_performance(self):
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay2_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay3_id,
            )
        )
        issue1 = self.create_performance_issue(
            project_id=self.project.id,
            fingerprint="a",
            contexts={
                "trace": {
                    "trace_id": str(uuid.uuid4().hex),
                    "span_id": "933e5c9a8e464da9",
                    "type": "trace",
                },
                "replay": {"replay_id": replay1_id},
            },
        )
        self.create_performance_issue(
            project_id=self.project.id,
            fingerprint="a",
            contexts={
                "trace": {
                    "trace_id": str(uuid.uuid4().hex),
                    "span_id": "933e5c9a8e464da9",
                    "type": "trace",
                },
                "replay": {"replay_id": replay3_id},
            },
        )
        issue2 = self.create_performance_issue(
            project_id=self.project.id,
            fingerprint="b",
            contexts={
                "trace": {
                    "trace_id": str(uuid.uuid4().hex),
                    "span_id": "933e5c9a8e464da9",
                    "type": "trace",
                },
                "replay": {"replay_id": replay2_id},
            },
        )
        issue3 = self.create_performance_issue(
            project_id=self.project.id,
            fingerprint="c",
            contexts={
                "trace": {
                    "trace_id": str(uuid.uuid4().hex),
                    "span_id": "933e5c9a8e464da9",
                    "type": "trace",
                },
                "replay": {"replay_id": "z" * 32},  # a replay id that doesn't exist
            },
        )

        query = {
            "query": f"issue.id:[{issue1.group.id}, {issue2.group.id}, {issue3.group.id}]",
            "data_source": Dataset.IssuePlatform.value,
        }
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            issue1.group.id: 2,
            issue2.group.id: 1,
        }
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_invalid_data_source(self):
        query = {
            "query": "issue.id:[1234]",
            "data_source": "abcdefg",
        }
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")
            assert response.status_code == 400, response.content
            assert b"abcdefg" in response.content

    def test_one_replay_multiple_issues(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32
        replay1_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_b = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        query = {"query": f"issue.id:[{event_a.group.id}, {event_b.group.id}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            event_a.group.id: 1,
            event_b.group.id: 1,
        }
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_one_replay_same_issue_twice(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32
        replay1_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_b = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        query = {"query": f"issue.id:[{event_a.group.id}, {event_b.group.id}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            event_a.group.id: 1,
        }
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_simple_transaction(self):
        event_id_a = "a" * 32
        replay1_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": iso_format(self.min_ago),
                "tags": {"replayId": replay1_id},
                "transaction": "t-1",
            },
            project_id=self.project.id,
        )

        query = {"query": f"transaction:[{event_a.transaction}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            event_a.transaction: 1,
        }
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_max_51(self):
        replay_ids = [uuid.uuid4().hex for _ in range(100)]
        for replay_id in replay_ids:
            self.store_replays(
                mock_replay(
                    datetime.datetime.now() - datetime.timedelta(seconds=22),
                    self.project.id,
                    replay_id,
                )
            )
            event_a = self.store_event(
                data={
                    "event_id": uuid.uuid4().hex,
                    "timestamp": iso_format(self.min_ago),
                    "tags": {"replayId": replay_id},
                    "fingerprint": ["group-1"],
                },
                project_id=self.project.id,
            )

        query = {"query": f"issue.id:[{event_a.group.id}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {
            event_a.group.id: 51,
        }
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_invalid_params_need_one_issue_id(self):
        query = {"query": ""}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")
            assert response.status_code == 400

    def test_invalid_params_max_issue_id(self):
        issue_ids = ",".join(str(i) for i in range(26))

        query = {"query": f"issue.id:[{issue_ids}]"}

        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")
            assert response.status_code == 400
            assert response.data["detail"] == "Too many values provided"

    def test_invalid_params_only_one_of_issue_and_transaction(self):

        query = {"query": "issue.id:[1] transaction:[2]"}

        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")
            assert response.status_code == 400

    def test_replay_id_count(self):
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id_doesnt_exist = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay2_id,
            )
        )

        query = {"query": f"replay_id:[{replay1_id},{replay2_id},{replay3_id_doesnt_exist}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = {replay1_id: 1, replay2_id: 1}
        assert response.status_code == 200, response.content
        assert response.data == expected

    def test_replay_count_invalid_search_query(self):
        replay1_id = uuid.uuid4().hex

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay1_id,
            )
        )

        with self.feature(self.features):
            query = {"query": 'transaction:["root ("/")"]'}
            response = self.client.get(self.url, query, format="json")

        assert response.status_code == 400, response.content
        assert response.content == (
            b'{"detail":"Invalid quote at \'[\\"root\': quotes must enclose text or be '
            b'escaped."}'
        ), response.content

    def test_endpoint_org_hasnt_sent_replays(self):
        event_id_a = "a" * 32
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": iso_format(self.min_ago),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        query = {"query": f"issue.id:[{event_a.group.id}]"}

        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {}

    def test_project_in_org_has_sent_replay(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        assert project_in_org_has_sent_replay(org) is False

        project.update(flags=F("flags").bitor(Project.flags.has_replays))

        assert project_in_org_has_sent_replay(org) is True
