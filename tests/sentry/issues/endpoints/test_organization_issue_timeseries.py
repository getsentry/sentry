from datetime import datetime, timedelta, timezone
from typing import Any

from django.urls import reverse

from sentry.issues.grouptype import FeedbackGroup
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time(datetime.now(tz=timezone.utc).replace(microsecond=100))
class OrganizationIssueMetricsTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-issue-timeseries"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

        self.end = datetime.now(tz=timezone.utc)
        self.just_before_now = self.end - timedelta(microseconds=100)
        self.start = self.just_before_now - timedelta(hours=1)

        self.project1 = self.create_project(teams=[self.team], slug="foo")
        self.project2 = self.create_project(teams=[self.team], slug="bar")

        self.releases = [
            self.create_release(self.project1, version="1.0.0"),
            self.create_release(self.project2, version="1.1.0"),
            self.create_release(self.project2, version="1.2.0"),
            self.create_release(self.project2, version="1.3.0"),
            self.create_release(self.project2, version="1.4.0"),
            self.create_release(self.project2, version="1.5.0"),
        ]

        # Release issues.
        self.create_group(
            project=self.project1,
            status=0,
            first_seen=self.end,
            first_release=self.releases[0],
            type=1,
        )
        self.create_group(
            project=self.project1,
            status=1,
            first_seen=self.start,
            first_release=self.releases[0],
            type=2,
        )
        self.create_group(
            project=self.project2,
            status=1,
            first_seen=self.end,
            first_release=self.releases[1],
            type=3,
        )
        self.create_group(
            project=self.project2,
            status=2,
            first_seen=self.end,
            first_release=self.releases[1],
            type=4,
        )
        self.create_group(
            project=self.project2,
            status=2,
            first_seen=self.end,
            first_release=self.releases[1],
            type=FeedbackGroup.type_id,
        )

        # Time based issues.
        self.create_group(project=self.project1, status=0, first_seen=self.end, type=1)
        self.create_group(
            project=self.project1,
            status=1,
            first_seen=self.just_before_now,
            resolved_at=self.end,
            type=2,
        )
        self.create_group(
            project=self.project2,
            status=1,
            first_seen=self.start,
            resolved_at=self.start + timedelta(microseconds=100),
            type=3,
        )
        self.create_group(project=self.project2, status=2, first_seen=self.start, type=4)
        self.create_group(
            project=self.project2, status=2, first_seen=self.start, type=FeedbackGroup.type_id
        )

    def do_request(self, data: dict[str, Any], url: str | None = None) -> Any:
        return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_get_invalid_interval(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "0",
                "category": "issue",
                "yAxis": "count(new_issues)",
                "groupBy": ["release"],
            },
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Interval cannot result in a zero duration."}

    def test_get_too_much_granularity(self) -> None:
        response = self.do_request(
            {
                "statsPeriod": "14d",
                "interval": "1001",
                "category": "issue",
                "yAxis": "count(new_issues)",
                "groupBy": ["release"],
            },
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid Interval"}

    def test_get_invalid_category(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "foo",
                "yAxis": "count(new_issues)",
                "groupBy": ["release"],
            },
        )
        assert response.status_code == 400
        assert response.json() == {
            "detail": "Invalid issue category. Valid options are 'issue' and 'feedback'."
        }

    def test_get_invalid_groupby(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": "count(new_issues)",
                "groupBy": ["foo"],
            },
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "The only supported groupBy is currently release."}

    def test_get_new_issues(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": "count(new_issues)",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 2
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 3,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 5,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_get_resolved_issues(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": "count(resolved_issues)",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 2
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 1,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_get_new_and_resolved(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": ["count(new_issues)", "count(resolved_issues)"],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2
        timeseries = response.data["timeSeries"][0]
        assert timeseries["yAxis"] == "count(new_issues)"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 3,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 5,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }
        timeseries = response.data["timeSeries"][1]
        assert timeseries["yAxis"] == "count(resolved_issues)"
        assert len(timeseries["values"]) == 2
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 1,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_groupby_release(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": "count(new_issues)",
                "groupBy": ["release"],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2
        timeseries = response.data["timeSeries"][0]
        assert timeseries["groupBy"] == [{"key": "release", "value": "1.0.0"}]
        assert len(timeseries["values"]) == 2
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 1,
            },
        ]
        assert timeseries["meta"] == {
            "isOther": False,
            "order": 0,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

        timeseries = response.data["timeSeries"][1]
        assert timeseries["groupBy"] == [{"key": "release", "value": "1.1.0"}]
        assert len(timeseries["values"]) == 2
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 0,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 2,
            },
        ]
        assert timeseries["meta"] == {
            "isOther": False,
            "order": 1,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_get_feedback(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "feedback",
                "yAxis": "count(new_issues)",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "feedback",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 2
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 1,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_other_with_new_issues(self) -> None:
        # Release issues.
        for release in self.releases:
            self.create_group(
                project=self.project1, status=0, first_seen=self.end, first_release=release, type=1
            )

        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": "count(new_issues)",
                "groupBy": ["release"],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 6
        values = [(1, 2), (0, 3), (0, 1), (0, 1), (0, 1)]
        for index, timeseries in enumerate(response.data["timeSeries"][:5]):
            assert timeseries["yAxis"] == "count(new_issues)"
            assert timeseries["values"] == [
                {
                    "incomplete": False,
                    "timestamp": self.start.timestamp() * 1000,
                    "value": values[index][0],
                },
                {
                    "incomplete": False,
                    "timestamp": self.just_before_now.timestamp() * 1000,
                    "value": values[index][1],
                },
            ], index
            assert timeseries["meta"] == {
                "isOther": False,
                "order": index,
                "valueType": "integer",
                "valueUnit": None,
                "interval": 3_600_000,
            }
        timeseries = response.data["timeSeries"][-1]
        assert timeseries["yAxis"] == "count(new_issues)"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 0,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 1,
            },
        ]
        assert timeseries["meta"] == {
            "isOther": True,
            "order": 5,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_other_with_resolved_issues(self) -> None:
        # Release issues.
        for release in self.releases:
            self.create_group(
                project=self.project2,
                status=1,
                first_seen=self.start,
                resolved_at=self.start + timedelta(microseconds=100),
                first_release=release,
                type=3,
            )

        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "category": "issue",
                "yAxis": "count(resolved_issues)",
                "groupBy": ["release"],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 6
        values = [(2, 0), (1, 1), (1, 0), (1, 0), (1, 0)]
        for index, timeseries in enumerate(response.data["timeSeries"][:5]):
            assert timeseries["yAxis"] == "count(resolved_issues)"
            assert timeseries["values"] == [
                {
                    "incomplete": False,
                    "timestamp": self.start.timestamp() * 1000,
                    "value": values[index][0],
                },
                {
                    "incomplete": False,
                    "timestamp": self.just_before_now.timestamp() * 1000,
                    "value": values[index][1],
                },
            ], index
            assert timeseries["meta"] == {
                "isOther": False,
                "order": index,
                "valueType": "integer",
                "valueUnit": None,
                "interval": 3_600_000,
            }
        timeseries = response.data["timeSeries"][-1]
        assert timeseries["yAxis"] == "count(resolved_issues)"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.just_before_now.timestamp() * 1000,
                "value": 0,
            },
        ]
        assert timeseries["meta"] == {
            "isOther": True,
            "order": 5,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_buckets_not_filling(self) -> None:
        self.start = (self.end - timedelta(days=14)).replace(microsecond=1234)

        project = self.create_project()
        self.create_group(
            project=project,
            status=1,
            first_seen=self.start + timedelta(days=1),
            resolved_at=self.start + timedelta(days=1, hours=1),
            type=2,
        )
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "project": project.id,
                "interval": "12h",
                "category": "issue",
                "yAxis": "count(new_issues)",
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "issue",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 29
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": round((self.start + timedelta(hours=x * 12)).timestamp() * 1000) - 1,
                "value": 1 if x == 2 else 0,
            }
            for x in range(29)
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 43_200_000,
        }
