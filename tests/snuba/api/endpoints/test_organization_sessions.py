import datetime
import pytz

from uuid import uuid4
from freezegun import freeze_time

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
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
            "duration": None,
            "errors": 0,
            "started": self.session_started,
            "received": self.received,
        }

        def make_session(project, **kwargs):
            return dict(
                template,
                session_id=uuid4().hex,
                org_id=project.organization_id,
                project_id=project.id,
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

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_minimum_interval(self):
        # smallest interval is 1h
        response = self.do_request(
            {"project": [-1], "statsPeriod": "2h", "interval": "5m", "field": ["sum(session)"]}
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "The interval has to be a multiple of the minimum interval of one hour."
        }

        response = self.do_request(
            {"project": [-1], "statsPeriod": "2h", "interval": "1h", "field": ["sum(session)"]}
        )
        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "start": "2021-01-14T11:00:00Z",
            "end": "2021-01-14T12:28:00Z",
            "query": "",
            "intervals": ["2021-01-14T11:00:00Z", "2021-01-14T12:00:00Z"],
            "groups": [
                {"by": {}, "series": {"sum(session)": [2, 6]}, "totals": {"sum(session)": 8}}
            ],
        }

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
                "series": {"sum(session)": [3]},
                "totals": {"sum(session)": 3},
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
