from django.core.urlresolvers import reverse
from sentry.testutils import OrganizationDashboardWidgetTestCase


class OrganizationDashboardWidgetDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def url(self):
        return reverse(
            "sentry-api-0-organization-dashboard-widget-details",
            kwargs={"organization_slug": self.organization.slug},
        )

    def test_valid_widget(self):
        data = {
            "title": "Errors over time",
            "displayType": "line",
            "queries": [
                {"name": "errors", "conditions": "event.type:error", "fields": ["count()"]}
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_valid_widget_permissions(self):
        self.create_user_member_role()
        self.test_valid_widget()

    def test_invalid_query_conditions(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {"name": "errors", "conditions": "event.type: tag:foo", "fields": ["count()"]}
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data
        assert response.data["queries"][0]["conditions"], response.data

    def test_invalid_widget_permissions(self):
        self.create_user_member_role()
        self.test_invalid_query_conditions()

    def test_invalid_query_fields(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {"name": "errors", "conditions": "event.type:error", "fields": ["p95(user)"]}
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data
        assert response.data["queries"][0]["fields"], response.data

    def test_invalid_display_type(self):
        data = {
            "title": "Invalid query",
            "displayType": "cats",
            "queries": [
                {"name": "errors", "conditions": "event.type:error", "fields": ["count()"]}
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "displayType" in response.data, response.data

    def test_valid_epm_widget(self):
        data = {
            "title": "EPM Big Number",
            "displayType": "big_number",
            "queries": [{"name": "", "fields": ["epm()"], "conditions": "", "orderby": ""}],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_project_search_condition(self):
        team = self.create_team(organization=self.organization)
        self.project = self.create_project(name="foo", organization=self.organization, teams=[team])

        self.create_member(teams=[team], user=self.user, organization=self.organization)
        data = {
            "title": "EPM Big Number",
            "displayType": "big_number",
            "queries": [
                {
                    "name": "",
                    "fields": ["epm()"],
                    "conditions": f"project:{self.project.name}",
                    "orderby": "",
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data
