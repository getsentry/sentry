from __future__ import annotations

import functools
from datetime import UTC, datetime, timedelta
from typing import int, Any

from django.urls import reverse

from sentry.constants import DataCategory
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import freeze_time, isoformat_z
from sentry.utils.dates import floor_to_utc_day
from sentry.utils.outcomes import Outcome


class OrganizationStatsSummaryTest(APITestCase, OutcomesSnubaTest):
    _now = datetime.now(UTC).replace(hour=12, minute=27, second=28, microsecond=0)

    def setUp(self) -> None:
        super().setUp()

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
                "timestamp": self._now - timedelta(hours=1),
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
                "timestamp": self._now - timedelta(hours=1),
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
                "timestamp": self._now - timedelta(hours=1),
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
                "timestamp": self._now - timedelta(hours=1),
                "project_id": self.project2.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "smart_rate_limit",
                "category": DataCategory.TRANSACTION,
                "quantity": 1,
            }
        )

    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-stats-summary",
            kwargs={"organization_id_or_slug": (org or self.organization).slug},
        )
        return self.client.get(url, query, format="json")

    def test_empty_request(self) -> None:
        response = self.do_request({})
        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'At least one "field" is required.'}

    def test_inaccessible_project(self) -> None:
        response = self.do_request({"project": [self.project3.id]})

        assert response.status_code == 403, response.content
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_no_projects_available(self) -> None:
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
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "No projects available",
        }

    def test_unknown_field(self) -> None:
        response = self.do_request(
            {
                "field": ["summ(qarntenty)"],
                "statsPeriod": "1d",
                "interval": "1d",
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": 'Invalid field: "summ(qarntenty)"',
        }

    def test_no_end_param(self) -> None:
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "interval": "1d",
                "start": floor_to_utc_day(self._now).isoformat(),
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "start and end are both required"}

    @freeze_time(_now)
    def test_future_request(self) -> None:
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "interval": "1h",
                "category": ["error"],
                "start": self._now.replace(hour=15, minute=30, second=0).isoformat(),
                "end": self._now.replace(hour=16, minute=30, second=0).isoformat(),
            }
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "start": isoformat_z(self._now.replace(hour=12, minute=0, second=0)),
            "end": isoformat_z(self._now.replace(hour=17, minute=0, second=0)),
            "projects": [],
        }

    def test_unknown_category(self) -> None:
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "statsPeriod": "1d",
                "interval": "1d",
                "category": "scoobydoo",
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": 'Invalid category: "scoobydoo"',
        }

    def test_unknown_outcome(self) -> None:
        response = self.do_request(
            {
                "field": ["sum(quantity)"],
                "statsPeriod": "1d",
                "interval": "1d",
                "category": "error",
                "outcome": "scoobydoo",
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": 'Invalid outcome: "scoobydoo"',
        }

    def test_resolution_invalid(self) -> None:
        self.login_as(user=self.user)
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "bad_interval",
            }
        )

        assert response.status_code == 400, response.content

    @freeze_time(_now)
    def test_attachment_filter_only(self) -> None:
        response = self.do_request(
            {
                "project": [-1],
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "attachment"],
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": "if filtering by attachment no other category may be present"
        }

    @freeze_time(_now)
    def test_user_all_accessible(self) -> None:
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "category": ["error", "transaction"],
            },
            user=self.user2,
        )

        assert response.status_code == 403
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

        assert response.status_code == 200
        assert response.data == {
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=1)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [],
        }

    @freeze_time(_now)
    def test_no_project_access(self) -> None:
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
        )

        assert response.status_code == 403, response.content
        assert response.data == {"detail": "You do not have permission to perform this action."}

    @freeze_time(_now)
    def test_open_membership_semantics(self) -> None:
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
        )

        assert response.status_code == 200
        assert response.data == {
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=1)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "error",
                            "outcomes": {
                                "abuse": 0,
                                "accepted": 6,
                                "cardinality_limited": 0,
                                "client_discard": 0,
                                "filtered": 0,
                                "invalid": 0,
                                "rate_limited": 0,
                            },
                            "totals": {"dropped": 0, "sum(quantity)": 6},
                        }
                    ],
                },
                {
                    "id": self.project2.id,
                    "slug": self.project2.slug,
                    "stats": [
                        {
                            "category": "transaction",
                            "outcomes": {
                                "abuse": 0,
                                "accepted": 0,
                                "cardinality_limited": 0,
                                "client_discard": 0,
                                "filtered": 0,
                                "invalid": 0,
                                "rate_limited": 1,
                            },
                            "totals": {"dropped": 1, "sum(quantity)": 1},
                        }
                    ],
                },
            ],
        }

    @freeze_time(_now)
    def test_org_simple(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(quantity)"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=2)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "attachment",
                            "outcomes": {
                                "accepted": 0,
                                "filtered": 0,
                                "rate_limited": 1024,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 1024, "sum(quantity)": 1024},
                        },
                        {
                            "category": "error",
                            "outcomes": {
                                "accepted": 6,
                                "filtered": 0,
                                "rate_limited": 0,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 0, "sum(quantity)": 6},
                        },
                    ],
                },
                {
                    "id": self.project2.id,
                    "slug": self.project2.slug,
                    "stats": [
                        {
                            "category": "transaction",
                            "outcomes": {
                                "accepted": 0,
                                "filtered": 0,
                                "rate_limited": 1,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 1, "sum(quantity)": 1},
                        }
                    ],
                },
            ],
        }

    @freeze_time(_now)
    def test_org_multiple_fields(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "2d",
                "interval": "1d",
                "field": ["sum(quantity)", "sum(times_seen)"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=2)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "attachment",
                            "outcomes": {
                                "accepted": 0,
                                "filtered": 0,
                                "rate_limited": 1025,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {
                                "dropped": 1025,
                                "sum(quantity)": 1024,
                                "sum(times_seen)": 1,
                            },
                        },
                        {
                            "category": "error",
                            "outcomes": {
                                "accepted": 12,
                                "filtered": 0,
                                "rate_limited": 0,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 0, "sum(quantity)": 6, "sum(times_seen)": 6},
                        },
                    ],
                },
                {
                    "id": self.project2.id,
                    "slug": self.project2.slug,
                    "stats": [
                        {
                            "category": "transaction",
                            "outcomes": {
                                "accepted": 0,
                                "filtered": 0,
                                "rate_limited": 2,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 2, "sum(quantity)": 1, "sum(times_seen)": 1},
                        }
                    ],
                },
            ],
        }

    @freeze_time(_now)
    def test_org_project_totals_per_project(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
        )
        response_per_group = make_request(
            {
                "statsPeriod": "1d",
                "interval": "1h",
                "field": ["sum(times_seen)"],
                "category": ["error", "transaction"],
            }
        )

        assert response_per_group.status_code == 200, response_per_group.content
        assert response_per_group.data == {
            "start": isoformat_z(
                (self._now - timedelta(days=1)).replace(hour=12, minute=0, second=0)
            ),
            "end": isoformat_z(self._now.replace(hour=13, minute=0, second=0)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "error",
                            "outcomes": {
                                "abuse": 0,
                                "accepted": 6,
                                "cardinality_limited": 0,
                                "client_discard": 0,
                                "filtered": 0,
                                "invalid": 0,
                                "rate_limited": 0,
                            },
                            "totals": {"dropped": 0, "sum(times_seen)": 6},
                        }
                    ],
                },
                {
                    "id": self.project2.id,
                    "slug": self.project2.slug,
                    "stats": [
                        {
                            "category": "transaction",
                            "outcomes": {
                                "abuse": 0,
                                "accepted": 0,
                                "cardinality_limited": 0,
                                "client_discard": 0,
                                "filtered": 0,
                                "invalid": 0,
                                "rate_limited": 1,
                            },
                            "totals": {"dropped": 1, "sum(times_seen)": 1},
                        }
                    ],
                },
            ],
        }

    @freeze_time(_now)
    def test_project_filter(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
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
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=1)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "error",
                            "outcomes": {
                                "abuse": 0,
                                "accepted": 6,
                                "cardinality_limited": 0,
                                "client_discard": 0,
                                "filtered": 0,
                                "invalid": 0,
                                "rate_limited": 0,
                            },
                            "totals": {"dropped": 0, "sum(quantity)": 6},
                        },
                    ],
                },
            ],
        }

    @freeze_time(_now)
    def test_reason_filter(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(times_seen)"],
                "reason": ["spike_protection"],
                "groupBy": ["category"],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=1)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "attachment",
                            "reason": "spike_protection",
                            "outcomes": {
                                "accepted": 0,
                                "filtered": 0,
                                "rate_limited": 1,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 1, "sum(times_seen)": 1},
                        }
                    ],
                },
                {
                    "id": self.project2.id,
                    "slug": self.project2.slug,
                    "stats": [
                        {
                            "category": "transaction",
                            "reason": "spike_protection",
                            "outcomes": {
                                "accepted": 0,
                                "filtered": 0,
                                "rate_limited": 1,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 1, "sum(times_seen)": 1},
                        }
                    ],
                },
            ],
        }

    @freeze_time(_now)
    def test_outcome_filter(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
        )
        response = make_request(
            {
                "statsPeriod": "1d",
                "interval": "1d",
                "field": ["sum(quantity)"],
                "outcome": "accepted",
                "category": ["error", "transaction"],
            }
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=1)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "error",
                            "outcomes": {
                                "accepted": 6,
                            },
                            "totals": {"sum(quantity)": 6},
                        }
                    ],
                }
            ],
        }

    @freeze_time(_now)
    def test_category_filter(self) -> None:
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]),
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
            "start": isoformat_z(floor_to_utc_day(self._now) - timedelta(days=1)),
            "end": isoformat_z(floor_to_utc_day(self._now) + timedelta(days=1)),
            "projects": [
                {
                    "id": self.project.id,
                    "slug": self.project.slug,
                    "stats": [
                        {
                            "category": "error",
                            "outcomes": {
                                "accepted": 6,
                                "filtered": 0,
                                "rate_limited": 0,
                                "invalid": 0,
                                "abuse": 0,
                                "client_discard": 0,
                                "cardinality_limited": 0,
                            },
                            "totals": {"dropped": 0, "sum(quantity)": 6},
                        }
                    ],
                }
            ],
        }

    def test_download(self) -> None:
        req: dict[str, Any] = {
            "statsPeriod": "2d",
            "interval": "1d",
            "field": ["sum(quantity)", "sum(times_seen)"],
            "download": True,
        }
        response = self.client.get(
            reverse("sentry-api-0-organization-stats-summary", args=[self.org.slug]), req
        )

        assert response.headers["Content-Type"] == "text/csv"
        assert response.headers["Content-Disposition"] == 'attachment; filename="stats_summary.csv"'
        assert response.status_code == 200
