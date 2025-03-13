from datetime import datetime, timedelta, timezone

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class OrganizationIssueMetricsTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-issue-metrics"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_get(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        one = self.create_release(project1, version="1.0.0")
        two = self.create_release(project2, version="1.2.0")

        curr = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        prev = curr - timedelta(hours=1)

        # Release issues.
        self.create_group(project=project1, status=0, first_seen=curr, first_release=one, type=1)
        self.create_group(project=project1, status=1, first_seen=prev, first_release=one, type=2)
        self.create_group(project=project2, status=1, first_seen=curr, first_release=two, type=3)
        self.create_group(project=project2, status=2, first_seen=curr, first_release=two, type=4)
        self.create_group(project=project2, status=2, first_seen=curr, first_release=two, type=6)

        # Time based issues.
        self.create_group(project=project1, status=0, first_seen=curr, type=1)
        self.create_group(project=project1, status=1, first_seen=curr, resolved_at=curr, type=2)
        self.create_group(project=project2, status=1, first_seen=prev, resolved_at=prev, type=3)
        self.create_group(project=project2, status=2, first_seen=prev, type=4)
        self.create_group(project=project2, status=2, first_seen=prev, type=6)

        response = self.client.get(
            self.url + f"?start={prev.isoformat()[:-6]}&end={curr.isoformat()[:-6]}&category=error"
        )
        response_json = response.json()
        assert response_json["timeseries"] == [
            {
                "axis": "new_issues_count",
                "meta": {
                    "groupBy": [],
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "type": "integer",
                    "unit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 3},
                    {"timestamp": int(curr.timestamp()), "value": 5},
                ],
            },
            {
                "axis": "resolved_issues_count",
                "meta": {
                    "groupBy": [],
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "type": "integer",
                    "unit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 1},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "meta": {
                    "groupBy": ["1.0.0"],
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "type": "integer",
                    "unit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 1},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "meta": {
                    "groupBy": ["1.2.0"],
                    "interval": 3600000,
                    "isOther": False,
                    "order": 1,
                    "type": "integer",
                    "unit": None,
                },
                "values": [{"timestamp": int(curr.timestamp()), "value": 2}],
            },
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

        today = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        next = today + timedelta(hours=1)
        prev = today - timedelta(hours=1)
        self.create_group(project=project1, status=0, first_seen=today, type=1)
        self.create_group(project=project2, status=0, first_seen=today, type=1)

        response = self.client.get(
            self.url + f"?statsPeriod=1h&category=error&project={project1.id}"
        )
        response_json = response.json()
        assert response_json["data"] == [
            [str(int(prev.timestamp())), [{"count": 0}, {"count": 0}]],
            [str(int(today.timestamp())), [{"count": 1}, {"count": 0}]],
            [str(int(next.timestamp())), [{"count": 0}, {"count": 0}]],
        ]

    def test_new_feedback(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        today = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        next = today + timedelta(hours=1)
        prev = today - timedelta(hours=1)
        # New cohort
        self.create_group(project=project1, status=0, first_seen=today, type=1)
        self.create_group(project=project1, status=1, first_seen=today, type=2)
        self.create_group(project=project2, status=1, first_seen=next, type=3)
        self.create_group(project=project2, status=2, first_seen=next, type=4)
        self.create_group(project=project2, status=2, first_seen=next, type=6)
        # Resolved cohort
        self.create_group(project=project1, status=0, resolved_at=today, type=2)
        self.create_group(project=project1, status=1, resolved_at=today, type=3)
        self.create_group(project=project2, status=1, resolved_at=today, type=6)
        self.create_group(project=project2, status=1, resolved_at=next, type=4)
        self.create_group(project=project2, status=2, resolved_at=next, type=5)

        response = self.client.get(self.url + "?statsPeriod=1h&category=feedback&group_by=time")
        response_json = response.json()
        assert response_json["data"] == [
            [str(int(prev.timestamp())), [{"count": 0}, {"count": 0}]],
            [str(int(today.timestamp())), [{"count": 1}, {"count": 1}]],
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
