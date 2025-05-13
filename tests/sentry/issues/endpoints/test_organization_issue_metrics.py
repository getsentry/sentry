from datetime import datetime, timedelta, timezone

from django.urls import reverse

from sentry.issues.grouptype import FeedbackGroup
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class OrganizationIssueMetricsTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-issue-metrics"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    @freeze_time(datetime.now(tz=timezone.utc).replace(microsecond=100))
    def test_get_errors(self) -> None:
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        one = self.create_release(project1, version="1.0.0")
        two = self.create_release(project2, version="1.2.0")

        curr = datetime.now(tz=timezone.utc)
        before_curr = curr - timedelta(microseconds=100)
        prev = before_curr - timedelta(hours=1)
        after_prev = prev + timedelta(microseconds=100)

        # Release issues.
        self.create_group(project=project1, status=0, first_seen=curr, first_release=one, type=1)
        self.create_group(project=project1, status=1, first_seen=prev, first_release=one, type=2)
        self.create_group(project=project2, status=1, first_seen=curr, first_release=two, type=3)
        self.create_group(project=project2, status=2, first_seen=curr, first_release=two, type=4)
        self.create_group(
            project=project2,
            status=2,
            first_seen=curr,
            first_release=two,
            type=FeedbackGroup.type_id,
        )

        # Time based issues.
        self.create_group(project=project1, status=0, first_seen=curr, type=1)
        self.create_group(
            project=project1, status=1, first_seen=before_curr, resolved_at=curr, type=2
        )
        self.create_group(
            project=project2, status=1, first_seen=prev, resolved_at=after_prev, type=3
        )
        self.create_group(project=project2, status=2, first_seen=prev, type=4)
        self.create_group(project=project2, status=2, first_seen=prev, type=FeedbackGroup.type_id)

        response = self.client.get(
            self.url + f"?start={prev.isoformat()[:-6]}&end={curr.isoformat()[:-6]}&category=issue"
        )
        response_json = response.json()
        assert response_json["timeseries"] == [
            {
                "axis": "new_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 3},
                    {"timestamp": int(curr.timestamp()), "value": 5},
                ],
            },
            {
                "axis": "resolved_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 1},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.0.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 1},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.2.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 1,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 2},
                ],
            },
        ]

    def test_get_issues_by_project(self) -> None:
        """Assert the project filter works."""
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        curr = datetime.now(tz=timezone.utc)
        prev = curr - timedelta(hours=1)
        self.create_group(project=project1, status=0, first_seen=curr, type=1)
        self.create_group(project=project2, status=0, first_seen=curr, type=1)

        response = self.client.get(
            self.url
            + f"?start={prev.isoformat()[:-6]}&end={curr.isoformat()[:-6]}&category=issue&project={project1.id}"
        )
        response_json = response.json()
        assert response_json["timeseries"] == [
            {
                "axis": "new_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "resolved_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 0},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 0},
                ],
            },
        ]

    @freeze_time(datetime.now(tz=timezone.utc).replace(microsecond=100))
    def test_get_feedback(self) -> None:
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")

        curr = datetime.now(tz=timezone.utc)
        before_curr = curr - timedelta(microseconds=100)
        prev = before_curr - timedelta(hours=1)
        after_prev = prev + timedelta(microseconds=100)
        # New cohort
        self.create_group(project=project1, status=0, first_seen=curr, type=1)
        self.create_group(project=project1, status=1, first_seen=curr, type=2)
        self.create_group(project=project2, status=1, first_seen=curr, type=3)
        self.create_group(project=project2, status=2, first_seen=prev, type=FeedbackGroup.type_id)
        self.create_group(project=project2, status=2, first_seen=curr, type=FeedbackGroup.type_id)
        # Resolved cohort
        self.create_group(
            project=project1, status=0, first_seen=before_curr, resolved_at=curr, type=2
        )
        self.create_group(
            project=project1, status=1, first_seen=before_curr, resolved_at=curr, type=3
        )
        self.create_group(
            project=project2,
            status=1,
            first_seen=prev,
            resolved_at=after_prev,
            type=FeedbackGroup.type_id,
        )
        self.create_group(
            project=project2,
            status=1,
            first_seen=before_curr,
            resolved_at=curr,
            type=FeedbackGroup.type_id,
        )
        self.create_group(
            project=project2, status=2, first_seen=before_curr, resolved_at=curr, type=5
        )

        response = self.client.get(
            self.url
            + f"?start={prev.isoformat()[:-6]}&end={curr.isoformat()[:-6]}&category=feedback"
        )
        response_json = response.json()
        assert response_json["timeseries"] == [
            {
                "axis": "new_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 2},
                    {"timestamp": int(curr.timestamp()), "value": 2},
                ],
            },
            {
                "axis": "resolved_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 1},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 0},
                ],
            },
        ]

    def test_get_too_much_granularity(self) -> None:
        response = self.client.get(self.url + "?statsPeriod=14d&interval=1001")
        assert response.status_code == 400
        assert response.json() == {
            "detail": "The specified granularity is too precise. Increase your interval."
        }

    def test_get_invalid_interval(self) -> None:
        response = self.client.get(self.url + "?interval=foo")
        assert response.status_code == 400
        assert response.json() == {"detail": "Could not parse interval value."}

    def test_get_zero_interval(self) -> None:
        response = self.client.get(self.url + "?interval=0")
        assert response.status_code == 400
        assert response.json() == {"detail": "Interval must be greater than 1000 milliseconds."}

    def test_get_invalid_category(self) -> None:
        response = self.client.get(self.url + "?category=foo")
        assert response.status_code == 400
        assert response.json() == {
            "detail": "Invalid issue category. Valid options are 'issue' and 'feedback'."
        }

    def test_other_grouping(self) -> None:
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        one = self.create_release(project1, version="1.0.0")
        two = self.create_release(project2, version="1.1.0")
        three = self.create_release(project2, version="1.2.0")
        four = self.create_release(project2, version="1.3.0")
        fifth = self.create_release(project2, version="1.4.0")
        sixth = self.create_release(project2, version="1.5.0")

        curr = datetime.now(tz=timezone.utc)
        prev = curr - timedelta(hours=1)

        # Release issues.
        self.create_group(project=project1, status=0, first_seen=curr, first_release=one, type=1)
        self.create_group(project=project1, status=0, first_seen=curr, first_release=two, type=1)
        self.create_group(project=project1, status=0, first_seen=curr, first_release=three, type=1)
        self.create_group(project=project1, status=0, first_seen=curr, first_release=four, type=1)
        self.create_group(project=project1, status=0, first_seen=curr, first_release=fifth, type=1)
        self.create_group(project=project1, status=0, first_seen=curr, first_release=sixth, type=1)

        response = self.client.get(
            self.url + f"?start={prev.isoformat()[:-6]}&end={curr.isoformat()[:-6]}&category=issue"
        )
        response_json = response.json()
        assert response_json["timeseries"] == [
            {
                "axis": "new_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 6},
                ],
            },
            {
                "axis": "resolved_issues_count",
                "groupBy": [],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 0},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.1.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 0,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.2.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 1,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.3.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 2,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.4.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 3,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["1.5.0"],
                "meta": {
                    "interval": 3600000,
                    "isOther": False,
                    "order": 4,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
            {
                "axis": "new_issues_count_by_release",
                "groupBy": ["other"],
                "meta": {
                    "interval": 3600000,
                    "isOther": True,
                    "order": 5,
                    "valueType": "integer",
                    "valueUnit": None,
                },
                "values": [
                    {"timestamp": int(prev.timestamp()), "value": 0},
                    {"timestamp": int(curr.timestamp()), "value": 1},
                ],
            },
        ]
