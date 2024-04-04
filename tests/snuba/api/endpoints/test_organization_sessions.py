import datetime
from uuid import uuid4

import pytest
from django.urls import reverse

from sentry.snuba.metrics import to_intervals
from sentry.testutils.cases import APITestCase, BaseMetricsTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.link_header import parse_link_header
from sentry.utils.cursors import Cursor

pytestmark = pytest.mark.sentry_metrics


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


ONE_DAY_AGO = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=1)
TWO_DAYS_AGO = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=2)
MOCK_DATETIME = ONE_DAY_AGO.replace(hour=12, minute=27, second=28, microsecond=303000)
MOCK_DATETIME_PLUS_TEN_MINUTES = MOCK_DATETIME + datetime.timedelta(minutes=10)
MOCK_DATETIME_PLUS_ONE_HOUR = MOCK_DATETIME + datetime.timedelta(hours=1)
SNUBA_TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
MOCK_DATETIME_START_OF_DAY = MOCK_DATETIME.replace(hour=0, minute=0, second=0)

TIMESTAMP = MOCK_DATETIME.timestamp()
RECEIVED = TIMESTAMP
SESSION_STARTED = TIMESTAMP // 3600 * 3600  # round to the hour

TEMPLATE = {
    "distinct_id": "00000000-0000-0000-0000-000000000000",
    "status": "exited",
    "seq": 0,
    "release": "foo@1.0.0",
    "environment": "production",
    "retention_days": 90,
    "duration": 123.4,
    "errors": 0,
    "started": SESSION_STARTED,
    "received": RECEIVED,
}


def make_duration(kwargs):
    """Randomish but deterministic duration"""
    return float(len(str(kwargs)))


def make_session(project, **kwargs):
    return dict(
        dict(
            TEMPLATE,
            session_id=uuid4().hex,
            org_id=project.organization_id,
            project_id=project.id,
            duration=make_duration(kwargs),
        ),
        **kwargs,
    )


def adjust_start(start: datetime.datetime, interval: int) -> datetime.datetime:
    # align start and end to the beginning of the intervals
    start, _end, _num_intervals = to_intervals(
        start, start + datetime.timedelta(minutes=1), interval
    )
    return start


def adjust_end(end: datetime.datetime, interval: int) -> datetime.datetime:
    # align start and end to the beginning of the intervals
    _start, end, _num_intervals = to_intervals(end - datetime.timedelta(minutes=1), end, interval)
    return end


