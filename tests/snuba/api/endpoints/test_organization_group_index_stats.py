import uuid

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class GroupListTest(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    endpoint = "sentry-api-0-organization-group-index-stats"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def get_response(self, *args, **kwargs):
        return super().get_response(self.project.organization.slug, **kwargs)

    def test_simple(self):
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group_a = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat(), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        ).group
        self.store_event(
            data={"timestamp": before_now(seconds=2).isoformat(), "fingerprint": ["group-b"]},
            project_id=self.project.id,
        )
        group_c = self.store_event(
            data={"timestamp": before_now(seconds=3).isoformat(), "fingerprint": ["group-c"]},
            project_id=self.project.id,
        ).group
        self.login_as(user=self.user)
        response = self.get_response(query="is:unresolved", groups=[group_a.id, group_c.id])

        response_data = sorted(response.data, key=lambda x: x["firstSeen"], reverse=True)

        assert response.status_code == 200
        assert len(response_data) == 2
        assert int(response_data[0]["id"]) == group_a.id
        assert int(response_data[1]["id"]) == group_c.id
        assert "title" not in response_data[0]
        assert "hasSeen" not in response_data[0]
        assert "stats" in response_data[0]
        assert "firstSeen" in response_data[0]
        assert "lastSeen" in response_data[0]
        assert "count" in response_data[0]
        assert "userCount" in response_data[0]
        assert "lifetime" in response_data[0]
        assert "filtered" in response_data[0]

    def test_unhandled(self):
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group_a = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat(), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        ).group

        self.login_as(user=self.user)
        response = self.get_response(query="is:unresolved", groups=[group_a.id])

        response_data = sorted(response.data, key=lambda x: x["firstSeen"], reverse=True)

        assert response.status_code == 200
        assert len(response_data) == 1
        assert "title" not in response_data[0]
        assert "hasSeen" not in response_data[0]
        assert "stats" in response_data[0]
        assert "firstSeen" in response_data[0]
        assert "lastSeen" in response_data[0]
        assert "count" in response_data[0]
        assert "userCount" in response_data[0]
        assert "lifetime" in response_data[0]
        assert "filtered" in response_data[0]
        assert "isUnhandled" in response_data[0]

    def test_issue_platform_issue(self):
        event_id = uuid.uuid4().hex
        _, group_info = self.process_occurrence(
            event_id=event_id,
            project_id=self.project.id,
            type=ProfileFileIOGroupType.type_id,
            event_data={
                "fingerprint": ["group-1"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
        )
        assert group_info is not None
        profile_group = group_info.group

        self.login_as(user=self.user)
        response = self.get_response(
            query=f"issue:{profile_group.qualified_short_id}", groups=[profile_group.id]
        )

        response_data = sorted(response.data, key=lambda x: x["firstSeen"], reverse=True)

        assert response.status_code == 200
        assert len(response_data) == 1
        assert int(response_data[0]["id"]) == profile_group.id
        assert "title" not in response_data[0]
        assert "hasSeen" not in response_data[0]
        assert "stats" in response_data[0]
        assert "firstSeen" in response_data[0]
        assert "lastSeen" in response_data[0]
        assert "count" in response_data[0]
        assert "userCount" in response_data[0]
        assert "lifetime" in response_data[0]
        assert "filtered" in response_data[0]

    def test_issue_platform_mixed_issue_not_title(self):
        event_id = uuid.uuid4().hex
        _, group_info = self.process_occurrence(
            event_id=event_id,
            project_id=self.project.id,
            type=ProfileFileIOGroupType.type_id,
            event_data={
                "fingerprint": ["group-a"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
        )
        assert group_info is not None
        profile_group = group_info.group

        error_event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        error_group = error_event.group

        self.login_as(user=self.user)
        response = self.get_response(
            query=f"!title:{profile_group.title}", groups=[profile_group.id, error_group.id]
        )

        response_data = sorted(response.data, key=lambda x: x["firstSeen"], reverse=True)
        assert response.status_code == 200
        assert [int(grp["id"]) for grp in response_data] == [profile_group.id, error_group.id]
        for data in response_data:
            assert "title" not in data
            assert "hasSeen" not in data
            assert "stats" in data
            assert "firstSeen" in data
            assert "lastSeen" in data
            assert "count" in data
            assert "userCount" in data
            assert "lifetime" in data
            assert "filtered" in data

    def test_no_matching_groups(self):
        self.login_as(user=self.user)
        response = self.get_response(sort_by="date", limit=10, query="is:unresolved", groups=[1337])
        assert response.status_code == 400

    def test_simple_with_project(self):
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group_a = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat(), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        ).group
        self.store_event(
            data={"timestamp": before_now(seconds=2).isoformat(), "fingerprint": ["group-b"]},
            project_id=self.project.id,
        )
        group_c = self.store_event(
            data={"timestamp": before_now(seconds=3).isoformat(), "fingerprint": ["group-c"]},
            project_id=self.project.id,
        ).group
        self.login_as(user=self.user)
        response = self.get_response(
            query=f"project:{self.project.slug}", groups=[group_a.id, group_c.id]
        )

        assert response.status_code == 200
        assert len(response.data) == 2

    def test_query_timestamp(self):
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat(), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": before_now(seconds=2).isoformat(), "fingerprint": ["group-b"]},
            project_id=self.project.id,
        )
        event4 = self.store_event(
            data={"timestamp": before_now(seconds=3).isoformat(), "fingerprint": ["group-c"]},
            project_id=self.project.id,
        )

        group_a = event2.group
        group_c = event4.group

        self.login_as(user=self.user)
        response = self.get_response(
            query=f"timestamp:>{before_now(seconds=3)} timestamp:<{before_now(seconds=1).isoformat()}",
            groups=[group_a.id, group_c.id],
        )

        assert response.status_code == 200
        assert len(response.data) == 2

    def test_simple_flags(self):
        group_a = self.store_event(
            data={
                "timestamp": before_now(seconds=500).isoformat(),
                "fingerprint": ["group-a"],
                "contexts": {"flags": {"values": [{"flag": "flag", "result": True}]}},
            },
            project_id=self.project.id,
        ).group
        self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        )
        self.login_as(user=self.user)

        response = self.get_response(query="is:unresolved flags[flag]:true", groups=[group_a.id])
        response_data = sorted(response.data, key=lambda x: x["firstSeen"], reverse=True)

        assert response.status_code == 200
        assert len(response_data) == 1
        assert int(response_data[0]["id"]) == group_a.id
        assert response_data[0]["count"] == "2"
        assert response_data[0]["filtered"]["count"] == "1"
        assert response_data[0]["lifetime"]["count"] == "1"

    def test_error_upsampling_with_allowlisted_project(self):
        """Test that count is upsampled for allowlisted projects in group index stats."""
        with self.options({"issues.client_error_sampling.project_allowlist": [self.project.id]}):
            project = self.project
            event_data = {
                "timestamp": before_now(seconds=30).isoformat(),
                "message": "Error event for upsampling",
                "contexts": {"error_sampling": {"client_sample_rate": 0.1}},
            }
            event = self.store_event(
                data=event_data,
                project_id=project.id,
            )

            group = event.group
            self.login_as(user=self.user)

            with self.feature("organizations:error-upsampling"):
                response = self.get_response(query="is:unresolved", groups=[group.id])
                assert response.status_code == 200
                assert len(response.data) == 1
                # Expect the count to be upsampled (1 / 0.1 = 10) - count is a string
                assert response.data[0]["count"] == "10"
                # Also check that lifetime stats are upsampled
                assert response.data[0]["lifetime"]["count"] == "10"
                # Also check that stats are upsampled, latest time bucket should contain upsampled event
                assert response.data[0]["stats"]["24h"][-1][1] == 10
