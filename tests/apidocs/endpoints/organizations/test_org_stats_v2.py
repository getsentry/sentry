from datetime import datetime, timedelta

import pytz
from django.test.client import RequestFactory
from django.urls import reverse

from sentry.constants import DataCategory
from sentry.testutils.cases import OutcomesSnubaTest
from sentry.utils.outcomes import Outcome
from tests.apidocs.util import APIDocsTestCase


class OrganizationStatsDocs(APIDocsTestCase, OutcomesSnubaTest):
    def setUp(self):
        super().setUp()
        self.now = datetime(2021, 3, 14, 12, 27, 28, tzinfo=pytz.utc)
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

        self.url = reverse(
            "sentry-api-0-organization-stats-v2",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_get(self):
        query = {"interval": "1d", "field": "sum(quantity)", "groupBy": "category"}
        response = self.client.get(self.url, query, format="json")
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
