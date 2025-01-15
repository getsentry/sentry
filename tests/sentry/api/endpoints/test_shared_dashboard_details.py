from __future__ import annotations

from django.urls import reverse

from sentry.models.dashboard import Dashboard
from sentry.testutils.cases import APITestCase


class SharedDashboardDetailsGetTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dashboard_2 = Dashboard.objects.create(
            title="Dashboard 2", created_by_id=self.user.id, organization=self.organization
        )

    def url(self):
        return reverse(
            "sentry-api-0-shared-dashboard-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                # hardcoded for now
                "share_id": 2,
            },
        )

    def do_request(self, method, url, data=None):
        func = getattr(self.client, method)
        return func(url, data=data)

    def test_get(self):
        # the endpoint should return a limited version of dashboard details (dashboard_2 for now)

        self.client.logout()  # ??
        response = self.do_request("get", self.url())

        # print(response.data, "7878")
        assert response.status_code == 208, response.content