class OrganizationSessionsEndpointMetricsTest(BaseMetricsTestCase, APITestCase):
    def setUp(self):
        super().setUp()
        self.setup_fixture()

    def setup_fixture(self):
        self.organization1 = self.organization
        self.organization2 = self.create_organization()
        self.organization3 = self.create_organization()
        self.project1 = self.project
        self.project2 = self.create_project()
        self.project3 = self.create_project()
        self.project4 = self.create_project(organization=self.organization2)

        self.user2 = self.create_user(is_superuser=False)
        self.create_member(
            user=self.user2, organization=self.organization1, role="member", teams=[]
        )
        self.create_member(user=self.user, organization=self.organization3, role="admin", teams=[])

        self.create_environment(self.project2, name="development")

        self.bulk_store_sessions(
            [
                make_session(self.project1, started=SESSION_STARTED + 12 * 60),
                make_session(self.project1, started=SESSION_STARTED + 24 * 60, release="foo@1.1.0"),
                make_session(self.project1, started=SESSION_STARTED - 60 * 60),
                make_session(self.project1, started=SESSION_STARTED - 12 * 60 * 60),
                make_session(self.project2, status="crashed"),
                make_session(self.project2, environment="development"),
                make_session(self.project3, errors=1, release="foo@1.2.0"),
                make_session(
                    self.project3,
                    distinct_id="39887d89-13b2-4c84-8c23-5d13d2102664",
                    started=SESSION_STARTED - 60 * 60,
                ),
                make_session(
                    self.project3, distinct_id="39887d89-13b2-4c84-8c23-5d13d2102664", errors=1
                ),
                make_session(self.project4),
            ]
        )

    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-sessions",
            kwargs={"organization_slug": (org or self.organization).slug},
        )
        return self.client.get(url, query, format="json")

    @freeze_time(MOCK_DATETIME)
    def test_orderby(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)"],
                "orderBy": "foobar",
            }
        )
        assert response.status_code == 400
        assert response.data == {"detail": "'orderBy' must be one of the provided 'fields'"}

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)"],
                "orderBy": "count_unique(user)",  # wrong field
            }
        )
        assert response.status_code == 400
        assert response.data == {"detail": "'orderBy' must be one of the provided 'fields'"}

        # Cannot sort by more than one field
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)", "count_unique(user)"],
                "orderBy": ["sum(session)", "count_unique(user)"],
            }
        )
        assert response.status_code == 400
        assert response.data == {"detail": "Cannot order by multiple fields"}

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)"],
                "orderBy": "sum(session)",  # misses group by, but why not
            }
        )
        assert response.status_code == 200

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)"],
                "orderBy": "sum(session)",
                "groupBy": ["session.status"],
            }
        )
        assert response.status_code == 400
        assert response.data == {"detail": "Cannot use 'orderBy' when grouping by sessions.status"}

        response = self.do_request(
            {
                "project": [self.project.id, self.project3.id],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)", "p95(session.duration)"],
                "orderBy": "p95(session.duration)",
                "groupBy": ["project", "release", "environment"],
            }
        )

        expected_groups = [
            {
                "by": {
                    "project": self.project.id,
                    "release": "foo@1.0.0",
                    "environment": "production",
                },
                "totals": {"sum(session)": 3, "p95(session.duration)": 25000.0},
                "series": {
                    "sum(session)": [0, 0, 3],
                    "p95(session.duration)": [None, None, 25000.0],
                },
            },
            {
                "by": {
                    "project": self.project3.id,
                    "release": "foo@1.2.0",
                    "environment": "production",
                },
                "totals": {"sum(session)": 1, "p95(session.duration)": 37000.0},
                "series": {
                    "sum(session)": [0, 0, 1],
                    "p95(session.duration)": [None, None, 37000.0],
                },
            },
            {
                "by": {
                    "project": self.project.id,
                    "release": "foo@1.1.0",
                    "environment": "production",
                },
                "totals": {"sum(session)": 1, "p95(session.duration)": 49000.0},
                "series": {
                    "sum(session)": [0, 0, 1],
                    "p95(session.duration)": [None, None, 49000.0],
                },
            },
            {
                "by": {
                    "project": self.project3.id,
                    "release": "foo@1.0.0",
                    "environment": "production",
                },
                "totals": {"sum(session)": 2, "p95(session.duration)": 79400.0},
                "series": {
                    "sum(session)": [0, 0, 2],
                    "p95(session.duration)": [None, None, 79400.0],
                },
            },
        ]

        # Not using `result_sorted` here, because we want to verify the order
        assert response.status_code == 200, response.data
        assert response.data["groups"] == expected_groups

        # Sort descending
        response = self.do_request(
            {
                "project": [self.project.id, self.project3.id],
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(session)", "p95(session.duration)"],
                "orderBy": "-p95(session.duration)",
                "groupBy": ["project", "release", "environment"],
            }
        )

        assert response.status_code == 200
        assert response.data["groups"] == list(reversed(expected_groups))

        # Add some more code coverage
        all_fields = [
            "sum(session)",
            "count_unique(user)",
            "avg(session.duration)",
        ]
        for field in all_fields:
            assert (
                self.do_request(
                    {
                        "project": [self.project.id, self.project3.id],
                        "statsPeriod": "2d",
                        "interval": "1d",
                        "field": all_fields,
                        "orderBy": field,
                        "groupBy": ["project", "release", "environment"],
                    }
                ).status_code
                == 200
            )

    @freeze_time(MOCK_DATETIME)
    def test_wildcard_search(self):
        default_request = {
            "project": [-1],
            "statsPeriod": "2d",
            "interval": "1d",
        }

        def req(**kwargs):
            return self.do_request(dict(default_request, **kwargs))

        response = req(field=["sum(session)"], query="release:foo@*")
        assert response.status_code == 400
        assert response.data == {"detail": "Invalid condition: wildcard search is not supported"}

        response = req(field=["sum(session)"], query="release:foo@* AND release:bar@*")
        assert response.status_code == 400
        assert response.data == {"detail": "Invalid condition: wildcard search is not supported"}

        response = req(field=["sum(session)"], query="release:foo@* OR release:bar@*")
        assert response.status_code == 400
        assert response.data == {"detail": "Invalid condition: wildcard search is not supported"}

        response = req(field=["sum(session)"], query="(release:foo@* OR release:bar) OR project:1")
        assert response.status_code == 400
        assert response.data == {"detail": "Invalid condition: wildcard search is not supported"}

    @freeze_time(MOCK_DATETIME)
    def test_filter_by_session_status(self):
        default_request = {
            "project": [-1],
            "statsPeriod": "1d",
            "interval": "1d",
        }

        def req(**kwargs):
            return self.do_request(dict(default_request, **kwargs))

        response = req(field=["sum(session)"], query="session.status:bogus")
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == []

        response = req(field=["sum(session)"], query="!session.status:healthy")
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [0, 3]}, "totals": {"sum(session)": 3}}
        ]

        # sum(session) filtered by multiple statuses adds them
        response = req(field=["sum(session)"], query="session.status:[healthy, errored]")
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [0, 8]}, "totals": {"sum(session)": 8}}
        ]

        response = req(
            field=["sum(session)"],
            query="session.status:[healthy, errored]",
            groupBy="session.status",
        )
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"session.status": "errored"},
                "totals": {"sum(session)": 2},
                "series": {"sum(session)": [0, 2]},
            },
            {
                "by": {"session.status": "healthy"},
                "totals": {"sum(session)": 6},
                "series": {"sum(session)": [0, 6]},
            },
        ]

        response = req(field=["sum(session)"], query="session.status:healthy release:foo@1.1.0")
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [0, 1]}, "totals": {"sum(session)": 1}}
        ]

        response = req(field=["sum(session)"], query="session.status:healthy OR release:foo@1.1.0")
        assert response.status_code == 400, response.data
        assert response.data == {"detail": "Unable to parse condition with session.status"}

        # count_unique(user) does not work with multiple session statuses selected
        response = req(field=["count_unique(user)"], query="session.status:[healthy, errored]")
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": "Cannot filter count_unique by multiple session.status unless it is in groupBy"
        }

        response = req(field=["p95(session.duration)"], query="session.status:abnormal")
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == []

    @freeze_time(MOCK_DATETIME)
    def test_filter_by_session_status_with_groupby(self):
        default_request = {
            "project": [-1],
            "statsPeriod": "1d",
            "interval": "1d",
            "groupBy": "release",
        }

        def req(**kwargs):
            return self.do_request(dict(default_request, **kwargs))

        response = req(field=["sum(session)"], query="session.status:healthy")
        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"release": "foo@1.0.0"},
                "series": {"sum(session)": [0, 5]},
                "totals": {"sum(session)": 5},
            },
            {
                "by": {"release": "foo@1.1.0"},
                "series": {"sum(session)": [0, 1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"release": "foo@1.2.0"},
                "series": {"sum(session)": [0, 0]},
                "totals": {"sum(session)": 0},
            },
        ]

    @freeze_time(MOCK_DATETIME)
    def test_filter_by_session_status_with_orderby(self):
        default_request = {
            "project": [-1],
            "statsPeriod": "1d",
            "interval": "1d",
        }

        def req(**kwargs):
            return self.do_request(dict(default_request, **kwargs))

        response = req(
            field=["sum(session)"],
            query="session.status:[abnormal,crashed]",
            groupBy="release",
            orderBy="sum(session)",
        )
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Cannot order by sum(session) with the current filters"}

        response = req(
            field=["sum(session)"],
            query="session.status:healthy",
            groupBy="release",
            orderBy="sum(session)",
        )
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Cannot order by sum(session) with the current filters"}

    @freeze_time(MOCK_DATETIME)
    def test_anr_rate(self):
        def store_anr_session(user_id, mechanism):
            self.store_session(
                make_session(
                    self.project2,
                    distinct_id=user_id,
                    errors=1,
                    status="abnormal",
                    abnormal_mechanism=mechanism,
                )
            )

        self.store_session(
            make_session(
                self.project2,
                distinct_id="610c480b-3c47-4871-8c03-05ea04595eb0",
                started=SESSION_STARTED - 60 * 60,
            )
        )
        store_anr_session("610c480b-3c47-4871-8c03-05ea04595eb0", "anr_foreground")

        self.store_session(
            make_session(
                self.project2,
                distinct_id="ac0b74a2-8ace-415a-82d2-0fdb0d81dec4",
                started=SESSION_STARTED - 60 * 60,
            )
        )
        store_anr_session("ac0b74a2-8ace-415a-82d2-0fdb0d81dec4", "anr_background")

        self.store_session(
            make_session(
                self.project2,
                distinct_id="5344c005-653b-48b7-bbaf-d362c2f268dd",
                started=SESSION_STARTED - 60 * 60,
            )
        )

        default_request = {
            "project": [-1],
            "statsPeriod": "1d",
            "interval": "1d",
            "field": ["anr_rate()"],
        }

        def req(**kwargs):
            return self.do_request(dict(default_request, **kwargs))

        # basic test case
        response = req()
        assert response.status_code == 200
        assert response.data["groups"] == [
            {"by": {}, "totals": {"anr_rate()": 0.5}, "series": {"anr_rate()": [None, 0.5]}}
        ]

        # group by session.status
        response = req(
            groupBy="session.status",
        )
        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Cannot group field anr_rate() by session.status"}

        # valid group by
        response = req(
            field=["anr_rate()", "foreground_anr_rate()"],
            groupBy=["release", "environment"],
            orderBy=["anr_rate()"],
            query="release:foo@1.0.0",
        )

        assert response.status_code == 200, response.content
        assert response.data["groups"] == [
            {
                "by": {"environment": "production", "release": "foo@1.0.0"},
                "series": {
                    "anr_rate()": [None, 0.5],
                    "foreground_anr_rate()": [None, 0.25],
                },
                "totals": {
                    "anr_rate()": 0.5,
                    "foreground_anr_rate()": 0.25,
                },
            },
        ]

    @freeze_time(MOCK_DATETIME)
    def test_crash_rate(self):
        default_request = {
            "project": [-1],
            "statsPeriod": "1d",
            "interval": "1d",
            "field": ["crash_rate(session)"],
        }

        def req(**kwargs):
            return self.do_request(dict(default_request, **kwargs))

        # 1 - filter session.status
        response = req(
            query="session.status:[abnormal,crashed]",
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "Cannot filter field crash_rate(session) by session.status"
        }

        # 2 - group by session.status
        response = req(
            groupBy="session.status",
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "Cannot group field crash_rate(session) by session.status"
        }

        # 4 - fetch all
        response = req(
            field=[
                "crash_rate(session)",
                "crash_rate(user)",
                "crash_free_rate(session)",
                "crash_free_rate(user)",
            ],
            groupBy=["release", "environment"],
            orderBy=["crash_free_rate(session)"],
            query="release:foo@1.0.0",
        )
        assert response.status_code == 200, response.content
        assert response.data["groups"] == [
            {
                "by": {"environment": "production", "release": "foo@1.0.0"},
                "series": {
                    "crash_free_rate(session)": [None, 0.8333333333333334],
                    "crash_free_rate(user)": [None, 1.0],
                    "crash_rate(session)": [None, 0.16666666666666666],
                    "crash_rate(user)": [None, 0.0],
                },
                "totals": {
                    "crash_free_rate(session)": 0.8333333333333334,
                    "crash_free_rate(user)": 1.0,
                    "crash_rate(session)": 0.16666666666666666,
                    "crash_rate(user)": 0.0,
                },
            },
            {
                "by": {"environment": "development", "release": "foo@1.0.0"},
                "series": {
                    "crash_free_rate(session)": [None, 1.0],
                    "crash_free_rate(user)": [None, None],
                    "crash_rate(session)": [None, 0.0],
                    "crash_rate(user)": [None, None],
                },
                "totals": {
                    "crash_free_rate(session)": 1.0,
                    "crash_free_rate(user)": None,
                    "crash_rate(session)": 0.0,
                    "crash_rate(user)": None,
                },
            },
        ]

    @freeze_time(MOCK_DATETIME)
    def test_pagination(self):
        def do_request(cursor):
            return self.do_request(
                {
                    "project": self.project.id,  # project without users
                    "statsPeriod": "1d",
                    "interval": "1d",
                    "field": ["count_unique(user)", "sum(session)"],
                    "query": "",
                    "groupBy": "release",
                    "orderBy": "sum(session)",
                    "per_page": 1,
                    **({"cursor": cursor} if cursor else {}),
                }
            )

        response = do_request(None)

        assert response.status_code == 200, response.data
        assert len(response.data["groups"]) == 1
        assert response.data["groups"] == [
            {
                "by": {"release": "foo@1.1.0"},
                "series": {"count_unique(user)": [0, 0], "sum(session)": [0, 1]},
                "totals": {"count_unique(user)": 0, "sum(session)": 1},
            }
        ]
        links = {link["rel"]: link for url, link in parse_link_header(response["Link"]).items()}
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        response = do_request(links["next"]["cursor"])
        assert response.status_code == 200, response.data
        assert len(response.data["groups"]) == 1
        assert response.data["groups"] == [
            {
                "by": {"release": "foo@1.0.0"},
                "series": {"count_unique(user)": [0, 0], "sum(session)": [0, 3]},
                "totals": {"count_unique(user)": 0, "sum(session)": 3},
            }
        ]
        links = {link["rel"]: link for url, link in parse_link_header(response["Link"]).items()}
        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

    def test_unrestricted_date_range(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "7h",
                "interval": "5m",
                "field": ["sum(session)"],
            }
        )
        assert response.status_code == 200

    @freeze_time(MOCK_DATETIME)
    def test_release_is_empty(self):
        self.store_session(
            make_session(
                self.project1, started=SESSION_STARTED + 12 * 60, release="", environment=""
            )
        )
        for query in ('release:"" environment:""', 'release:"" OR environment:""'):
            # Empty strings are invalid values for releases and environments, but we should still handle those cases
            # correctly at the query layer
            response = self.do_request(
                {
                    "project": self.project.id,  # project without users
                    "statsPeriod": "1d",
                    "interval": "1d",
                    "field": ["sum(session)"],
                    "query": query,
                    "groupBy": ["release", "environment"],
                }
            )

            assert response.status_code == 200, response.content
            assert result_sorted(response.data)["groups"] == [
                {
                    "by": {"environment": "", "release": ""},
                    "series": {"sum(session)": [0, 1]},
                    "totals": {"sum(session)": 1},
                }
            ]


