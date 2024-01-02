import uuid

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header, with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@region_silo_test
class GroupListTest(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    endpoint = "sentry-api-0-organization-group-index-stats"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in parse_link_header(header).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url
        return links

    def get_response(self, *args, **kwargs):
        if not args:
            org = self.project.organization.slug
        else:
            org = args[0]
        return super().get_response(org, **kwargs)

    def test_simple(self):
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group_a = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=1)), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        ).group
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=2)), "fingerprint": ["group-b"]},
            project_id=self.project.id,
        )
        group_c = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=3)), "fingerprint": ["group-c"]},
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
        assert "isUnhandled" not in response_data[0]

    @with_feature("organizations:issue-stream-performance")
    def test_unhandled(self):
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group_a = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=1)), "fingerprint": ["group-a"]},
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
        occurrence_data = self.build_occurrence_data(
            event_id=event_id, project_id=self.project.id, type=ProfileFileIOGroupType.type_id
        )
        occurrence, group_info = process_event_and_issue_occurrence(
            occurrence_data,
            {
                "event_id": event_id,
                "fingerprint": ["group-1"],
                "project_id": self.project.id,
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
        occurrence_data = self.build_occurrence_data(
            event_id=event_id, project_id=self.project.id, type=ProfileFileIOGroupType.type_id
        )
        occurrence, group_info = process_event_and_issue_occurrence(
            occurrence_data,
            {
                "event_id": event_id,
                "fingerprint": ["group-a"],
                "project_id": self.project.id,
                "timestamp": before_now(minutes=1).isoformat(),
            },
        )
        assert group_info is not None
        profile_group = group_info.group

        error_event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
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
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group_a = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=1)), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        ).group
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=2)), "fingerprint": ["group-b"]},
            project_id=self.project.id,
        )
        group_c = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=3)), "fingerprint": ["group-c"]},
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
            data={"timestamp": iso_format(before_now(seconds=500)), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=1)), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(before_now(seconds=2)), "fingerprint": ["group-b"]},
            project_id=self.project.id,
        )
        event4 = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=3)), "fingerprint": ["group-c"]},
            project_id=self.project.id,
        )

        group_a = event2.group
        group_c = event4.group

        self.login_as(user=self.user)
        response = self.get_response(
            query=f"timestamp:>{iso_format(before_now(seconds=3))} timestamp:<{iso_format(before_now(seconds=1))}",
            groups=[group_a.id, group_c.id],
        )

        assert response.status_code == 200
        assert len(response.data) == 2
