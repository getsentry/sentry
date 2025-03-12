from datetime import datetime, timedelta, timezone

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time()
class OrganizationIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-organization-issue-metrics"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_issues_by_time(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        next = now + timedelta(hours=1)
        prev = now - timedelta(hours=1)
        self.create_group(project=project1, status=0, first_seen=now, type=1)
        self.create_group(project=project1, status=1, first_seen=now, resolved_at=now, type=2)
        self.create_group(project=project2, status=1, first_seen=next, resolved_at=next, type=3)
        self.create_group(project=project2, status=2, first_seen=next, type=4)
        self.create_group(project=project2, status=2, first_seen=next, type=6)

        response = self.client.get(self.url + "?statsPeriod=1h&category=error")
        response_json = response.json()
        assert response_json["data"] == [
            [str(int(prev.timestamp())), [{"count": 0}, {"count": 0}]],
            [str(int(now.timestamp())), [{"count": 2}, {"count": 1}]],
            [str(int(next.timestamp())), [{"count": 2}, {"count": 1}]],
        ]

    def test_issues_by_release(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        release_one = self.create_release(project1, version="1.0.0")
        release_two = self.create_release(project2, version="1.2.0")
        self.create_group(project=project1, status=0, first_release=release_one, type=1)
        self.create_group(project=project1, status=1, first_release=release_one, type=2)
        self.create_group(project=project2, status=1, first_release=release_two, type=3)
        self.create_group(project=project2, status=2, first_release=release_two, type=4)
        self.create_group(project=project2, status=2, first_release=release_two, type=6)
        # No release.
        self.create_group(project=project1, status=0, type=1)
        self.create_group(project=project2, status=2, type=6)

        response = self.client.get(self.url + "?statsPeriod=1h&category=error&group_by=release")
        response_json = response.json()
        assert response_json["data"] == [
            ["1.0.0", [{"count": 2}]],
            ["1.2.0", [{"count": 2}]],
        ]

    def test_issues_invalid_group_by(self):
        response = self.client.get(self.url + "?statsPeriod=7d&category=error&group_by=test")
        assert response.status_code == 404

    def test_issues_by_time_project_filter(self):
        """Assert the project filter works."""
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        next = now + timedelta(hours=1)
        prev = now - timedelta(hours=1)
        self.create_group(project=project1, status=0, first_seen=now, type=1)
        self.create_group(project=project2, status=0, first_seen=now, type=1)

        response = self.client.get(
            self.url + f"?statsPeriod=1h&category=error&project={project1.id}"
        )
        response_json = response.json()
        assert response_json["data"] == [
            [str(int(prev.timestamp())), [{"count": 0}, {"count": 0}]],
            [str(int(now.timestamp())), [{"count": 1}, {"count": 0}]],
            [str(int(next.timestamp())), [{"count": 0}, {"count": 0}]],
        ]

    def test_new_feedback(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        next = now + timedelta(hours=1)
        prev = now - timedelta(hours=1)
        # New cohort
        self.create_group(project=project1, status=0, first_seen=now, type=1)
        self.create_group(project=project1, status=1, first_seen=now, type=2)
        self.create_group(project=project2, status=1, first_seen=next, type=3)
        self.create_group(project=project2, status=2, first_seen=next, type=4)
        self.create_group(project=project2, status=2, first_seen=next, type=6)
        # Resolved cohort
        self.create_group(project=project1, status=0, resolved_at=now, type=2)
        self.create_group(project=project1, status=1, resolved_at=now, type=3)
        self.create_group(project=project2, status=1, resolved_at=now, type=6)
        self.create_group(project=project2, status=1, resolved_at=next, type=4)
        self.create_group(project=project2, status=2, resolved_at=next, type=5)

        response = self.client.get(self.url + "?statsPeriod=1h&category=feedback&group_by=time")
        response_json = response.json()
        assert response_json["data"] == [
            [str(int(prev.timestamp())), [{"count": 0}, {"count": 0}]],
            [str(int(now.timestamp())), [{"count": 1}, {"count": 1}]],
            [str(int(next.timestamp())), [{"count": 1}, {"count": 0}]],
        ]

    def test_feedback_by_release(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        release_one = self.create_release(project1, version="1.0.0")
        release_two = self.create_release(project2, version="1.2.0")
        self.create_group(project=project1, status=0, first_release=release_one, type=1)
        self.create_group(project=project1, status=1, first_release=release_one, type=2)
        self.create_group(project=project2, status=1, first_release=release_two, type=3)
        self.create_group(project=project2, status=2, first_release=release_two, type=4)
        self.create_group(project=project2, status=2, first_release=release_two, type=6)

        response = self.client.get(self.url + "?statsPeriod=1h&category=feedback&group_by=release")
        response_json = response.json()
        assert response_json["data"] == [["1.2.0", [{"count": 1}]]]
