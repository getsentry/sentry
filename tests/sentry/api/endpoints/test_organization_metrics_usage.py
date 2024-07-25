from sentry.testutils.cases import APITestCase


class TestOrganizationMetricsUsage(APITestCase):
    endpoint = "sentry-api-0-organization-metrics-usage"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        self.mri1 = "c:custom/foo1@none"
        self.mri2 = "c:custom/bar2@none"
        self.alert_rule1 = self.create_alert_rule(
            organization=self.organization, aggregate=self.mri1
        )
        self.alert_rule2 = self.create_alert_rule(
            organization=self.organization, aggregate=self.mri2
        )
        dashboard = self.create_dashboard(organization=self.organization)
        self.dashboard_widget1 = self.create_dashboard_widget(dashboard=dashboard, order=0)
        self.query1 = self.create_dashboard_widget_query(
            widget=self.dashboard_widget1, aggregates=[self.mri1], order=1
        )
        self.dashboard_widget2 = self.create_dashboard_widget(dashboard=dashboard, order=2)
        self.query1 = self.create_dashboard_widget_query(
            widget=self.dashboard_widget2, aggregates=[self.mri2], order=2
        )

    def _get_response_data_without_queries(self, response):
        """Deletes 'queries' field from widgets in the response data"""

        response_data_without_query = response.data.copy()
        if "widgets" not in response_data_without_query:
            # No widgets in the response, no need to delete queries
            return response_data_without_query
        for widget in response_data_without_query["widgets"]:
            del widget["queries"]
        return response_data_without_query

    def test_get_connected_dashboard_widgets_and_alerts_to_metric(self):
        response = self.get_success_response(
            self.organization.slug, metricMRIs=[self.mri1, self.mri2]
        )

        # queries use a different serializer, there is no need to test that here
        response_data_without_query = self._get_response_data_without_queries(response)
        assert response_data_without_query == {
            "alerts": [
                {
                    "metricMRI": self.mri1,
                    "alertRuleId": self.alert_rule1.id,
                    "name": self.alert_rule1.name,
                },
                {
                    "metricMRI": self.mri2,
                    "alertRuleId": self.alert_rule2.id,
                    "name": self.alert_rule2.name,
                },
            ],
            "widgets": [
                {
                    "metricMRI": self.mri1,
                    "widgetId": self.dashboard_widget1.id,
                    "dashboardId": self.dashboard_widget1.dashboard_id,
                    "title": self.dashboard_widget1.title,
                },
                {
                    "metricMRI": self.mri2,
                    "widgetId": self.dashboard_widget2.id,
                    "dashboardId": self.dashboard_widget2.dashboard_id,
                    "title": self.dashboard_widget2.title,
                },
            ],
        }

    def test_get_connected_dashboard_widgets_and_alerts_to_metric_with_no_widgets(self):
        self.dashboard_widget1.delete()
        self.dashboard_widget2.delete()
        response = self.get_success_response(
            self.organization.slug, metricMRIs=[self.mri1, self.mri2]
        )

        assert response.data == {
            "alerts": [
                {
                    "metricMRI": self.mri1,
                    "alertRuleId": self.alert_rule1.id,
                    "name": self.alert_rule1.name,
                },
                {
                    "metricMRI": self.mri2,
                    "alertRuleId": self.alert_rule2.id,
                    "name": self.alert_rule2.name,
                },
            ],
            "widgets": [],
        }

    def test_get_connected_dashboard_widgets_and_alerts_to_metric_with_no_alerts(self):
        self.alert_rule1.delete()
        self.alert_rule2.delete()
        response = self.get_success_response(
            self.organization.slug, metricMRIs=[self.mri1, self.mri2]
        )

        # queries use a different serializer, there is no need to test that here
        response_data_without_query = self._get_response_data_without_queries(response)
        assert response_data_without_query == {
            "alerts": [],
            "widgets": [
                {
                    "metricMRI": self.mri1,
                    "widgetId": self.dashboard_widget1.id,
                    "dashboardId": self.dashboard_widget1.dashboard_id,
                    "title": self.dashboard_widget1.title,
                },
                {
                    "metricMRI": self.mri2,
                    "widgetId": self.dashboard_widget2.id,
                    "dashboardId": self.dashboard_widget2.dashboard_id,
                    "title": self.dashboard_widget2.title,
                },
            ],
        }

    def test_get_connected_dashboard_widgets_and_alerts_to_metric_with_no_metric_mris(self):
        response = self.get_error_response(self.organization.slug, metricMRIs=[])
        assert response.data == {"detail": "At least one metric_mri is required"}

    def test_get_connected_dashboard_widgets_and_alerts_to_metric_with_non_existent_metric_mris(
        self,
    ):
        response = self.get_success_response(self.organization.slug, metricMRIs=["non_existent"])
        assert response.data == {
            "alerts": [],
            "widgets": [],
        }

    def test_user_from_different_org_cannot_access(self):
        new_organization = self.create_organization()
        new_user = self.create_user()
        self.create_member(user=new_user, organization=new_organization)
        self.login_as(user=new_user)
        response = self.get_success_response(
            new_organization.slug, metricMRIs=[self.mri1, self.mri2]
        )

        assert response.data == {
            "alerts": [],
            "widgets": [],
        }  # No alerts or widgets for this organization
