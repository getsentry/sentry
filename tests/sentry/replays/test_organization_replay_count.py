from __future__ import annotations

import datetime
import uuid
from typing import Any

import pytest
from django.db.models import F
from django.urls import reverse

from sentry.models.organization import Organization
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
from sentry.testutils.helpers.datetime import before_now

pytestmark = pytest.mark.sentry_metrics


class OrganizationReplayCountEndpointTest(
    APITestCase, SnubaTestCase, ReplaysSnubaTestCase, PerformanceIssueTestCase
):
    def setUp(self):
        super().setUp()
        self.project.update(flags=F("flags").bitor(Project.flags.has_replays))
        self.min_ago = before_now(minutes=2)
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-replay-count",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.features = {"organizations:session-replay": True}

    def test_simple_b(self):
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
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid.uuid4().hex,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay2_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {
                    "replay": {"replay_id": uuid.uuid4().hex}
                },  # a replay id that doesn't exist
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_c = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay3_id}},
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        query = {"query": f"(issue.id:[{event_a.group.id}, {event_c.group.id}] or abc)"}
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
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": uuid.uuid4().hex,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay2_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": uuid.uuid4().hex}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_c = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay3_id}},
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
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_b = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
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
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        event_b = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
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
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
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

    def test_replay_count_invalid_replay_ids(self):
        # test that the endpoint validates against invalid uuids, when querying on replay_id
        bad_uuids = [
            uuid.uuid4().hex[:16],  # too short
            "42368708867",  # too short
            "gz" * 16,  # not hex
            "abcd-12-" * 4,  # too short after stripping dashes
            "e{f@%-}9" * 4,  # garbage
            # note the endpoint expects 32 hex chars, stripping trailing/leading '{}' and any number of '-'s
            # so the following are still valid:
            # "{aaa1aaaa-a123-aaaab-baaaaaa1934aff8--",  # will strip all '-' and '{', then reformat
            # "a" * 32, "1" * 32, "0" * 32
        ]

        with self.feature(self.features):
            for id in bad_uuids:
                query = {"query": f"replay_id:[{id}]"}
                response = self.client.get(self.url, query, format="json")
                assert response.status_code == 400

    def test_endpoint_org_hasnt_sent_replays(self):
        event_id_a = "a" * 32
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": self.min_ago.isoformat(),
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

    def test_cross_organization_lookups(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex

        # Mock data for the user's organization.
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
                "timestamp": self.min_ago.isoformat(),
                "contexts": {"replay": {"replay_id": replay1_id}},
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        # Mock data for an organization the user does not have access to.
        #
        # There's a project-id mismatch between the replay and the event. This
        # is intentional. If the replay has a project-id outside the user's
        # organization then the endpoint is protected and will not return results
        # for that issue-id. We pass an invalid database state to assert only
        # issues belonging to the user will ever be fetched.
        org = Organization.objects.create(slug="other-org")
        project = Project.objects.create(organization=org, slug="other-project")

        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                replay2_id,
            )
        )
        event_b = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": self.min_ago.isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=project.id,
        )

        # IDs from both orgs are passed to the endpoint.
        query = {"query": f"issue.id:[{event_a.group.id}, {event_b.group.id}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        # Assert the request succeeds but the event from another organization
        # is not returned.
        assert response.status_code == 200, response.content
        assert response.data == {event_a.group.id: 1}
