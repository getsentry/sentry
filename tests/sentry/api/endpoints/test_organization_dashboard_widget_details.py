from unittest import mock

import pytest
from django.urls import reverse

from sentry import options
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.testutils.cases import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]
ONDEMAND_FEATURES = [
    "organizations:on-demand-metrics-extraction",
    "organizations:on-demand-metrics-extraction-widgets",
    "organizations:on-demand-metrics-extraction-experimental",
    "organizations:on-demand-metrics-prefill",
]


class OrganizationDashboardWidgetDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def url(self):
        return reverse(
            "sentry-api-0-organization-dashboard-widget-details",
            kwargs={"organization_id_or_slug": self.organization.slug},
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

    def test_big_number_widget_with_selected_equation(self):
        data = {
            "title": "EPM Big Number",
            "displayType": "big_number",
            "queries": [
                {
                    "name": "",
                    "fields": ["epm()"],
                    "columns": [],
                    "aggregates": ["epm()", "count()", "equation|epm()*count()"],
                    "conditions": "",
                    "orderby": "",
                    "selectedAggregate": "1",
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
                "timestamp": before_now(minutes=2).isoformat(),
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

    @pytest.mark.skip("Flaky - utc bug")
    def test_timestamp_query_with_timezone(self):
        data = {
            "title": "Timestamp filter",
            "displayType": "table",
            "widgetType": "discover",
            "queries": [
                {
                    "name": "timestamp filter",
                    "conditions": f"timestamp.to_day:<{before_now(hours=1)}",
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
        # We cannot query the Discover entity without a project being defined for the org
        self.create_project()
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

    def test_dashboard_widget_ondemand_one_field(self):
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
                    "columns": ["sometag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }
        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        # There's no data, so `sometag` should be low cardinality
        assert len(response.data) == 1
        assert response.data == {"warnings": {"columns": {}, "queries": [None]}}
        # We cache so we shouldn't call query cardinality again if all the keys are the same
        with self.feature(ONDEMAND_FEATURES):
            with mock.patch(
                "sentry.tasks.on_demand_metrics._query_cardinality", return_value=([], [])
            ) as mock_query:
                self.client.post(f"{self.url()}?environment=mock_env", data)
                assert len(mock_query.mock_calls) == 0

        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "columns": ["someothertag", "sometag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }
        # If there's a new key we should only query that key
        with self.feature(ONDEMAND_FEATURES):
            with mock.patch(
                "sentry.tasks.on_demand_metrics._query_cardinality", return_value=([], [])
            ) as mock_query:
                self.client.post(f"{self.url()}?environment=mock_env", data)
                mock_query.assert_called_once()
                assert mock_query.mock_calls[0] == mock.call(["someothertag"], mock.ANY, "1h")

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_dashboard_widget_ondemand_multiple_fields(self, mock_query):
        mock_query.return_value = {
            "data": [{"count_unique(sometag)": 1_000_000, "count_unique(someothertag)": 1}]
        }, [
            "sometag",
            "someothertag",
        ]
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
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }

        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        warnings = response.data["warnings"]
        assert "columns" in warnings
        assert len(warnings["columns"]) == 1
        assert warnings["columns"]["sometag"] == "disabled:high-cardinality"

        # We queried sometag already, we shouldn't call the cardinality query again
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "columns": ["sometag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }
        with self.feature(ONDEMAND_FEATURES):
            self.client.post(f"{self.url()}?environment=mock_env", data)
        assert len(mock_query.mock_calls) == 1

    @mock.patch("sentry.relay.config.metric_extraction.get_max_widget_specs", return_value=1)
    def test_dashboard_hits_max_specs(self, mock_max):
        # create another widget so we already have a widget spec
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            limit=5,
            detail={"layout": {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        self.widget_1_data_1 = DashboardWidgetQuery.objects.create(
            widget=self.widget_1,
            name=self.anon_users_query["name"],
            fields=self.anon_users_query["fields"],
            columns=self.anon_users_query["columns"],
            aggregates=self.anon_users_query["aggregates"],
            field_aliases=self.anon_users_query["fieldAliases"],
            conditions=self.anon_users_query["conditions"],
            order=0,
        )
        DashboardWidgetQueryOnDemand.objects.create(
            dashboard_widget_query=self.widget_1_data_1,
            spec_version=OnDemandMetricSpecVersioning.get_query_spec_version(
                self.organization
            ).version,
            spec_hashes=["abcd"],
            extraction_state="enabled:manual",
        )

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
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }

        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        warnings = response.data["warnings"]
        assert warnings["queries"][0] == "disabled:spec-limit"

        mock_max.return_value = 100
        # With higher max, we shouldn't hit the spec-limit
        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        assert response.data == {"warnings": {"columns": {}, "queries": [None]}}

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_warnings_show_up_with_error(self, mock_query):
        mock_query.return_value = {
            "data": [{"count_unique(sometag)": 1_000_000, "count_unique(someothertag)": 1}]
        }, [
            "sometag",
            "someothertag",
        ]
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
                    "conditions": "release.stage: adopted",
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }

        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 400, response.data
        warnings = response.data["warnings"]
        assert "queries" in warnings
        assert len(warnings["queries"]) == 1
        assert warnings["queries"][0] == "disabled:not-applicable"
        assert response.data["queries"][0]["conditions"], response.data

    @mock.patch("sentry.relay.config.metric_extraction.get_max_widget_specs", return_value=1)
    def test_first_query_without_ondemand_but_second_with(self, mock_max):
        # create another widget so we already have a widget spec
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            limit=5,
            detail={"layout": {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        self.widget_1_data_1 = DashboardWidgetQuery.objects.create(
            widget=self.widget_1,
            name=self.anon_users_query["name"],
            fields=self.anon_users_query["fields"],
            columns=self.anon_users_query["columns"],
            aggregates=self.anon_users_query["aggregates"],
            field_aliases=self.anon_users_query["fieldAliases"],
            conditions=self.anon_users_query["conditions"],
            order=0,
        )
        DashboardWidgetQueryOnDemand.objects.create(
            dashboard_widget_query=self.widget_1_data_1,
            spec_version=OnDemandMetricSpecVersioning.get_query_spec_version(
                self.organization
            ).version,
            spec_hashes=["abcd"],
            extraction_state="enabled:manual",
        )

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
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "aggregates": ["count()"],
                    "onDemandExtractionDisabled": True,
                },
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "aggregates": ["count()"],
                },
            ],
        }

        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        warnings = response.data["warnings"]
        assert len(warnings["queries"]) == 2
        assert warnings["queries"][0] is None
        assert warnings["queries"][1] == "disabled:spec-limit"

    def test_on_demand_doesnt_query(self):
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
                    "columns": ["sometag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }
        with mock.patch("sentry.tasks.on_demand_metrics._query_cardinality") as mock_query:
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        # There's no data, so `sometag` should be low cardinality

        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "columns": ["sometag"],
                    "fields": [],
                    "aggregates": ["count()"],
                    "onDemandExtractionDisabled": True,
                }
            ],
        }
        # With extraction disabled we shouldn't check
        with mock.patch("sentry.tasks.on_demand_metrics._query_cardinality") as mock_query:
            self.client.post(f"{self.url()}?environment=mock_env", data)
            assert len(mock_query.mock_calls) == 0

    @mock.patch("sentry.relay.config.metric_extraction.get_max_widget_specs", return_value=1)
    def test_ondemand_disabled_adds_queries(self, mock_max):
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
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "aggregates": ["count()"],
                    "onDemandExtractionDisabled": True,
                },
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "columns": ["sometag", "someothertag"],
                    "fields": [],
                    "onDemandExtractionDisabled": True,
                },
            ],
        }

        with self.feature(ONDEMAND_FEATURES):
            response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        warnings = response.data["warnings"]
        assert len(warnings["queries"]) == 2
        assert response.data == {"warnings": {"columns": {}, "queries": [None, None]}}

    def test_widget_cardinality(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "transaction": "/example",
                "message": "how to make fast",
                "timestamp": before_now(minutes=2).isoformat(),
                "tags": {"sometag": "foo"},
            },
            project_id=self.project.id,
        )
        project = self.create_project()
        self.create_environment(project=project, name="mock_env")
        data = {
            "title": "Test Query",
            "displayType": "table",
            "widgetType": "discover",
            "limit": 5,
            "queries": [
                {
                    "name": "",
                    "conditions": "release.stage:adopted",
                    "columns": ["sometag"],
                    "fields": [],
                    "aggregates": ["count()"],
                }
            ],
        }

        option_get = options.get

        def mock_options(option_name):
            if option_name == "on_demand.max_widget_cardinality.on_query_count":
                return 0
            else:
                return option_get(option_name)

        with mock.patch("sentry.options.get", side_effect=mock_options):
            with self.feature(ONDEMAND_FEATURES):
                response = self.client.post(f"{self.url()}?environment=mock_env", data)
        assert response.status_code == 200, response.data
        warnings = response.data["warnings"]
        assert "columns" in warnings
        assert len(warnings["columns"]) == 1
        assert warnings["columns"]["sometag"] == "disabled:high-cardinality"

    def test_widget_type_spans(self):
        data = {
            "title": "Test Query",
            "widgetType": "spans",
            "displayType": "table",
            "queries": [
                {
                    "name": "",
                    "conditions": "",
                    "fields": ["span.op", "count()"],
                    "columns": ["span.op"],
                    "aggregates": ["count()"],
                },
            ],
        }

        response = self.do_request(
            "post",
            self.url(),
            data=data,
        )
        assert response.status_code == 200, response.data
