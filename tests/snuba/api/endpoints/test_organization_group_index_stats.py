from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
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

    def test_issue_platform_issue(self):
        event = self.store_event(
            data={"timestamp": iso_format(before_now(seconds=1)), "fingerprint": ["group-a"]},
            project_id=self.project.id,
        )
        event_group = event.for_group(event.group)
        event_group.occurrence = self.build_occurrence()
        event.group.type = ProfileFileIOGroupType.type_id

        self.login_as(user=self.user)
        response = self.get_response(
            query=f"issue:{event.group.qualified_short_id}", groups=[event.group.id]
        )

        response_data = sorted(response.data, key=lambda x: x["firstSeen"], reverse=True)

        assert response.status_code == 200
        assert len(response_data) == 1
        assert int(response_data[0]["id"]) == event.group.id
        assert "title" not in response_data[0]
        assert "hasSeen" not in response_data[0]
        assert "stats" in response_data[0]
        assert "firstSeen" in response_data[0]
        assert "lastSeen" in response_data[0]
        assert "count" in response_data[0]
        assert "userCount" in response_data[0]
        assert "lifetime" in response_data[0]
        assert "filtered" in response_data[0]

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
