from django.urls import reverse

from sentry.testutils import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


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

    def test_invalid_equation(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["equation|count()"],
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data

    def test_valid_equation_line_widget(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["equation|count() * 2"],
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_invalid_equation_table_widget(self):
        data = {
            "title": "Invalid query",
            "displayType": "table",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["equation|count() * 2"],
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data

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
        self.user = self.create_user(is_superuser=False)
        self.project = self.create_project(
            name="foo", organization=self.organization, teams=[self.team]
        )
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)
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

    def test_issue_search_condition(self):
        self.user = self.create_user(is_superuser=False)
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group_1"],
            },
            project_id=self.project.id,
        )

        data = {
            "title": "EPM Big Number",
            "displayType": "big_number",
            "queries": [
                {
                    "name": "",
                    "fields": ["epm()"],
                    "conditions": f"issue:{event.group.qualified_short_id}",
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

    def test_valid_issue_query_conditions(self):
        data = {
            "title": "Unresolved Issues",
            "displayType": "table",
            "widgetType": "issue",
            "queries": [{"name": "unresolved", "conditions": "is:unresolved", "fields": []}],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_invalid_issue_query_conditions(self):
        data = {
            "title": "Unresolved Issues",
            "displayType": "table",
            "widgetType": "issue",
            "queries": [{"name": "unresolved", "conditions": "is:())", "fields": []}],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data
        assert response.data["queries"][0]["conditions"], response.data

    def test_invalid_issue_query_conditions_in_discover_widget(self):
        data = {
            "title": "Unresolved Issues",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [{"name": "unresolved", "conditions": "is:unresolved", "fields": []}],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data
        assert response.data["queries"][0]["conditions"], response.data
