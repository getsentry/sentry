from datetime import datetime, timedelta, timezone

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.outcomes import Outcome


class OrganizationStatsTestV2(APITestCase, OutcomesSnubaTest):
    endpoint = "sentry-api-0-organization-stats-v2"

    def setUp(self):
        super().setUp()
        self.now = datetime(2021, 3, 14, 12, 27, 28, tzinfo=timezone.utc)

        self.login_as(user=self.user)

        self.org = self.organization
        self.org.flags.allow_joinleave = False
        self.org.save()

        self.org2 = self.create_organization()
        self.org3 = self.create_organization()

        self.project = self.create_project(
            name="bar", teams=[self.create_team(organization=self.org, members=[self.user])]
        )
        self.project2 = self.create_project(
            name="foo", teams=[self.create_team(organization=self.org, members=[self.user])]
        )
        self.project3 = self.create_project(organization=self.org2)

        self.user2 = self.create_user(is_superuser=False)
        self.create_member(user=self.user2, organization=self.organization, role="member", teams=[])
        self.create_member(user=self.user2, organization=self.org3, role="member", teams=[])
        self.project4 = self.create_project(
            name="users2sproj",
            teams=[self.create_team(organization=self.org, members=[self.user2])],
        )

        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            5,
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
                "reason": "smart_rate_limit",
                "category": DataCategory.ATTACHMENT,
                "quantity": 1024,
            }
        )
        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project2.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "smart_rate_limit",
                "category": DataCategory.TRANSACTION,
                "quantity": 1,
            }
        )

        # Add profile_duration outcome data
        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.PROFILE_DURATION,
                "quantity": 1000,  # Duration in milliseconds
            },
            3,
        )

    def do_request(self, query, user=None, org=None, status_code=200):
        self.login_as(user=user or self.user)
        org_slug = (org or self.organization).slug
        if status_code >= 400:
            return self.get_error_response(org_slug, **query, status_code=status_code)
        return self.get_success_response(org_slug, **query, status_code=status_code)

    def test_empty_request(self):
        response = self.do_request({}, status_code=400)
        assert result_sorted(response.data) == {"detail": 'At least one "field" is required.'}

    def test_inaccessible_project(self):
        response = self.do_request({"project": [self.project3.id]}, status_code=403)

        assert result_sorted(response.data) == {
            "detail": "You do not have permission to perform this action."
        }

    def test_no_projects_available(self):
        response = self.do_request(
            {
                "groupBy": ["project"],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            },
            user=self.user2,
            org=self.org3,
            status_code=400,
        )

        assert result_sorted(response.data) == {
            "detail": "No projects available",
        }

    def test_unknown_field(self):
        response = self.do_request(
            {
                "field": ["summ(qarntenty)"],
                "statsPeriod": "1d",
                "interval": "1d",
            },
            status_code=400,
        )

        assert result_sorted(response.data) == {
            "detail": 'Invalid field: "summ(qarntenty)"',
        }

    def test_no_end_param(self):
        response = self.do_request(
            {"field": ["sum(quantity)"], "interval": "1d", "start": "2021-03-14T00:00:00Z"},
            status_code=400,
        )

        assert result_sorted(response.data) == {"detail": "start and end are both required"}

    @freeze_time(datetime(2021, 3, 14, 12, 27, 28, tzinfo=timezone.utc))
    def test_future_request(self):
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "interval": "1h",
                "category": ["error"],
                "start": "2021-03-14T15:30:00",
                "end": "2021-03-14T16:30:00",
            },
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "intervals": [
                "2021-03-14T12:00:00Z",
                "2021-03-14T13:00:00Z",
                "2021-03-14T14:00:00Z",
                "2021-03-14T15:00:00Z",
                "2021-03-14T16:00:00Z",
            ],
            "groups": [
                {
                    "by": {},
                    "series": {"sum(quantity)": [0, 0, 0, 0, 0]},
                    "totals": {"sum(quantity)": 0},
                }
            ],
            "start": "2021-03-14T12:00:00Z",
            "end": "2021-03-14T17:00:00Z",
        }

    def test_unknown_category(self):
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "statsPeriod": "1d",
                "interval": "1d",
                "category": "scoobydoo",
            },
            status_code=400,
        )

        assert result_sorted(response.data) == {
            "detail": 'Invalid category: "scoobydoo"',
        }

    def test_unknown_outcome(self):
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "statsPeriod": "1d",
                "interval": "1d",
                "category": "error",
                "outcome": "scoobydoo",
            },
            status_code=400,
        )

        assert result_sorted(response.data) == {
            "detail": 'Invalid outcome: "scoobydoo"',
        }

    def test_unknown_groupby(self):
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "groupBy": ["category_"],
                "statsPeriod": "1d",
                "interval": "1d",
            },
            status_code=400,
        )

        assert result_sorted(response.data) == {"detail": 'Invalid groupBy: "category_"'}

    def test_resolution_invalid(self):
        self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "bad_interval",
            },
            org=self.org,
            status_code=400,
        )

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_attachment_filter_only(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "attachment"],
            },
            status_code=400,
        )

        assert result_sorted(response.data) == {
            "detail": "if filtering by attachment no other category may be present"
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_timeseries_interval(self):
        response = self.do_request(
            {
                "project": [-1],
                "category": ["error"],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
            },
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "series": {"sum(quantity)": [0, 6]}, "totals": {"sum(quantity)": 6}}
            ],
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
        }

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "6h",
                "field": ["sum(quantity)"],
                "category": ["error"],
            },
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "intervals": [
                "2021-03-13T12:00:00Z",
                "2021-03-13T18:00:00Z",
                "2021-03-14T00:00:00Z",
                "2021-03-14T06:00:00Z",
                "2021-03-14T12:00:00Z",
            ],
            "groups": [
                {
                    "by": {},
                    "series": {"sum(quantity)": [0, 0, 0, 6, 0]},
                    "totals": {"sum(quantity)": 6},
                }
            ],
            "start": "2021-03-13T12:00:00Z",
            "end": "2021-03-14T18:00:00Z",
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_user_org_total_all_accessible(self):
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            },
            user=self.user2,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "series": {"sum(quantity)": [0, 7]}, "totals": {"sum(quantity)": 7}}
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_user_no_proj_specific_access(self):
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            },
            user=self.user2,
            status_code=403,
        )

        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
                "groupBy": ["project"],
            },
            user=self.user2,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "groups": [],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_no_project_access(self):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member", teams=[])

        response = self.do_request(
            {
                "project": [self.project.id],
                "statsPeriod": "1d",
                "interval": "1d",
                "category": ["error", "transaction"],
                "field": ["sum(quantity)"],
            },
            org=self.organization,
            user=user,
            status_code=403,
        )

        assert result_sorted(response.data) == {
            "detail": "You do not have permission to perform this action."
        }

        response = self.do_request(
            {
                "project": [self.project.id],
                "groupBy": ["project"],
                "statsPeriod": "1d",
                "interval": "1d",
                "category": ["error", "transaction"],
                "field": ["sum(quantity)"],
            },
            org=self.organization,
            user=user,
            status_code=403,
        )

        assert result_sorted(response.data) == {
            "detail": "You do not have permission to perform this action."
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_open_membership_semantics(self):
        self.org.flags.allow_joinleave = True
        self.org.save()
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
                "groupBy": ["project"],
            },
            user=self.user2,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "groups": [
                {
                    "by": {"project": self.project.id},
                    "totals": {"sum(quantity)": 6},
                },
                {
                    "by": {"project": self.project2.id},
                    "totals": {"sum(quantity)": 1},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_simple(self):
        response = self.do_request(
            {
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "groupBy": ["category", "outcome", "reason"],
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "end": "2021-03-15T00:00:00Z",
            "groups": [
                {
                    "by": {
                        "category": "attachment",
                        "outcome": "rate_limited",
                        "reason": "spike_protection",
                    },
                    "series": {"sum(quantity)": [0, 0, 1024]},
                    "totals": {"sum(quantity)": 1024},
                },
                {
                    "by": {"category": "error", "outcome": "accepted", "reason": "none"},
                    "series": {"sum(quantity)": [0, 0, 6]},
                    "totals": {"sum(quantity)": 6},
                },
                {
                    "by": {"category": "profile_duration", "outcome": "accepted", "reason": "none"},
                    "series": {"sum(quantity)": [0, 0, 3000]},
                    "totals": {"sum(quantity)": 3000},
                },
                {
                    "by": {
                        "category": "transaction",
                        "outcome": "rate_limited",
                        "reason": "spike_protection",
                    },
                    "series": {"sum(quantity)": [0, 0, 1]},
                    "totals": {"sum(quantity)": 1},
                },
            ],
            "intervals": ["2021-03-12T00:00:00Z", "2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "start": "2021-03-12T00:00:00Z",
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_staff_org_individual_category(self):
        staff_user = self.create_user(is_staff=True, is_superuser=True)
        self.login_as(user=staff_user, superuser=True)

        category_group_mapping = {
            "attachment": {
                "by": {
                    "outcome": "rate_limited",
                    "reason": "spike_protection",
                },
                "totals": {"sum(quantity)": 1024},
                "series": {"sum(quantity)": [0, 0, 1024]},
            },
            "error": {
                "by": {"outcome": "accepted", "reason": "none"},
                "totals": {"sum(quantity)": 6},
                "series": {"sum(quantity)": [0, 0, 6]},
            },
            "transaction": {
                "by": {
                    "reason": "spike_protection",
                    "outcome": "rate_limited",
                },
                "totals": {"sum(quantity)": 1},
                "series": {"sum(quantity)": [0, 0, 1]},
            },
        }

        # Test each category individually
        for category in ["attachment", "error", "transaction"]:
            response = self.do_request(
                {
                    "category": category,
                    "statsPeriod": "2d",
                    "interval": "1d",
                    "field": ["sum(quantity)"],
                    "groupBy": ["outcome", "reason"],
                },
                org=self.org,
                status_code=200,
            )

            assert result_sorted(response.data) == {
                "start": "2021-03-12T00:00:00Z",
                "end": "2021-03-15T00:00:00Z",
                "intervals": [
                    "2021-03-12T00:00:00Z",
                    "2021-03-13T00:00:00Z",
                    "2021-03-14T00:00:00Z",
                ],
                "groups": [category_group_mapping[category]],
            }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_multiple_fields(self):
        response = self.do_request(
            {
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(quantity)", "sum(times_seen)"],
                "groupBy": ["category", "outcome", "reason"],
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-12T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-12T00:00:00Z", "2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {
                        "reason": "spike_protection",
                        "outcome": "rate_limited",
                        "category": "attachment",
                    },
                    "totals": {"sum(quantity)": 1024, "sum(times_seen)": 1},
                    "series": {"sum(quantity)": [0, 0, 1024], "sum(times_seen)": [0, 0, 1]},
                },
                {
                    "by": {"category": "error", "reason": "none", "outcome": "accepted"},
                    "totals": {"sum(quantity)": 6, "sum(times_seen)": 6},
                    "series": {"sum(quantity)": [0, 0, 6], "sum(times_seen)": [0, 0, 6]},
                },
                {
                    "by": {"category": "profile_duration", "reason": "none", "outcome": "accepted"},
                    "totals": {"sum(quantity)": 3000, "sum(times_seen)": 3},
                    "series": {"sum(quantity)": [0, 0, 3000], "sum(times_seen)": [0, 0, 3]},
                },
                {
                    "by": {
                        "category": "transaction",
                        "reason": "spike_protection",
                        "outcome": "rate_limited",
                    },
                    "totals": {"sum(quantity)": 1, "sum(times_seen)": 1},
                    "series": {"sum(quantity)": [0, 0, 1], "sum(times_seen)": [0, 0, 1]},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_group_by_project(self):
        response = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(times_seen)"],
                "groupBy": ["project"],
                "category": ["error", "transaction"],
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "groups": [
                {
                    "by": {"project": self.project.id},
                    "totals": {"sum(times_seen)": 6},
                },
                {
                    "by": {"project": self.project2.id},
                    "totals": {"sum(times_seen)": 1},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_org_project_totals_per_project(self):
        response_per_group = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1h",
                "field": ["sum(times_seen)"],
                "groupBy": ["project"],
                "category": ["error", "transaction"],
            },
            org=self.org,
            status_code=200,
        )
        response_total = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1h",
                "field": ["sum(times_seen)"],
                "category": ["error", "transaction"],
            },
            org=self.org,
            status_code=200,
        )

        per_group_total = 0
        for total in response_per_group.data["groups"]:
            per_group_total += total["totals"]["sum(times_seen)"]

        assert response_per_group.status_code == 200, response_per_group.content
        assert response_total.status_code == 200, response_total.content
        assert response_total.data["groups"][0]["totals"]["sum(times_seen)"] == per_group_total

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_project_filter(self):
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "totals": {"sum(quantity)": 6}, "series": {"sum(quantity)": [0, 6]}}
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_staff_project_filter(self):
        staff_user = self.create_user(is_staff=True, is_superuser=True)
        self.login_as(user=staff_user, superuser=True)

        shared_query_params = {
            "field": "sum(quantity)",
            "groupBy": ["outcome", "reason"],
            "interval": "1d",
            "statsPeriod": "1d",
        }
        shared_data = {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
        }

        # Test error category
        response = self.do_request(
            {
                **shared_query_params,
                "category": "error",
                "project": self.project.id,
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            **shared_data,
            "groups": [
                {
                    "by": {"outcome": "accepted", "reason": "none"},
                    "totals": {"sum(quantity)": 6},
                    "series": {"sum(quantity)": [0, 6]},
                },
            ],
        }

        # Test transaction category
        response = self.do_request(
            {
                **shared_query_params,
                "category": "transaction",
                "project": self.project2.id,
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            **shared_data,
            "groups": [
                {
                    "by": {"outcome": "rate_limited", "reason": "spike_protection"},
                    "totals": {"sum(quantity)": 1},
                    "series": {"sum(quantity)": [0, 1]},
                }
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_reason_filter(self):
        response = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(times_seen)"],
                "reason": ["spike_protection"],
                "groupBy": ["category"],
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {"category": "attachment"},
                    "totals": {"sum(times_seen)": 1},
                    "series": {"sum(times_seen)": [0, 1]},
                },
                {
                    "by": {"category": "transaction"},
                    "totals": {"sum(times_seen)": 1},
                    "series": {"sum(times_seen)": [0, 1]},
                },
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_outcome_filter(self):
        response = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "outcome": "accepted",
                "category": ["error", "transaction"],
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "totals": {"sum(quantity)": 6}, "series": {"sum(quantity)": [0, 6]}}
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_category_filter(self):
        response = self.do_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": "error",
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {"by": {}, "totals": {"sum(quantity)": 6}, "series": {"sum(quantity)": [0, 6]}}
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_minute_interval_sum_quantity(self):
        response = self.do_request(
            {
                "statsPeriod": "1h",
                "interval": "15m",
                "field": ["sum(quantity)"],
                "category": "error",
            },
            org=self.org,
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-14T11:15:00Z",
            "end": "2021-03-14T12:30:00Z",
            "intervals": [
                "2021-03-14T11:15:00Z",
                "2021-03-14T11:30:00Z",
                "2021-03-14T11:45:00Z",
                "2021-03-14T12:00:00Z",
                "2021-03-14T12:15:00Z",
            ],
            "groups": [
                {
                    "by": {},
                    "totals": {"sum(quantity)": 6},
                    "series": {"sum(quantity)": [6, 0, 0, 0, 0]},
                }
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_minute_interval_sum_times_seen(self):
        response = self.do_request(
            {
                "statsPeriod": "1h",
                "interval": "15m",
                "field": ["sum(times_seen)"],
                "category": "error",
            }
        )
        assert response.status_code == 200, response.content
        assert result_sorted(response.data) == {
            "start": "2021-03-14T11:15:00Z",
            "end": "2021-03-14T12:30:00Z",
            "intervals": [
                "2021-03-14T11:15:00Z",
                "2021-03-14T11:30:00Z",
                "2021-03-14T11:45:00Z",
                "2021-03-14T12:00:00Z",
                "2021-03-14T12:15:00Z",
            ],
            "groups": [
                {
                    "by": {},
                    "totals": {"sum(times_seen)": 6},
                    "series": {"sum(times_seen)": [6, 0, 0, 0, 0]},
                }
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_profile_duration_filter(self):
        """Test that profile_duration data is correctly filtered and returned"""
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["profile_duration"],
            },
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {},
                    "series": {"sum(quantity)": [0, 3000]},  # 3 outcomes * 1000ms = 3000
                    "totals": {"sum(quantity)": 3000},
                }
            ],
        }

    @freeze_time("2021-03-14T12:27:28.303Z")
    def test_profile_duration_groupby(self):
        """Test that profile_duration data is correctly grouped"""
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "groupBy": ["category"],
                "category": ["profile_duration"],
            },
            status_code=200,
        )

        assert result_sorted(response.data) == {
            "start": "2021-03-13T00:00:00Z",
            "end": "2021-03-15T00:00:00Z",
            "intervals": ["2021-03-13T00:00:00Z", "2021-03-14T00:00:00Z"],
            "groups": [
                {
                    "by": {"category": "profile_duration"},
                    "series": {"sum(quantity)": [0, 3000]},
                    "totals": {"sum(quantity)": 3000},
                }
            ],
        }


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    if "groups" in result:
        result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


# TEST invalid parameter
