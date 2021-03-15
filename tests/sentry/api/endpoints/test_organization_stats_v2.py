import functools
import pytz
from django.core.urlresolvers import reverse
from datetime import datetime, timedelta
from sentry.testutils import APITestCase
from sentry.testutils.cases import OutcomesSnubaTest
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome

from freezegun import freeze_time


class OrganizationStatsTestV2(APITestCase, OutcomesSnubaTest):
    def setUp(self):
        super().setUp()
        self.now = datetime(2021, 3, 14, 12, 27, 28, tzinfo=pytz.utc)

        self.login_as(user=self.user)

        self.org = self.organization

        self.org2 = self.create_organization()

        self.project = self.create_project(
            name="bar", teams=[self.create_team(organization=self.org, members=[self.user])]
        )

        # self.other_project = self.create_project(name="bees", organization=self.org)
        self.other_project = self.create_project(
            name="foo", teams=[self.create_team(organization=self.org, members=[self.user])]
        )
        self.project3 = self.create_project(organization=self.org2)

        self.user2 = self.create_user(is_superuser=False)
        self.create_member(user=self.user2, organization=self.organization, role="member", teams=[])
        self.organization3 = self.create_organization()
        self.create_member(user=self.user, organization=self.organization3, role="admin", teams=[])

        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            }
        )
        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.DEFAULT,  # test that this shows up under error
                "quantity": 1,
            }
        )

        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "usage_exceeded",
                "category": DataCategory.ATTACHMENT,
                "quantity": 1024,
            }
        )
        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.other_project.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "usage_exceeded",
                "category": DataCategory.TRANSACTION,
                "quantity": 1,
            }
        )

    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-stats-v2",
            kwargs={"organization_slug": (org or self.organization).slug},
        )
        return self.client.get(url, query, format="json")

    def test_empty_request(self):
        response = self.do_request({})
        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Request is missing a "field"'}

    def test_inaccessible_project(self):
        response = self.do_request({"project": [self.project3.id]})

        assert response.status_code == 403, response.content
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_unknown_field(self):
        response = self.do_request({"field": ["summ(qarntenty)"]})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid field: "summ(qarntenty)"'}

    def test_unknown_groupby(self):
        response = self.do_request({"field": ["sum(quantity)"], "groupBy": ["cattygory"]})

        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid groupBy: "cattygory"'}

    def test_invalid_parameter(self):
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "dragon": "smaug",
            }
        )
        # TODO: should we error here?
        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid parameter: "dragon"'}

    def test_resolution_invalid(self):
        self.login_as(user=self.user)
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "bad_interval",
            }
        )

        assert response.status_code == 400, response.content

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_timeseries_interval(self):
        response = self.do_request(
            {
                "project": [-1],
                "category": ["error"],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "intervals": ["2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "series": {"sum(quantity)": [2]}, "totals": {"sum(quantity)": 2}}
            ],
        }

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "6h",
                "field": ["sum(quantity)"],
                "category": ["error"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "intervals": [
                "2021-03-13T18:00:00Z",
                "2021-03-14T00:00:00Z",
                "2021-03-14T06:00:00Z",
                "2021-03-14T12:00:00Z",
            ],
            "groups": [
                {
                    "by": {},
                    "series": {"sum(quantity)": [0, 0, 2, 0]},
                    "totals": {"sum(quantity)": 2},
                }
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_user_all_accessible(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            },
            user=self.user2,
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "intervals": ["2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "series": {"sum(quantity)": [3]}, "totals": {"sum(quantity)": 3}}
            ],
        }

    def test_no_projects(self):
        response = self.do_request(
            {"project": [-1], "statsPeriod": "1d", "interval": "1d", "field": ["sum(quantity)"]},
            org=self.organization3,
        )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "No projects available"}

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_simple(self):
        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug])
        )
        response = make_request(
            {
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "groupBy": ["category", "outcome", "reason"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {
                        "outcome": "rate_limited",
                        "reason": "usage_exceeded",
                        "category": "attachment",
                    },
                    "totals": {"sum(quantity)": 1024},
                    "series": {"sum(quantity)": [0, 1024]},
                },
                {
                    "by": {"outcome": "accepted", "reason": "none", "category": "error"},
                    "totals": {"sum(quantity)": 2},
                    "series": {"sum(quantity)": [0, 2]},
                },
                {
                    "by": {
                        "category": "transaction",
                        "reason": "usage_exceeded",
                        "outcome": "rate_limited",
                    },
                    "totals": {"sum(quantity)": 1},
                    "series": {"sum(quantity)": [0, 1]},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_multiple_fields(self):
        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug])
        )
        response = make_request(
            {
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(quantity)", "sum(times_seen)"],
                "groupBy": ["category", "outcome", "reason"],
                # "category": ["transaction", "error", "attachment"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {
                        "outcome": "rate_limited",
                        "category": "attachment",
                        "reason": "usage_exceeded",
                    },
                    "totals": {"sum(quantity)": 1024, "sum(times_seen)": 1},
                    "series": {"sum(quantity)": [0, 1024], "sum(times_seen)": [0, 1]},
                },
                {
                    "by": {"outcome": "accepted", "reason": "none", "category": "error"},
                    "totals": {"sum(quantity)": 2, "sum(times_seen)": 2},
                    "series": {"sum(quantity)": [0, 2], "sum(times_seen)": [0, 2]},
                },
                {
                    "by": {
                        "category": "transaction",
                        "reason": "usage_exceeded",
                        "outcome": "rate_limited",
                    },
                    "totals": {"sum(quantity)": 1, "sum(times_seen)": 1},
                    "series": {"sum(quantity)": [0, 1], "sum(times_seen)": [0, 1]},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_group_by_project(self):
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(times_seen)"],
                "groupBy": ["project"],
                "category": ["error", "transaction"],
            }
        )

        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "intervals": ["2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {"project": self.project.id},
                    "totals": {"sum(times_seen)": 2},
                    "series": {"sum(times_seen)": [2]},
                },
                {
                    "by": {"project": self.other_project.id},
                    "totals": {"sum(times_seen)": 1},
                    "series": {"sum(times_seen)": [1]},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_project_filter(self):
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug]),
        )
        response = make_request(
            {
                "project": self.project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "intervals": ["2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "totals": {"sum(quantity)": 2}, "series": {"sum(quantity)": [2]}}
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_reason_filter(self):
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(times_seen)"],
                "reason": ["usage_exceeded"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "intervals": ["2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "totals": {"sum(times_seen)": 2}, "series": {"sum(times_seen)": [2]}}
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_outcome_filter(self):
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "outcome": "accepted",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "intervals": ["2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "totals": {"sum(quantity)": 2}, "series": {"sum(quantity)": [2]}}
            ],
        }

        @freeze_time("2021-03-14T12:27:28.303Z")
        def test_category_filter(self):
            make_request = functools.partial(
                self.client.get,
                reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug]),
            )
            response = make_request(
                {
                    "statsPeriod": "1d",
                    "interval": "1d",
                    "field": ["sum(quantity)"],
                    "category": "error",
                }
            )
            assert response.status_code == 200, response.content
            assert response.data == {
                "intervals": ["2021-03-14T00:00:00Z"],
                "groups": [
                    {"by": {}, "totals": {"sum(quantity)": 1}, "series": {"sum(quantity)": [1]}}
                ],
            }


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


# TEST invalid parameter
