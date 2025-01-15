from __future__ import annotations

from django.urls import reverse

from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
)
from sentry.testutils.cases import APITestCase


class SharedWidgetDetailsGetTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dashboard_2 = Dashboard.objects.create(
            title="Dashboard 2", created_by_id=self.user.id, organization=self.organization
        )
        DashboardWidget.objects.create(
            dashboard=self.dashboard_2,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )

    def url(self):
        return reverse(
            "sentry-api-0-shared-widget-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                # hardcoded for now
                "share_id": 2,
                "widget_id": 1,
            },
        )

    def do_request(self, method, url, data=None):
        func = getattr(self.client, method)
        return func(url, data=data)

    def test_get(self):
        # the endpoint should return the events data for the widget (dashboard_2 for now)

        # self.client.logout()  # ??
        response = self.do_request("get", self.url())

        # print(response.data, "7878")
        assert response.status_code == 208, response.content
