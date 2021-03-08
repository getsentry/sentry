import functools
from django.core.urlresolvers import reverse
from datetime import datetime
from sentry.testutils import APITestCase
from sentry.testutils.cases import OutcomesSnubaTest
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome
from sentry.testutils.helpers.datetime import before_now, timestamp_format


class OrganizationStatsTestV2(APITestCase, OutcomesSnubaTest):
    def setUp(self):
        super().setUp()
        self.now = datetime.now()
        self.start = before_now(seconds=10)

        self.login_as(user=self.user)

        self.org = self.create_organization(owner=self.user, name="foo")

        self.project = self.create_project(
            name="bar", teams=[self.create_team(organization=self.org, members=[self.user])]
        )

        # self.other_project = self.create_project(name="bees", organization=self.org)
        self.other_project = self.create_project(
            name="foo", teams=[self.create_team(organization=self.org, members=[self.user])]
        )

        self.store_outcomes(
            {
                "org_id": self.org.id,
                "timestamp": self.now,
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
                "timestamp": self.now,
                "project_id": self.project.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "usage_exceeded",
                "category": DataCategory.ERROR,
                "quantity": 1,
            }
        )

    def test_org_simple(self):
        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats-v2", args=[self.org.slug])
        )
        response = make_request(
            {
                "start": timestamp_format(self.start),
                "end": timestamp_format(self.now),
                "interval": "1d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["statsErrors"][0]["accepted"] == {"quantity": 1, "times_seen": 1}
        assert response.data["statsErrors"][0]["filtered"] == {"quantity": 0, "times_seen": 0}
        assert response.data["statsErrors"][0]["dropped"]["overQuota"] == {
            "quantity": 1,
            "times_seen": 1,
        }
        assert response.data["statsErrors"][0]["dropped"]["spikeProtection"] == {
            "quantity": 0,
            "times_seen": 0,
        }
        assert response.data["statsErrors"][0]["dropped"]["other"] == {
            "quantity": 0,
            "times_seen": 0,
        }
        assert "time" in response.data["statsErrors"][0]  # TODO: write better test for this

        assert len(response.data["statsErrors"]) == 2  # rollup is 1 day, interval rounds up

    def test_org_group_by_project(self):
        make_request = functools.partial(
            self.client.get,
            reverse("sentry-api-0-organization-stats-project-index", args=[self.org.slug]),
        )
        response = make_request(
            {
                "start": timestamp_format(self.start),
                "end": timestamp_format(self.now),
                "interval": "1d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data[self.project.id]["statsErrors"][0]["accepted"] == {
            "quantity": 1,
            "times_seen": 1,
        }
        assert response.data[self.project.id]["statsErrors"][0]["filtered"] == {
            "quantity": 0,
            "times_seen": 0,
        }
        assert response.data[self.project.id]["statsErrors"][0]["dropped"]["overQuota"] == {
            "quantity": 1,
            "times_seen": 1,
        }
        assert response.data[self.project.id]["statsErrors"][0]["dropped"]["spikeProtection"] == {
            "quantity": 0,
            "times_seen": 0,
        }
        assert response.data[self.project.id]["statsErrors"][0]["dropped"]["other"] == {
            "quantity": 0,
            "times_seen": 0,
        }

        assert self.other_project.id in response.data

    def test_project_org_stats(self):
        make_request = functools.partial(
            self.client.get,
            reverse(
                "sentry-api-0-organization-stats-projects-details",
                args=[self.org.slug, self.project.slug],
            ),
        )
        response = make_request(
            {
                "start": timestamp_format(self.start),
                "end": timestamp_format(self.now),
                "interval": "1d",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["statsErrors"][0]["accepted"] == {"quantity": 1, "times_seen": 1}
        assert response.data["statsErrors"][0]["filtered"] == {"quantity": 0, "times_seen": 0}
        assert response.data["statsErrors"][0]["dropped"]["overQuota"] == {
            "quantity": 1,
            "times_seen": 1,
        }
        assert response.data["statsErrors"][0]["dropped"]["spikeProtection"] == {
            "quantity": 0,
            "times_seen": 0,
        }
        assert response.data["statsErrors"][0]["dropped"]["other"] == {
            "quantity": 0,
            "times_seen": 0,
        }
        assert "time" in response.data["statsErrors"][0]  # TODO: write better test for this
