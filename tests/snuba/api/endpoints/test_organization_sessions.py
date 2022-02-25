import datetime
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytz
from django.urls import reverse
from freezegun import freeze_time

from sentry.release_health.metrics import MetricsReleaseHealthBackend
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.cases import SessionMetricsTestCase
from sentry.utils.dates import to_timestamp


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


class OrganizationSessionsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.setup_fixture()

    def setup_fixture(self):
        self.timestamp = to_timestamp(datetime.datetime(2021, 1, 14, 12, 27, 28, tzinfo=pytz.utc))
        self.received = self.timestamp
        self.session_started = self.timestamp // 3600 * 3600  # round to the hour

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

        template = {
            "distinct_id": "00000000-0000-0000-0000-000000000000",
            "status": "exited",
            "seq": 0,
            "release": "foo@1.0.0",
            "environment": "production",
            "retention_days": 90,
            "duration": 123.4,
            "errors": 0,
            "started": self.session_started,
            "received": self.received,
        }

        def make_duration(kwargs):
            """Randomish but deterministic duration"""
            return float(len(str(kwargs)))

        def make_session(project, **kwargs):
            return dict(
                template,
                session_id=uuid4().hex,
                org_id=project.organization_id,
                project_id=project.id,
                duration=make_duration(kwargs),
                **kwargs,
            )

        self.store_session(make_session(self.project1, started=self.session_started + 12 * 60))
        self.store_session(
            make_session(self.project1, started=self.session_started + 24 * 60, release="foo@1.1.0")
        )
        self.store_session(make_session(self.project1, started=self.session_started - 60 * 60))
        self.store_session(make_session(self.project1, started=self.session_started - 12 * 60 * 60))
        self.store_session(make_session(self.project2, status="crashed"))
        self.store_session(make_session(self.project2, environment="development"))
        self.store_session(make_session(self.project3, errors=1, release="foo@1.2.0"))
        self.store_session(
            make_session(
                self.project3,
                distinct_id="39887d89-13b2-4c84-8c23-5d13d2102664",
                started=self.session_started - 60 * 60,
            )
        )
        self.store_session(
            make_session(
                self.project3, distinct_id="39887d89-13b2-4c84-8c23-5d13d2102664", errors=1
            )
        )
        self.store_session(make_session(self.project4))

    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-sessions",
            kwargs={"organization_slug": (org or self.organization).slug},
        )
        return self.client.get(url, query, format="json")

    def test_empty_request(self):
        response = self.do_request({})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Request is missing a "field"'}

    def test_inaccessible_project(self):
        response = self.do_request({"project": [self.project4.id]})

        assert response.status_code == 403, response.content
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_unknown_field(self):
        response = self.do_request({"field": ["summ(sessin)"]})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid field: "summ(sessin)"'}

    def test_unknown_groupby(self):
        response = self.do_request({"field": ["sum(session)"], "groupBy": ["envriomnent"]})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid groupBy: "envriomnent"'}

    def test_illegal_groupby(self):
        response = self.do_request({"field": ["sum(session)"], "groupBy": ["issue.id"]})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid groupBy: "issue.id"'}

    def test_invalid_query(self):
        response = self.do_request(
            {"statsPeriod": "1d", "field": ["sum(session)"], "query": ["foo:bar"]}
        )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid query field: "foo"'}

        response = self.do_request(
            {
                "statsPeriod": "1d",
                "field": ["sum(session)"],
                "query": ["release:foo-bar@1.2.3 (123)"],
            }
        )

        assert response.status_code == 400, response.content
        # TODO: it would be good to provide a better error here,
        # since its not obvious where `message` comes from.
        assert response.data == {"detail": 'Invalid query field: "message"'}

    def test_illegal_query(self):
        response = self.do_request(
            {"statsPeriod": "1d", "field": ["sum(session)"], "query": ["issue.id:123"]}
        )
        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid query field: "group_id"'}

    def test_too_many_points(self):
        # default statsPeriod is 90d
        response = self.do_request({"field": ["sum(session)"], "interval": "1h"})

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "Your interval and date range would create too many results. "
            "Use a larger interval, or a smaller date range."
        }

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_timeseries_interval(self):
        response = self.do_request(
            {"project": [-1], "statsPeriod": "1d", "interval": "1d", "field": ["sum(session)"]}
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "start": "2021-01-14T00:00:00Z",
            "end": "2021-01-14T12:28:00Z",
            "query": "",
            "intervals": ["2021-01-14T00:00:00Z"],
            "groups": [{"by": {}, "series": {"sum(session)": [9]}, "totals": {"sum(session)": 9}}],
        }

        response = self.do_request(
            {"project": [-1], "statsPeriod": "1d", "interval": "6h", "field": ["sum(session)"]}
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "start": "2021-01-13T18:00:00Z",
            "end": "2021-01-14T12:28:00Z",
            "query": "",
            "intervals": [
                "2021-01-13T18:00:00Z",
                "2021-01-14T00:00:00Z",
                "2021-01-14T06:00:00Z",
                "2021-01-14T12:00:00Z",
            ],
            "groups": [
                {"by": {}, "series": {"sum(session)": [0, 1, 2, 6]}, "totals": {"sum(session)": 9}}
            ],
        }

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_user_all_accessible(self):
        response = self.do_request(
            {"project": [-1], "statsPeriod": "1d", "interval": "1d", "field": ["sum(session)"]},
            user=self.user2,
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "start": "2021-01-14T00:00:00Z",
            "end": "2021-01-14T12:28:00Z",
            "query": "",
            "intervals": ["2021-01-14T00:00:00Z"],
            "groups": [{"by": {}, "series": {"sum(session)": [9]}, "totals": {"sum(session)": 9}}],
        }

    def test_no_projects(self):
        response = self.do_request(
            {"project": [-1], "statsPeriod": "1d", "interval": "1d", "field": ["sum(session)"]},
            org=self.organization3,
        )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "No projects available"}

    @freeze_time("2021-01-14T12:37:28.303Z")
    def test_minute_resolution(self):
        with self.feature("organizations:minute-resolution-sessions"):
            response = self.do_request(
                {
                    "project": [self.project1.id, self.project2.id],
                    "statsPeriod": "30m",
                    "interval": "10m",
                    "field": ["sum(session)"],
                }
            )
            assert response.status_code == 200, response.content
            assert result_sorted(response.data) == {
                "start": "2021-01-14T12:00:00Z",
                "end": "2021-01-14T12:38:00Z",
                "query": "",
                "intervals": [
                    "2021-01-14T12:00:00Z",
                    "2021-01-14T12:10:00Z",
                    "2021-01-14T12:20:00Z",
                    "2021-01-14T12:30:00Z",
                ],
                "groups": [
                    {
                        "by": {},
                        "series": {"sum(session)": [2, 1, 1, 0]},
                        "totals": {"sum(session)": 4},
                    }
                ],
            }

    @freeze_time("2021-01-14T12:37:28.303Z")
    def test_10s_resolution(self):
        with self.feature("organizations:minute-resolution-sessions"):
            response = self.do_request(
                {
                    "project": [self.project1.id],
                    "statsPeriod": "1m",
                    "interval": "10s",
                    "field": ["sum(session)"],
                }
            )
            assert response.status_code == 200, response.content

            from sentry.api.endpoints.organization_sessions import release_health

            if release_health.is_metrics_based():
                # With the metrics backend, we should get exactly what we asked for,
                # 6 intervals with 10 second length. However, because of rounding,
                # we get it rounded to the next minute (see https://github.com/getsentry/sentry/blob/d6c59c32307eee7162301c76b74af419055b9b39/src/sentry/snuba/sessions_v2.py#L388-L392)
                assert len(response.data["intervals"]) == 9
            else:
                # With the sessions backend, the entire period will be aligned
                # to one hour, and the resolution will still be one minute:
                assert len(response.data["intervals"]) == 38

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_filter_projects(self):
        response = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "project": [self.project2.id, self.project3.id],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [5]}, "totals": {"sum(session)": 5}}
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_filter_environment(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": "environment:development",
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [1]}, "totals": {"sum(session)": 1}}
        ]

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "environment": ["development"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [1]}, "totals": {"sum(session)": 1}}
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_filter_release(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": "release:foo@1.1.0",
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [1]}, "totals": {"sum(session)": 1}}
        ]

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": 'release:"foo@1.1.0" or release:"foo@1.2.0"',
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [2]}, "totals": {"sum(session)": 2}}
        ]

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "query": 'release:"foo@1.1.0" or release:"foo@1.2.0" or release:"foo@1.3.0"',
                "groupBy": ["release"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"release": "foo@1.1.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"release": "foo@1.2.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_filter_unknown_release(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1h",
                "field": ["sum(session)"],
                "query": "release:foo@6.6.6",
                "groupBy": "session.status",
            }
        )

        assert response.status_code == 200, response.content

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_groupby_project(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["project"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"project": self.project1.id},
                "series": {"sum(session)": [4]},
                "totals": {"sum(session)": 4},
            },
            {
                "by": {"project": self.project2.id},
                "series": {"sum(session)": [2]},
                "totals": {"sum(session)": 2},
            },
            {
                "by": {"project": self.project3.id},
                "series": {"sum(session)": [3]},
                "totals": {"sum(session)": 3},
            },
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_groupby_environment(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["environment"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"environment": "development"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"environment": "production"},
                "series": {"sum(session)": [8]},
                "totals": {"sum(session)": 8},
            },
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_groupby_release(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"release": "foo@1.0.0"},
                "series": {"sum(session)": [7]},
                "totals": {"sum(session)": 7},
            },
            {
                "by": {"release": "foo@1.1.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"release": "foo@1.2.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_groupby_status(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["session.status"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"session.status": "abnormal"},
                "series": {"sum(session)": [0]},
                "totals": {"sum(session)": 0},
            },
            {
                "by": {"session.status": "crashed"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"session.status": "errored"},
                "series": {"sum(session)": [2]},
                "totals": {"sum(session)": 2},
            },
            {
                "by": {"session.status": "healthy"},
                "series": {"sum(session)": [6]},
                "totals": {"sum(session)": 6},
            },
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_groupby_cross(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "groupBy": ["release", "environment"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"environment": "development", "release": "foo@1.0.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"environment": "production", "release": "foo@1.0.0"},
                "series": {"sum(session)": [6]},
                "totals": {"sum(session)": 6},
            },
            {
                "by": {"environment": "production", "release": "foo@1.1.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
            {
                "by": {"environment": "production", "release": "foo@1.2.0"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 1},
            },
        ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_users_groupby(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["count_unique(user)"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"count_unique(user)": [1]}, "totals": {"count_unique(user)": 1}}
        ]

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["count_unique(user)"],
                "groupBy": ["session.status"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {
                "by": {"session.status": "abnormal"},
                "series": {"count_unique(user)": [0]},
                "totals": {"count_unique(user)": 0},
            },
            {
                "by": {"session.status": "crashed"},
                "series": {"count_unique(user)": [0]},
                "totals": {"count_unique(user)": 0},
            },
            {
                "by": {"session.status": "errored"},
                "series": {"count_unique(user)": [1]},
                "totals": {"count_unique(user)": 1},
            },
            {
                "by": {"session.status": "healthy"},
                "series": {"count_unique(user)": [0]},
                "totals": {"count_unique(user)": 0},
            },
        ]

    expected_duration_values = {
        "avg(session.duration)": 42375.0,
        "max(session.duration)": 80000.0,
        "p50(session.duration)": 33500.0,
        "p75(session.duration)": 53750.0,
        "p90(session.duration)": 71600.0,
        "p95(session.duration)": 75800.0,
        "p99(session.duration)": 79159.99999999999,
    }

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_duration_percentiles(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": [
                    "avg(session.duration)",
                    "p50(session.duration)",
                    "p75(session.duration)",
                    "p90(session.duration)",
                    "p95(session.duration)",
                    "p99(session.duration)",
                    "max(session.duration)",
                ],
            }
        )

        assert response.status_code == 200, response.content

        expected = self.expected_duration_values

        groups = result_sorted(response.data)["groups"]
        assert len(groups) == 1, groups
        group = groups[0]

        assert group["totals"] == pytest.approx(expected)
        for key, series in group["series"].items():
            assert series == pytest.approx([expected[key]])

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_duration_percentiles_groupby(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": [
                    "avg(session.duration)",
                    "p50(session.duration)",
                    "p75(session.duration)",
                    "p90(session.duration)",
                    "p95(session.duration)",
                    "p99(session.duration)",
                    "max(session.duration)",
                ],
                "groupBy": "session.status",
            }
        )

        assert response.status_code == 200, response.content

        expected = self.expected_duration_values

        seen = set()  # Make sure all session statuses are listed
        for group in result_sorted(response.data)["groups"]:
            seen.add(group["by"].get("session.status"))
            if group["by"] == {"session.status": "healthy"}:
                assert group["totals"] == pytest.approx(expected)
                for key, series in group["series"].items():
                    assert series == pytest.approx([expected[key]])
            else:
                # Everything's none:
                assert group["totals"] == {key: None for key in expected}, group["by"]
                assert group["series"] == {key: [None] for key in expected}

        assert seen == {"abnormal", "crashed", "errored", "healthy"}

    @freeze_time("2021-01-14T12:37:28.303Z")
    def test_snuba_limit_exceeded(self):
        # 2 * 3 => only show two groups
        with patch("sentry.snuba.sessions_v2.SNUBA_LIMIT", 6), patch(
            "sentry.release_health.metrics_sessions_v2.SNUBA_LIMIT", 6
        ):

            response = self.do_request(
                {
                    "project": [-1],
                    "statsPeriod": "3d",
                    "interval": "1d",
                    "field": ["sum(session)", "count_unique(user)"],
                    "groupBy": ["project", "release", "environment"],
                }
            )

            assert response.status_code == 200, response.content
            assert result_sorted(response.data)["groups"] == [
                {
                    "by": {
                        "release": "foo@1.0.0",
                        "environment": "production",
                        "project": self.project1.id,
                    },
                    "totals": {"sum(session)": 3, "count_unique(user)": 0},
                    "series": {"sum(session)": [0, 0, 3], "count_unique(user)": [0, 0, 0]},
                },
                {
                    "by": {
                        "release": "foo@1.0.0",
                        "environment": "production",
                        "project": self.project3.id,
                    },
                    "totals": {"sum(session)": 2, "count_unique(user)": 1},
                    "series": {"sum(session)": [0, 0, 2], "count_unique(user)": [0, 0, 1]},
                },
            ]

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_environment_filter_not_present_in_query(self):
        self.create_environment(name="abc")
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(session)"],
                "environment": ["development", "abc"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data)["groups"] == [
            {"by": {}, "series": {"sum(session)": [1]}, "totals": {"sum(session)": 1}}
        ]


@patch("sentry.api.endpoints.organization_sessions.release_health", MetricsReleaseHealthBackend())
class OrganizationSessionsEndpointMetricsTest(
    SessionMetricsTestCase, OrganizationSessionsEndpointTest
):
    """Repeat with metrics backend"""
