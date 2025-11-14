from typing import int
from datetime import datetime, timedelta, timezone

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.constants import DataCategory
from sentry.testutils.cases import OutcomesSnubaTest
from sentry.utils.outcomes import Outcome


class OrganizationStatsDocs(APIDocsTestCase, OutcomesSnubaTest):
    def setUp(self) -> None:
        super().setUp()
        self.now = datetime(2021, 3, 14, 12, 27, 28, tzinfo=timezone.utc)
        self.login_as(user=self.user)
        self.store_outcomes(
            {
                "org_id": self.organization.id,
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
                "org_id": self.organization.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.PROFILE_DURATION,
                "quantity": 1000,  # Duration in milliseconds
            },
            3,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.PROFILE_DURATION_UI,
                "quantity": 2000,  # Duration in milliseconds
            },
            2,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "none",
                "category": DataCategory.PROFILE_CHUNK,
                "quantity": 420,
            },
            1,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": self.now - timedelta(hours=1),
                "project_id": self.project.id,
                "outcome": Outcome.RATE_LIMITED,
                "reason": "none",
                "category": DataCategory.PROFILE_CHUNK_UI,
                "quantity": 69,
            },
            1,
        )

        self.url = reverse(
            "sentry-api-0-organization-stats-v2",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get(self) -> None:
        """
        Test that the organization stats endpoint returns valid schema.
        This test verifies that the endpoint correctly handles basic queries with interval, field and groupBy parameters.
        """
        query = {"interval": "1d", "field": "sum(quantity)", "groupBy": "category"}
        response = self.client.get(self.url, query, format="json")
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_continuous_profiling_categories(self) -> None:
        for category in [
            "profile_duration",
            "profile_duration_ui",
            "profile_chunk",
            "profile_chunk_ui",
        ]:
            query = {
                "interval": "1d",
                "field": "sum(quantity)",
                "groupBy": "category",
                "category": category,
            }
            response = self.client.get(self.url, query, format="json")
            request = RequestFactory().get(self.url)

            self.validate_schema(request, response)
