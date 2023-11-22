from django.urls import reverse

from sentry.testutils.cases import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
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
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
                },
                {
                    "name": "errors",
                    "conditions": "(level:error OR title:*Error*) !release:latest",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
                    "orderby": "count()",
                },
            ],
            "description": "Valid widget description",
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
                {
                    "name": "errors",
                    "conditions": "event.type: tag:foo",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
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
        assert response.data["queries"][0]["conditions"], response.data

    def test_blank_descriptions_are_allowed(self):
        data = {
            "title": "Errors over time",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
                },
                {
                    "name": "errors",
                    "conditions": "(level:error OR title:*Error*) !release:latest",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
                    "orderby": "count()",
                },
            ],
            "description": "Valid widget description",
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

        data["description"] = ""

        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_invalid_widget_permissions(self):
        self.create_user_member_role()
        self.test_invalid_query_conditions()

    def test_invalid_query_fields(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["p95(user)"],
                    "columns": [],
                    "aggregates": ["p95(user)"],
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
        assert response.data["queries"][0]["fields"], response.data

    def test_invalid_display_type(self):
        data = {
            "title": "Invalid query",
            "displayType": "cats",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
                }
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
                    "columns": [],
                    "aggregates": ["equation|count()"],
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
                    "columns": [],
                    "aggregates": ["equation|count() * 2"],
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_valid_orderby_equation_alias_line_widget(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["equation|count() * 2"],
                    "columns": [],
                    "aggregates": ["equation|count() * 2"],
                    "orderby": "equation[0]",
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_invalid_orderby_equation_alias_line_widget(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["equation|count() * 2"],
                    "columns": [],
                    "aggregates": ["equation|count() * 2"],
                    "orderby": "equation[999999]",
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

    def test_missing_equation_for_orderby_equation_alias(self):
        data = {
            "title": "Invalid query",
            "displayType": "line",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": [""],
                    "columns": [],
                    "aggregates": [],
                    "orderby": "equation[0]",
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

    def test_invalid_equation_table_widget(self):
        data = {
            "title": "Invalid query",
            "displayType": "table",
            "queries": [
                {
                    "name": "errors",
                    "conditions": "event.type:error",
                    "fields": ["equation|count() * 2"],
                    "columns": [],
                    "aggregates": ["equation|count() * 2"],
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
            "queries": [
                {
                    "name": "",
                    "fields": ["epm()"],
                    "columns": [],
                    "aggregates": ["epm()"],
                    "conditions": "",
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
                    "columns": [],
                    "aggregates": ["epm()"],
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
        assert event.group is not None

        data = {
            "title": "EPM Big Number",
            "displayType": "big_number",
            "queries": [
                {
                    "name": "",
                    "fields": ["epm()"],
                    "columns": [],
                    "aggregates": ["epm()"],
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
            "queries": [
                {
                    "name": "unresolved",
                    "conditions": "is:unresolved",
                    "fields": [],
                    "columns": [],
                    "aggregates": [],
                }
            ],
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
            "queries": [
                {
                    "name": "unresolved",
                    "conditions": "is:())",
                    "fields": [],
                    "columns": [],
                    "aggregates": [],
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
        assert response.data["queries"][0]["conditions"], response.data

    def test_invalid_issue_query_conditions_in_discover_widget(self):
        data = {
            "title": "Unresolved Issues",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [
                {
                    "name": "unresolved",
                    "conditions": "is:unresolved",
                    "fields": [],
                    "columns": [],
                    "aggregates": [],
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
        assert response.data["queries"][0]["conditions"], response.data

    def test_timestamp_query_with_timezone(self):
        data = {
            "title": "Timestamp filter",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [
                {
                    "name": "timestamp filter",
                    "conditions": f"timestamp.to_day:<{iso_format(before_now(hours=1))}",
                    "fields": [],
                }
            ],
            "statsPeriod": "24h",
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_raw_equation_in_orderby_is_valid(self):
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": [],
                    "columns": [],
                    "aggregates": [],
                    "orderby": "equation|count() * 2",
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_raw_desc_equation_in_orderby_is_valid(self):
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": [],
                    "columns": [],
                    "aggregates": [],
                    "orderby": "-equation|count() * 2",
                }
            ],
            "statsPeriod": "24h",
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_invalid_raw_equation_in_orderby_throws_error(self):
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": [],
                    "columns": [],
                    "aggregates": [],
                    "orderby": "-equation|thisIsNotARealEquation() * 42",
                }
            ],
            "statsPeriod": "24h",
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 400, response.data
        assert "queries" in response.data, response.data

    def test_save_with_orderby_from_columns(self):
        data = {
            "title": "Test Query",
            "displayType": "line",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": ["count()"],
                    "columns": ["project"],
                    "aggregates": ["count()"],
                    "orderby": "-project",
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_save_with_orderby_not_from_columns_or_aggregates(self):
        data = {
            "title": "Test Query",
            "displayType": "line",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": [],
                    "columns": ["project"],
                    "aggregates": ["count()"],
                    "orderby": "-epm()",
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_save_with_invalid_orderby_not_from_columns_or_aggregates(self):
        data = {
            "title": "Test Query",
            "displayType": "line",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": [],
                    "columns": ["project"],
                    "aggregates": ["count()"],
                    "orderby": "-eeeeeeeepm()",
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

    def test_save_with_total_count(self):
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": [],
                    "columns": ["total.count"],
                    "aggregates": ["count()"],
                }
            ],
        }
        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data

    def test_accepts_environment_for_filters_that_require_single_env(self):
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "fields": [],
                    "columns": [],
                    "aggregates": ["count()"],
                }
            ],
        }
        response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
