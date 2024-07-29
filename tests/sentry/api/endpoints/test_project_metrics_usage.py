from sentry.testutils.cases import APITestCase


class TestOrganizationMetricsUsage(APITestCase):
    endpoint = "sentry-api-0-project-metrics-usage"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        config = {
            "spanAttribute": "count_clicks",
            "aggregates": ["count", "p50", "p75", "p95", "p99"],
            "unit": "none",
            "tags": ["tag1", "tag2"],
            "conditions": [
                {"value": "foo:bar"},
            ],
        }

        self.span_attribute_extraction_rule = self.create_span_attribute_extraction_config(
            dictionary=config, user_id=self.user.id, project=self.project
        )
        self.condition1 = self.span_attribute_extraction_rule.conditions.first()
        condition_mris = self.condition1.generate_mris()
        self.mri1 = condition_mris[0]
        self.mri2 = condition_mris[1]
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
            self.organization.slug,
            self.project.slug,
            self.span_attribute_extraction_rule.span_attribute,
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
            self.organization.slug,
            self.project.slug,
            self.span_attribute_extraction_rule.span_attribute,
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
            self.organization.slug,
            self.project.slug,
            self.span_attribute_extraction_rule.span_attribute,
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

    def test_get_connected_dashboard_widgets_and_alerts_to_metric_with_non_existent_span_attribute(
        self,
    ):
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "non_existent_span_attribute",
        )

    def test_access_to_a_span_attribute_from_different_project(self):
        new_project = self.create_project(organization=self.organization)
        response = self.get_response(
            self.organization.slug,
            new_project.slug,
            self.span_attribute_extraction_rule.span_attribute,
        )

        assert response.status_code == 404  # attribute doesn't exist in the project

    def test_permission_as_unauthenticated_user(self):
        new_organization = self.create_organization()
        new_project = self.create_project(organization=new_organization)
        new_user = self.create_user()

        self.login_as(user=new_user)

        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            self.span_attribute_extraction_rule.span_attribute,
        )

        self.get_error_response(
            self.organization.slug,
            new_project.slug,
            self.span_attribute_extraction_rule.span_attribute,
        )

        self.get_error_response(
            new_organization.slug,
            self.project.slug,
            self.span_attribute_extraction_rule.span_attribute,
        )
