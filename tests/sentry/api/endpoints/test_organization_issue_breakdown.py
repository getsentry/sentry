from datetime import datetime, timedelta, timezone

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json


@freeze_time()
class OrganizationIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-organization-issue-breakdown"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_issues_by_time(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        today = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        tmrw = today + timedelta(days=1)
        yday = today - timedelta(days=1)
        self.create_group(project=project1, status=0, first_seen=today, type=1)
        self.create_group(project=project1, status=1, first_seen=today, resolved_at=today, type=1)
        self.create_group(project=project2, status=1, first_seen=tmrw, resolved_at=tmrw, type=1)
        self.create_group(project=project2, status=2, first_seen=tmrw, type=1)
        self.create_group(project=project2, status=2, first_seen=tmrw, type=6)

        response = self.client.get(self.url + "?statsPeriod=1d&category=error")
        response_json = response.json()
        assert response_json["data"] == [
            [int(yday.timestamp()), [{"count": 0}, {"count": 0}]],
            [int(today.timestamp()), [{"count": 2}, {"count": 1}]],
            [int(tmrw.timestamp()), [{"count": 2}, {"count": 1}]],
        ]

    def test_issues_by_release(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        release_one = self.create_release(project1, version="1.0.0")
        release_two = self.create_release(project2, version="1.2.0")
        self.create_group(project=project1, status=0, first_release=release_one, type=1)
        self.create_group(project=project1, status=1, first_release=release_one, type=1)
        self.create_group(project=project2, status=1, first_release=release_two, type=1)
        self.create_group(project=project2, status=2, first_release=release_two, type=1)
        self.create_group(project=project2, status=2, first_release=release_two, type=6)
        # No release.
        self.create_group(project=project1, status=0, type=1)
        self.create_group(project=project2, status=2, type=6)

        response = self.client.get(self.url + "?statsPeriod=1d&category=error")
        response_json = response.json()
        assert response_json["data"] == [
            ["1.0.0", [{"count": 2}, {"count": 1}]],
            ["1.2.0", [{"count": 2}, {"count": 1}]],
        ]

    def test_issues_invalid_group_by(self):
        response = self.client.get(self.url + "?statsPeriod=7d&category=error&group_by=test")
        assert response.status_code == 404

    def test_new_feedback(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        today = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        self.create_group(project=project1, status=0, first_seen=today, type=1)
        self.create_group(project=project1, status=1, first_seen=today, type=1)
        self.create_group(project=project2, status=1, first_seen=tomorrow, type=1)
        self.create_group(project=project2, status=2, first_seen=tomorrow, type=1)
        self.create_group(project=project2, status=2, first_seen=tomorrow, type=6)

        response = self.client.get(self.url + "?statsPeriod=7d&category=feedback&group_by=new")
        assert json.loads(response.content) == {
            "data": [{"bucket": tomorrow.isoformat().replace("+00:00", "Z"), "count": 1}]
        }

    def test_resolved_feedback(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        today = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        self.create_group(project=project1, status=0, resolved_at=today, type=1)
        self.create_group(project=project1, status=1, resolved_at=today, type=1)
        self.create_group(project=project2, status=1, resolved_at=tomorrow, type=1)
        self.create_group(project=project2, status=1, resolved_at=tomorrow, type=6)
        self.create_group(project=project2, status=2, resolved_at=tomorrow, type=1)

        response = self.client.get(self.url + "?statsPeriod=7d&category=feedback&group_by=resolved")
        assert json.loads(response.content) == {
            "data": [{"bucket": tomorrow.isoformat().replace("+00:00", "Z"), "count": 1}]
        }

    def test_feedback_by_release(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        release_one = self.create_release(project1, version="1.0.0")
        release_two = self.create_release(project2, version="1.2.0")
        self.create_group(project=project1, status=0, first_release=release_one, type=1)
        self.create_group(project=project1, status=1, first_release=release_one, type=1)
        self.create_group(project=project2, status=1, first_release=release_two, type=1)
        self.create_group(project=project2, status=2, first_release=release_two, type=1)
        self.create_group(project=project2, status=2, first_release=release_two, type=6)

        response = self.client.get(self.url + "?statsPeriod=7d&category=feedback&group_by=release")
        assert json.loads(response.content) == {"data": [{"bucket": "1.2.0", "count": 1}]}