class SessionsMetricsSortReleaseTimestampTest(BaseMetricsTestCase, APITestCase):
    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-sessions",
            kwargs={"organization_slug": (org or self.organization).slug},
        )
        return self.client.get(url, query, format="json")

    @freeze_time(MOCK_DATETIME)
    def test_order_by_with_no_releases(self):
        """
        Test that ensures if we have no releases in the preflight query when trying to order by
        `release.timestamp`, we get no groups.
        Essentially testing the empty preflight query filters branch.
        """
        project_random = self.create_project()
        for _ in range(0, 2):
            self.store_session(make_session(project_random))
        self.store_session(make_session(project_random, status="crashed"))

        response = self.do_request(
            {
                "project": project_random.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["crash_free_rate(session)"],
                "groupBy": ["release"],
                "orderBy": "-release.timestamp",
                "per_page": 3,
            }
        )
        assert response.data["groups"] == []

    def test_order_by_max_limit(self):
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["crash_free_rate(session)"],
                "groupBy": ["release"],
                "orderBy": "-release.timestamp",
                "per_page": 103,
            }
        )
        assert response.data["detail"] == (
            "This limit is too high for queries that requests a preflight query. "
            "Please choose a limit below 100"
        )

    @freeze_time(MOCK_DATETIME)
    def test_order_by(self):
        """
        Test that ensures that we are able to get the crash_free_rate for the most 2 recent
        releases when grouping by release
        """
        # Step 1: Create 3 releases
        release1b = self.create_release(version="1B")
        release1c = self.create_release(version="1C")
        release1d = self.create_release(version="1D")

        # Step 2: Create crash free rate for each of those releases
        # Release 1c -> 66.7% Crash free rate
        for _ in range(0, 2):
            self.store_session(make_session(self.project, release=release1c.version))
        self.store_session(make_session(self.project, release=release1c.version, status="crashed"))

        # Release 1b -> 33.3% Crash free rate
        for _ in range(0, 2):
            self.store_session(
                make_session(self.project, release=release1b.version, status="crashed")
            )
        self.store_session(make_session(self.project, release=release1b.version))

        # Create Sessions in each of these releases
        # Release 1d -> 80% Crash free rate
        for _ in range(0, 4):
            self.store_session(make_session(self.project, release=release1d.version))
        self.store_session(make_session(self.project, release=release1d.version, status="crashed"))

        # Step 3: Make request
        response = self.do_request(
            {
                "project": self.project.id,  # project without users
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["crash_free_rate(session)"],
                "groupBy": ["release"],
                "orderBy": "-release.timestamp",
                "per_page": 3,
            }
        )
        # Step 4: Validate Results
        assert response.data["groups"] == [
            {
                "by": {"release": "1D"},
                "totals": {"crash_free_rate(session)": 0.8},
                "series": {"crash_free_rate(session)": [None, 0.8]},
            },
            {
                "by": {"release": "1C"},
                "totals": {"crash_free_rate(session)": 0.6666666666666667},
                "series": {"crash_free_rate(session)": [None, 0.6666666666666667]},
            },
            {
                "by": {"release": "1B"},
                "totals": {"crash_free_rate(session)": 0.33333333333333337},
                "series": {"crash_free_rate(session)": [None, 0.33333333333333337]},
            },
        ]

    @freeze_time(MOCK_DATETIME)
    def test_order_by_with_session_status_groupby(self):
        """
        Test that ensures we are able to group by session.status and order by `release.timestamp`
        since `release.timestamp` is generated from a preflight query
        """
        rando_project = self.create_project()

        release_1a = self.create_release(project=rando_project, version="1A")
        release_1b = self.create_release(project=rando_project, version="1B")

        # Release 1B sessions
        for _ in range(4):
            self.store_session(
                make_session(rando_project, release=release_1b.version, status="crashed")
            )
        for _ in range(10):
            self.store_session(make_session(rando_project, release=release_1b.version))
        for _ in range(3):
            self.store_session(make_session(rando_project, errors=1, release=release_1b.version))

        # Release 1A sessions
        for _ in range(0, 2):
            self.store_session(
                make_session(rando_project, release=release_1a.version, status="crashed")
            )
        self.store_session(make_session(rando_project, release=release_1a.version))
        for _ in range(3):
            self.store_session(make_session(rando_project, errors=1, release=release_1a.version))

        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release", "session.status"],
                "orderBy": "-release.timestamp",
            }
        )
        assert response.data["groups"] == [
            {
                "by": {"release": "1B", "session.status": "abnormal"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1B", "session.status": "crashed"},
                "totals": {"sum(session)": 4},
                "series": {"sum(session)": [0, 4]},
            },
            {
                "by": {"release": "1B", "session.status": "errored"},
                "totals": {"sum(session)": 3},
                "series": {"sum(session)": [0, 3]},
            },
            {
                "by": {"release": "1B", "session.status": "healthy"},
                "totals": {"sum(session)": 10},
                "series": {"sum(session)": [0, 10]},
            },
            {
                "by": {"release": "1A", "session.status": "abnormal"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1A", "session.status": "crashed"},
                "totals": {"sum(session)": 2},
                "series": {"sum(session)": [0, 2]},
            },
            {
                "by": {"release": "1A", "session.status": "errored"},
                "totals": {"sum(session)": 3},
                "series": {"sum(session)": [0, 3]},
            },
            {
                "by": {"release": "1A", "session.status": "healthy"},
                "totals": {"sum(session)": 1},
                "series": {"sum(session)": [0, 1]},
            },
        ]

    @freeze_time(MOCK_DATETIME)
    def test_order_by_with_limit(self):
        rando_project = self.create_project()

        # Create two releases with no metrics data and then two releases with metric data
        release_1a = self.create_release(project=rando_project, version="1A")
        release_1b = self.create_release(project=rando_project, version="1B")
        self.create_release(project=rando_project, version="1C")
        self.create_release(project=rando_project, version="1D")

        self.store_session(make_session(rando_project, release=release_1a.version))
        self.store_session(make_session(rando_project, release=release_1b.version))
        self.store_session(
            make_session(rando_project, release=release_1b.version, status="crashed")
        )

        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release"],
                "orderBy": "-release.timestamp",
                "per_page": 3,
            }
        )

        assert response.data["groups"] == [
            {
                "by": {"release": "1D"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1C"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1B"},
                "totals": {"sum(session)": 2},
                "series": {"sum(session)": [0, 2]},
            },
        ]

        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release", "session.status"],
                "orderBy": "-release.timestamp",
                "per_page": 4,
            }
        )
        assert response.data["groups"] == [
            {
                "by": {"release": "1D", "session.status": None},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1C", "session.status": None},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1B", "session.status": "abnormal"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1B", "session.status": "crashed"},
                "totals": {"sum(session)": 1},
                "series": {"sum(session)": [0, 1]},
            },
        ]

        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release", "session.status", "project"],
                "orderBy": "-release.timestamp",
                "per_page": 2,
            }
        )
        assert response.data["groups"] == [
            {
                "by": {"release": "1D", "session.status": None, "project": None},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
            {
                "by": {"release": "1C", "session.status": None, "project": None},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0]},
            },
        ]

    @freeze_time(MOCK_DATETIME)
    def test_order_by_with_limit_and_offset(self):
        rando_project = self.create_project()

        # Create two releases with no metrics data and then two releases with metric data
        release_1a = self.create_release(project=rando_project, version="1A")
        release_1b = self.create_release(project=rando_project, version="1B")
        self.create_release(project=rando_project, version="1C")
        self.create_release(project=rando_project, version="1D")

        self.store_session(make_session(rando_project, release=release_1a.version))
        self.store_session(make_session(rando_project, release=release_1b.version))

        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release"],
                "orderBy": "-release.timestamp",
                "per_page": 3,
                "cursor": Cursor(0, 1),
            }
        )

        assert response.data["detail"] == (
            "Passing an offset value greater than 0 when ordering by release.timestamp "
            "is not permitted"
        )

    @freeze_time(MOCK_DATETIME)
    def test_order_by_with_environment_filter_on_preflight(self):
        rando_project = self.create_project()
        rando_env = self.create_environment(name="rando_env", project=self.project)

        # Create two releases with no metrics data and then two releases with metric data
        release_1a = self.create_release(
            project=rando_project, version="1A", environments=[rando_env]
        )
        release_1b = self.create_release(
            project=rando_project, version="1B", environments=[rando_env]
        )
        release_1c = self.create_release(project=rando_project, version="1C")
        release_1d = self.create_release(project=rando_project, version="1D")

        self.store_session(
            make_session(rando_project, release=release_1a.version, environment="rando_env")
        )
        self.store_session(
            make_session(rando_project, release=release_1b.version, environment="rando_env")
        )
        self.store_session(make_session(rando_project, release=release_1c.version))
        self.store_session(make_session(rando_project, release=release_1d.version))

        # Test env condition with IN
        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": "environment:[rando_env,rando_enc2]",
                "groupBy": ["release", "environment"],
                "orderBy": "-release.timestamp",
                "per_page": 4,
            }
        )
        assert response.data["groups"] == [
            {
                "by": {"release": "1B", "environment": "rando_env"},
                "totals": {"sum(session)": 1},
                "series": {"sum(session)": [0, 1]},
            },
            {
                "by": {"release": "1A", "environment": "rando_env"},
                "totals": {"sum(session)": 1},
                "series": {"sum(session)": [0, 1]},
            },
        ]

        # Test env condition with NOT IN
        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": "!environment:[rando_env,rando_enc2]",
                "groupBy": ["release", "environment"],
                "orderBy": "-release.timestamp",
                "per_page": 4,
            }
        )
        assert response.data["groups"] == [
            {
                "by": {"release": "1D", "environment": "production"},
                "totals": {"sum(session)": 1},
                "series": {"sum(session)": [0, 1]},
            },
            {
                "by": {"release": "1C", "environment": "production"},
                "totals": {"sum(session)": 1},
                "series": {"sum(session)": [0, 1]},
            },
        ]

        # Test env condition with invalid OR operation
        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": "environment:rando_env OR environment:rando_enc2",
                "groupBy": ["release", "environment"],
                "orderBy": "-release.timestamp",
                "per_page": 4,
            }
        )
        assert response.json()["detail"] == "Unable to parse condition with environment"

    @freeze_time(MOCK_DATETIME)
    def test_order_by_without_release_groupby(self):
        rando_project = self.create_project()
        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "query": "session.status:[crashed,errored]",
                "field": ["sum(session)"],
                "orderBy": "-release.timestamp",
                "per_page": 2,
            }
        )
        assert response.data["detail"] == (
            "To sort by release.timestamp, tag release must be in the groupBy"
        )

    @freeze_time(MOCK_DATETIME)
    def test_order_by_release_with_session_status_current_filter(self):
        rando_project = self.create_project()

        release_1a = self.create_release(project=rando_project, version="1A")
        release_1b = self.create_release(project=rando_project, version="1B")

        # Release 1B sessions
        for _ in range(4):
            self.store_session(
                make_session(rando_project, release=release_1b.version, status="crashed")
            )
        for _ in range(10):
            self.store_session(make_session(rando_project, release=release_1b.version))
        for _ in range(3):
            self.store_session(make_session(rando_project, errors=1, release=release_1b.version))

        # Release 1A sessions
        for _ in range(0, 2):
            self.store_session(
                make_session(rando_project, release=release_1a.version, status="crashed")
            )
        self.store_session(make_session(rando_project, release=release_1a.version))
        for _ in range(3):
            self.store_session(make_session(rando_project, errors=1, release=release_1a.version))

        response = self.do_request(
            {
                "project": rando_project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "query": "session.status:[crashed,errored]",
                "field": ["sum(session)"],
                "groupBy": ["release"],
                "orderBy": "-release.timestamp",
            }
        )

        assert response.data["groups"] == [
            {
                "by": {"release": "1B"},
                "totals": {"sum(session)": 7},
                "series": {"sum(session)": [0, 7]},
            },
            {
                "by": {"release": "1A"},
                "totals": {"sum(session)": 5},
                "series": {"sum(session)": [0, 5]},
            },
        ]
