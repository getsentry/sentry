from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest import mock
from urllib.parse import parse_qs, urlsplit

import pytest
from django.urls import reverse
from django.utils import timezone

from sentry.dashboards.endpoints.organization_dashboards import PrebuiltDashboardId
from sentry.discover.models import DatasetSourcesTypes
from sentry.explore.translation.dashboards_translation import translate_dashboard_widget
from sentry.models.dashboard import (
    Dashboard,
    DashboardFavoriteUser,
    DashboardLastVisited,
    DashboardTombstone,
)
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.models.dashboard_widget import (
    DashboardFieldLink,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.dashboard_widget import DatasetSourcesTypes as DashboardWidgetDatasetSourcesTypes
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.testutils.cases import BaseMetricsTestCase, OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.users.models.user import User

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]


class OrganizationDashboardDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        self.widget_2 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Widget 2",
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
        self.widget_1_data_2 = DashboardWidgetQuery.objects.create(
            widget=self.widget_1,
            name=self.known_users_query["name"],
            fields=self.known_users_query["fields"],
            columns=self.known_users_query["columns"],
            aggregates=self.known_users_query["aggregates"],
            field_aliases=self.known_users_query["fieldAliases"],
            conditions=self.known_users_query["conditions"],
            order=1,
        )
        self.widget_2_data_1 = DashboardWidgetQuery.objects.create(
            widget=self.widget_2,
            name=self.geo_errors_query["name"],
            fields=self.geo_errors_query["fields"],
            columns=self.geo_errors_query["columns"],
            aggregates=self.geo_errors_query["aggregates"],
            conditions=self.geo_errors_query["conditions"],
            field_aliases=self.geo_errors_query["fieldAliases"],
            order=0,
        )

    def url(self, dashboard_id):
        return reverse(
            "sentry-api-0-organization-dashboard-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": dashboard_id,
            },
        )

    def assert_serialized_dashboard(self, data, dashboard):
        assert data["id"] == str(dashboard.id)
        assert data["title"] == dashboard.title
        assert data["createdBy"]["id"] == str(dashboard.created_by_id)


class OrganizationDashboardDetailsGetTest(OrganizationDashboardDetailsTestCase):
    def test_get(self) -> None:
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200, response.content

        self.assert_serialized_dashboard(response.data, self.dashboard)
        assert len(response.data["widgets"]) == 2
        widgets = response.data["widgets"]
        assert "layout" in widgets[0]
        assert "layout" in widgets[1]
        self.assert_serialized_widget(widgets[0], self.widget_1)
        self.assert_serialized_widget(widgets[1], self.widget_2)

        widget_queries = widgets[0]["queries"]
        assert len(widget_queries) == 2
        self.assert_serialized_widget_query(widget_queries[0], self.widget_1_data_1)
        self.assert_serialized_widget_query(widget_queries[1], self.widget_1_data_2)

        assert len(widgets[1]["queries"]) == 1
        self.assert_serialized_widget_query(widgets[1]["queries"][0], self.widget_2_data_1)

    def test_dashboard_does_not_exist(self) -> None:
        response = self.do_request("get", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_get_prebuilt_dashboard(self) -> None:
        # Pre-built dashboards should be accessible
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_prebuilt_dashboard_with_discover_split_feature_flag(self) -> None:
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200, response.data

        for widget in response.data["widgets"]:
            assert widget["widgetType"] in {"issue", "transaction-like", "error-events"}

    def test_get_prebuilt_dashboard_tombstoned(self) -> None:
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        # Pre-built dashboards should be accessible even when tombstoned
        # This is to preserve behavior around bookmarks
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_features_required(self) -> None:
        with self.feature({"organizations:dashboards-basic": False}):
            response = self.do_request("get", self.url("default-overview"))
            assert response.status_code == 404

    def test_dashboard_widget_returns_limit(self) -> None:
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["limit"] is None
        assert response.data["widgets"][1]["limit"] == 5

    def test_dashboard_widget_query_returns_field_aliases(self) -> None:
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["queries"][0]["fieldAliases"][0] == "Count Alias"
        assert response.data["widgets"][1]["queries"][0]["fieldAliases"] == []

    def test_filters_is_empty_dict_in_response_if_not_applicable(self) -> None:
        filters = {"environment": ["alpha"]}
        dashboard = Dashboard.objects.create(
            title="Dashboard With Filters",
            created_by_id=self.user.id,
            organization=self.organization,
            filters=filters,
        )

        response = self.do_request("get", self.url(dashboard.id))
        assert response.data["projects"] == []
        assert response.data["environment"] == filters["environment"]
        assert response.data["filters"] == {}
        assert "period" not in response.data

    def test_dashboard_filters_are_returned_in_response(self) -> None:
        filters = {"environment": ["alpha"], "period": "24hr", "release": ["test-release"]}
        dashboard = Dashboard.objects.create(
            title="Dashboard With Filters",
            created_by_id=self.user.id,
            organization=self.organization,
            filters=filters,
        )
        dashboard.projects.set([Project.objects.create(organization=self.organization)])

        response = self.do_request("get", self.url(dashboard.id))
        assert response.data["projects"] == list(dashboard.projects.values_list("id", flat=True))
        assert response.data["environment"] == filters["environment"]
        assert response.data["period"] == filters["period"]
        assert response.data["filters"]["release"] == filters["release"]

    def test_start_and_end_filters_are_returned_in_response(self) -> None:
        start = (datetime.now() - timedelta(seconds=10)).isoformat()
        end = datetime.now().isoformat()
        filters = {"start": start, "end": end, "utc": False}
        dashboard = Dashboard.objects.create(
            title="Dashboard With Filters",
            created_by_id=self.user.id,
            organization=self.organization,
            filters=filters,
        )
        dashboard.projects.set([Project.objects.create(organization=self.organization)])

        response = self.do_request("get", self.url(dashboard.id))
        assert response.data["start"].replace(tzinfo=None).isoformat() == start
        assert response.data["end"].replace(tzinfo=None).isoformat() == end
        assert not response.data["utc"]

    def test_response_truncates_with_retention(self) -> None:
        start = before_now(days=3)
        end = before_now(days=2)
        expected_adjusted_retention_start = before_now(days=1)
        filters = {"start": start, "end": end}
        dashboard = Dashboard.objects.create(
            title="Dashboard With Filters",
            created_by_id=self.user.id,
            organization=self.organization,
            filters=filters,
        )

        with self.options({"system.event-retention-days": 1}):
            response = self.do_request("get", self.url(dashboard.id))

        assert response.data["expired"]
        assert (
            response.data["start"].replace(second=0, microsecond=0).isoformat()
            == expected_adjusted_retention_start.replace(second=0, microsecond=0).isoformat()
        )

    def test_dashboard_widget_type_returns_split_decision(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Split Widgets",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            title="no split",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        response = self.do_request(
            "get",
            self.url(dashboard.id),
        )
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["widgetType"] == "error-events"
        assert response.data["widgets"][1]["widgetType"] == "transaction-like"
        assert response.data["widgets"][2]["widgetType"] == "discover"

    def test_dashboard_widget_returns_dataset_source(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            dataset_source=DatasetSourcesTypes.INFERRED.value,
        )

        response = self.do_request("get", self.url(dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["datasetSource"] == "inferred"

    def test_dashboard_widget_default_dataset_source_is_unknown(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard Without",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        response = self.do_request("get", self.url(dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["datasetSource"] == "unknown"

    def test_dashboard_widget_query_returns_selected_aggregate(self) -> None:
        widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Big Number Widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=widget,
            fields=["count_unique(issue)", "count()"],
            columns=[],
            aggregates=["count_unique(issue)", "count()"],
            selected_aggregate=1,
            order=0,
        )
        response = self.do_request(
            "get",
            self.url(self.dashboard.id),
        )
        assert response.status_code == 200, response.content

        assert response.data["widgets"][0]["queries"][0]["selectedAggregate"] is None
        assert response.data["widgets"][2]["queries"][0]["selectedAggregate"] == 1

    def test_dashboard_details_data_returns_permissions(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(dashboard=dashboard, is_editable_by_everyone=False)
        response = self.do_request("get", self.url(dashboard.id))

        assert response.status_code == 200, response.content

        assert "permissions" in response.data
        assert not response.data["permissions"]["isEditableByEveryone"]

    def test_dashboard_details_data_returns_Null_permissions(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        response = self.do_request("get", self.url(dashboard.id))

        assert response.status_code == 200, response.content

        assert "permissions" in response.data
        assert not response.data["permissions"]

    def test_dashboard_viewable_with_no_edit_permissions(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=1142,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=1289)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request("get", self.url(dashboard.id))
        assert response.status_code == 200, response.content

    def test_dashboard_details_data_returns_permissions_with_teams(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)
        permissions = DashboardPermissions.objects.create(
            dashboard=dashboard, is_editable_by_everyone=False
        )
        permissions.teams_with_edit_access.set([team1, team2])

        response = self.do_request("get", self.url(dashboard.id))

        assert response.status_code == 200, response.content

        assert "permissions" in response.data
        assert not response.data["permissions"]["isEditableByEveryone"]
        assert "teamsWithEditAccess" in response.data["permissions"]
        assert response.data["permissions"]["teamsWithEditAccess"] == [team1.id, team2.id]

    def test_get_favorited_user_status(self) -> None:
        self.user_1 = self.create_user(email="user1@example.com")
        self.user_2 = self.create_user(email="user2@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.create_member(user=self.user_2, organization=self.organization)

        self.dashboard.favorited_by = [self.user_1.id, self.user_2.id]

        self.login_as(user=self.user_1)
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200
        assert response.data["isFavorited"] is True

    def test_get_not_favorited_user_status(self) -> None:
        self.user_1 = self.create_user(email="user1@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.dashboard.favorited_by = [self.user_1.id, self.user.id]

        user_3 = self.create_user()
        self.create_member(user=user_3, organization=self.organization)
        self.login_as(user=user_3)
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200
        assert response.data["isFavorited"] is False

    def test_get_favorite_status_no_dashboard_edit_access(self) -> None:
        self.user_1 = self.create_user(email="user1@example.com")
        self.user_2 = self.create_user(email="user2@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.create_member(user=self.user_2, organization=self.organization)

        self.dashboard.favorited_by = [self.user_1.id, self.user_2.id, self.user.id]

        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=self.dashboard)
        self.login_as(user=self.user_2)
        dashboard_detail_put_url = reverse(
            "sentry-api-0-organization-dashboard-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
            },
        )
        response = self.do_request(
            "put", dashboard_detail_put_url, data={"title": "New Dashboard 9"}
        )
        # assert user cannot edit dashboard
        assert response.status_code == 403

        # assert user can see if they favorited the dashboard
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200
        assert response.data["isFavorited"] is True

    def test_explore_url_for_transaction_widget(self) -> None:
        with self.feature("organizations:transaction-widget-deprecation-explore-view"):
            dashboard_deprecation = Dashboard.objects.create(
                title="Dashboard With Transaction Widget",
                created_by_id=self.user.id,
                organization=self.organization,
            )
            widget_deprecation = DashboardWidget.objects.create(
                dashboard=dashboard_deprecation,
                title="transaction widget",
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
                interval="1d",
                detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            )

            DashboardWidgetQuery.objects.create(
                widget=widget_deprecation,
                fields=["count()", "transaction"],
                columns=["transaction"],
                aggregates=["count()"],
                conditions="count():>50",
                orderby="-count",
                order=0,
            )
            response = self.do_request("get", self.url(dashboard_deprecation.id))
            assert response.status_code == 200
            explore_url = response.data["widgets"][0]["exploreUrls"][0]
            assert "http://testserver/explore/traces/" in explore_url

            params = dict(parse_qs(urlsplit(response.data["widgets"][0]["exploreUrls"][0]).query))
            assert params["query"] == ["(count(span.duration):>50) AND is_transaction:1"]
            assert params["sort"] == ["-count(span.duration)"]
            assert params["mode"] == ["aggregate"]
            assert params["aggregateField"] == [
                '{"groupBy":"transaction"}',
                '{"yAxes":["count(span.duration)"],"chartType":1}',
            ]

    def test_explore_url_for_table_widget(self) -> None:
        with self.feature("organizations:transaction-widget-deprecation-explore-view"):
            dashboard_deprecation = Dashboard.objects.create(
                title="Dashboard With Transaction Widget",
                created_by_id=self.user.id,
                organization=self.organization,
            )
            widget_deprecation = DashboardWidget.objects.create(
                dashboard=dashboard_deprecation,
                title="table widget",
                display_type=DashboardWidgetDisplayTypes.TABLE,
                widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
                interval="1d",
                detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            )

            DashboardWidgetQuery.objects.create(
                widget=widget_deprecation,
                fields=["id", "title"],
                columns=["id", "title"],
                aggregates=[],
                order=0,
            )

            response = self.do_request("get", self.url(dashboard_deprecation.id))
            assert response.status_code == 200
            explore_url = response.data["widgets"][0]["exploreUrls"][0]
            assert "http://testserver/explore/traces/" in explore_url

            params = dict(parse_qs(urlsplit(response.data["widgets"][0]["exploreUrls"][0]).query))
            assert params["query"] == ["is_transaction:1"]
            assert "sort" not in params
            assert params["mode"] == ["samples"]
            # need to sort because fields order is not guaranteed
            assert params["field"].sort() == ["id", "transaction"].sort()
            assert "aggregateField" not in params

    def test_explore_url_for_widget_with_discover_split_param(self) -> None:
        with self.feature("organizations:transaction-widget-deprecation-explore-view"):
            dashboard_deprecation = Dashboard.objects.create(
                title="Dashboard With Transaction Widget",
                created_by_id=self.user.id,
                organization=self.organization,
                filters={
                    "release": ["1.0.0", "2.0.0"],
                },
            )
            widget_deprecation = DashboardWidget.objects.create(
                dashboard=dashboard_deprecation,
                title="transaction widget",
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                widget_type=DashboardWidgetTypes.DISCOVER,
                discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,
                interval="1d",
                detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            )

            DashboardWidgetQuery.objects.create(
                widget=widget_deprecation,
                fields=["count()", "transaction"],
                columns=["transaction"],
                aggregates=["count()"],
                conditions="count():>50",
                orderby="-count",
                order=0,
            )

            response = self.do_request("get", self.url(dashboard_deprecation.id))
            assert response.status_code == 200
            explore_url = response.data["widgets"][0]["exploreUrls"][0]
            assert "http://testserver/explore/traces/" in explore_url

            params = dict(parse_qs(urlsplit(response.data["widgets"][0]["exploreUrls"][0]).query))
            assert params["query"] == [
                "(count(span.duration):>50) AND is_transaction:1 AND release:1.0.0,2.0.0"
            ]
            assert params["sort"] == ["-count(span.duration)"]
            assert params["mode"] == ["aggregate"]
            assert params["aggregateField"] == [
                '{"groupBy":"transaction"}',
                '{"yAxes":["count(span.duration)"],"chartType":1}',
            ]

    def test_explore_url_for_deformed_widget(self) -> None:
        with self.feature("organizations:transaction-widget-deprecation-explore-view"):
            dashboard_deprecation = Dashboard.objects.create(
                title="Dashboard With Transaction Widget",
                created_by_id=self.user.id,
                organization=self.organization,
            )
            widget_deprecation = DashboardWidget.objects.create(
                dashboard=dashboard_deprecation,
                title="line widget",
                display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
                interval="1d",
                detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            )

            DashboardWidgetQuery.objects.create(
                widget=widget_deprecation,
                fields=["query.dataset"],
                columns=["query.dataset"],
                aggregates=["p95(transaction.duration)"],
                orderby="-p95(transaction.duration)",
                conditions="transaction:/api/0/organizations/{organization_id_or_slug}/events/",
                order=0,
            )

            response = self.do_request("get", self.url(dashboard_deprecation.id))
            assert response.status_code == 200
            explore_url = response.data["widgets"][0]["exploreUrls"][0]
            assert "http://testserver/explore/traces/" in explore_url

            params = dict(parse_qs(urlsplit(response.data["widgets"][0]["exploreUrls"][0]).query))
            assert params["query"] == [
                "(transaction:/api/0/organizations/{organization_id_or_slug}/events/) AND is_transaction:1"
            ]
            assert params["sort"] == ["-p95(span.duration)"]
            assert params["mode"] == ["aggregate"]
            assert params["field"].sort() == ["query.dataset", "span.duration"].sort()
            assert params["aggregateField"] == [
                '{"groupBy":"query.dataset"}',
                '{"yAxes":["p95(span.duration)"],"chartType":1}',
            ]

    def test_changed_reason_response(self) -> None:
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200
        widget = response.data["widgets"][0]
        assert widget["changedReason"] is None

    def test_changed_reason_response_with_data(self) -> None:
        dashboard_deprecation = Dashboard.objects.create(
            title="Dashboard With Transaction Widget",
            created_by_id=self.user.id,
            organization=self.organization,
        )

        widget_deprecation = DashboardWidget.objects.create(
            dashboard=dashboard_deprecation,
            title="line widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            changed_reason=[
                {
                    "orderby": [
                        {"orderby": "total.count", "reason": "fields were dropped: total.count"}
                    ],
                    "equations": [],
                    "columns": ["total.count"],
                }
            ],
        )

        DashboardWidgetQuery.objects.create(
            widget=widget_deprecation,
            fields=["query.dataset"],
            columns=["query.dataset"],
            aggregates=["p95(transaction.duration)"],
            orderby="-p95(transaction.duration)",
            conditions="transaction:/api/0/organizations/{organization_id_or_slug}/events/",
            order=0,
        )

        response = self.do_request("get", self.url(dashboard_deprecation.id))
        assert response.status_code == 200
        widget = response.data["widgets"][0]
        assert widget["changedReason"] is not None
        assert isinstance(widget["changedReason"], list)
        assert len(widget["changedReason"]) == 1
        assert widget["changedReason"][0]["orderby"] == [
            {"orderby": "total.count", "reason": "fields were dropped: total.count"}
        ]
        assert widget["changedReason"][0]["equations"] == []
        assert widget["changedReason"][0]["columns"] == ["total.count"]


class OrganizationDashboardDetailsDeleteTest(OrganizationDashboardDetailsTestCase):
    def test_delete(self) -> None:
        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204

        assert self.client.get(self.url(self.dashboard.id)).status_code == 404

        assert not Dashboard.objects.filter(id=self.dashboard.id).exists()
        assert not DashboardWidget.objects.filter(id=self.widget_1.id).exists()
        assert not DashboardWidget.objects.filter(id=self.widget_2.id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=self.widget_1.id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=self.widget_2.id).exists()

    def test_delete_permission(self) -> None:
        self.create_user_member_role()
        self.test_delete()

    def test_allow_delete_when_no_project_access(self) -> None:
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # assign a project to a dashboard
        self.dashboard.projects.set([self.project])

        # user has no access to the above project
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_all_projects_dashboard_when_no_open_membership(self) -> None:
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        dashboard = Dashboard.objects.create(
            title="Dashboard For All Projects",
            created_by_id=self.user.id,
            organization=self.organization,
            filters={"all_projects": True},
        )

        # user has no access to all the projects
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_my_projects_dashboard_when_no_open_membership(self) -> None:
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        dashboard = Dashboard.objects.create(
            title="Dashboard For My Projects",
            created_by_id=self.user.id,
            organization=self.organization,
            # no 'filter' field means the dashboard covers all available projects
        )

        # user has no access to all the projects
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_as_superuser_but_no_edit_perms(self) -> None:
        self.create_user(id=12333)
        dashboard = Dashboard.objects.create(
            id=67,
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        # Create and login as superuser
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204, response.content

    def test_dashboard_does_not_exist(self) -> None:
        response = self.do_request("delete", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_delete_prebuilt_dashboard(self) -> None:
        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()

    def test_delete_last_dashboard(self) -> None:
        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()

        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 409

    def test_delete_last_default_dashboard(self) -> None:
        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204
        assert self.client.get(self.url(self.dashboard.id)).status_code == 404

        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 409

    def test_features_required(self) -> None:
        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request("delete", self.url("default-overview"))
            assert response.status_code == 404

    def test_delete_dashboard_with_edit_permissions_not_granted(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=1235)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 403

    def test_delete_dashboard_with_edit_permissions_disabled(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=True, dashboard=dashboard)

        user = self.create_user(id=1235)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_creator_can_delete_dashboard(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=12333)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204, response.content

    def test_user_in_team_with_access_can_delete_dashboard(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=dashboard
        )

        # Create team and add to dashboard permissions
        team = self.create_team(organization=self.organization)
        permissions.teams_with_edit_access.set([team])

        # Create user and add to team
        user = self.create_user(id=12345)
        self.create_member(user=user, organization=self.organization, teams=[team])
        self.login_as(user)

        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204, response.content

    def test_user_in_team_without_access_cannot_delete_dashboard(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=dashboard
        )

        # Create team and add to dashboard permissions
        team = self.create_team(organization=self.organization)
        permissions.teams_with_edit_access.set([team])

        # Create user not in team
        user = self.create_user(id=12345)
        self.login_as(user)

        response = self.do_request("put", self.url(dashboard.id))
        assert response.status_code == 403


class OrganizationDashboardDetailsPutTest(OrganizationDashboardDetailsTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.create_user_member_role()
        self.widget_3 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Widget 3",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        self.widget_4 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Widget 4",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        self.widget_ids = [self.widget_1.id, self.widget_2.id, self.widget_3.id, self.widget_4.id]

    def get_widget_queries(self, widget):
        return DashboardWidgetQuery.objects.filter(widget=widget).order_by("order")

    def assert_no_changes(self):
        self.assert_dashboard_and_widgets(self.widget_ids)

    def assert_dashboard_and_widgets(self, widget_ids):
        assert Dashboard.objects.filter(
            organization=self.organization, id=self.dashboard.id
        ).exists()

        widgets = self.get_widgets(self.dashboard)
        assert len(widgets) == len(list(widget_ids))

        for widget, id in zip(widgets, widget_ids):
            assert widget.id == id

    def test_dashboard_does_not_exist(self) -> None:
        response = self.do_request("put", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_feature_required(self) -> None:
        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
            )
            assert response.status_code == 404, response.data

    def test_change_dashboard_title(self) -> None:
        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
        )
        assert response.status_code == 200, response.data
        assert Dashboard.objects.filter(
            title="Dashboard Hello", organization=self.organization, id=self.dashboard.id
        ).exists()

    def test_rename_dashboard_title_taken(self) -> None:
        Dashboard.objects.create(
            title="Dashboard 2", created_by_id=self.user.id, organization=self.organization
        )
        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard 2"}
        )
        assert response.status_code == 409, response.data
        assert list(response.data) == ["Dashboard with that title already exists."]

    def test_allow_put_when_no_project_access(self) -> None:
        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # assign a project to a dashboard
        self.dashboard.projects.set([self.project])

        # user has no access to the above project
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
        )
        assert response.status_code == 200, response.data

    def test_disallow_put_when_no_project_access_and_no_edit_perms(self) -> None:
        # set dashboard edit perms to be editable only by creator
        self.dashboard.permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=self.dashboard
        )

        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # assign a project to a dashboard
        self.dashboard.projects.set([self.project])

        # user has no access to the above project
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
        )
        assert response.status_code == 403, response.data
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_disallow_put_when_has_project_access_and_no_edit_perms(self) -> None:
        # set dashboard edit perms to be editable only by creator
        self.dashboard.permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=self.dashboard
        )

        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # assign a project to a dashboard
        self.dashboard.projects.set([self.project])

        # user has access to the above project
        user = self.create_user(id=3456)
        team = self.create_team(organization=self.organization)
        self.create_member(user=user, organization=self.organization, teams=[team])
        self.project.add_team(team)
        self.login_as(user)

        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
        )
        assert response.status_code == 403, response.data
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_allow_put_as_superuser_but_no_edit_perms(self) -> None:
        self.create_user(id=12333)
        dashboard = Dashboard.objects.create(
            id=67,
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        # Create and login as superuser
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.do_request("put", self.url(dashboard.id), data={"title": "New Dashboard 9"})
        assert response.status_code == 200, response.content
        assert response.data["title"] == "New Dashboard 9"

    def test_add_widget(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {"id": str(self.widget_2.id)},
                {"id": str(self.widget_3.id)},
                {"id": str(self.widget_4.id)},
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "project"],
                            "columns": ["project"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                    "datasetSource": "user",
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 5

        last = list(widgets).pop()
        self.assert_serialized_widget(data["widgets"][4], last)

        queries = last.dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][4]["queries"][0], queries[0])

    def test_add_widget_with_field_aliases(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": [],
                            "aggregates": ["count()"],
                            "columns": ["project"],
                            "fieldAliases": ["Errors quantity"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1

        for expected_widget, actual_widget in zip(data["widgets"], widgets):
            self.assert_serialized_widget(expected_widget, actual_widget)
            queries = actual_widget.dashboardwidgetquery_set.all()

            for expected_query, actual_query in zip(expected_widget["queries"], queries):
                self.assert_serialized_widget_query(expected_query, actual_query)

    def test_add_widget_with_selected_aggregate(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "EPM Big Number",
                    "displayType": "big_number",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["epm()"],
                            "columns": [],
                            "aggregates": ["epm()", "count()"],
                            "conditions": "",
                            "orderby": "",
                            "selectedAggregate": 1,
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1

        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = widgets[0].dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_add_big_number_widget_with_equation(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "EPM Big Number",
                    "displayType": "big_number",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["equation|count()"],
                            "columns": [],
                            "aggregates": ["count()", "equation|count()*2"],
                            "conditions": "",
                            "orderby": "",
                            "selectedAggregate": 1,
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1

        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = widgets[0].dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_add_widget_with_aggregates_and_columns(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "columns": [],
                    "aggregates": [],
                },
                {
                    "id": str(self.widget_2.id),
                    "columns": [],
                    "aggregates": [],
                },
                {
                    "id": str(self.widget_3.id),
                    "columns": [],
                    "aggregates": [],
                },
                {
                    "id": str(self.widget_4.id),
                    "columns": [],
                    "aggregates": [],
                },
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": [],
                            "aggregates": ["count()"],
                            "columns": ["project"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 5

        last = list(widgets).pop()
        self.assert_serialized_widget(data["widgets"][4], last)

        queries = last.dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][4]["queries"][0], queries[0])

    def test_add_widget_missing_title(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Title is required during creation" in response.content

    def test_add_widget_with_limit(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Custom Widget",
                    "displayType": "line",
                    "interval": "5m",
                    "limit": None,
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
                {
                    "title": "Duration Distribution",
                    "displayType": "bar",
                    "interval": "5m",
                    "limit": 10,
                    "queries": [
                        {
                            "name": "",
                            "fields": [
                                "p50(transaction.duration)",
                                "p75(transaction.duration)",
                                "p95(transaction.duration)",
                            ],
                            "columns": [],
                            "aggregates": [
                                "p50(transaction.duration)",
                                "p75(transaction.duration)",
                                "p95(transaction.duration)",
                            ],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2

        self.assert_serialized_widget(data["widgets"][0], widgets[0])
        self.assert_serialized_widget(data["widgets"][1], widgets[1])

    def test_add_widget_with_invalid_limit_above_maximum(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Duration Distribution",
                    "displayType": "bar",
                    "interval": "5m",
                    "limit": 11,
                    "queries": [
                        {
                            "name": "",
                            "fields": [
                                "p50(transaction.duration)",
                                "p75(transaction.duration)",
                                "p95(transaction.duration)",
                            ],
                            "columns": [],
                            "aggregates": [
                                "p50(transaction.duration)",
                                "p75(transaction.duration)",
                                "p95(transaction.duration)",
                            ],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Ensure this value is less than or equal to 10" in response.content

    def test_add_widget_with_invalid_limit_below_minimum(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Duration Distribution",
                    "displayType": "bar",
                    "interval": "5m",
                    "limit": 0,
                    "queries": [
                        {
                            "name": "",
                            "fields": [
                                "p50(transaction.duration)",
                                "p75(transaction.duration)",
                                "p95(transaction.duration)",
                            ],
                            "columns": [],
                            "aggregates": [
                                "p50(transaction.duration)",
                                "p75(transaction.duration)",
                                "p95(transaction.duration)",
                            ],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Ensure this value is greater than or equal to 1" in response.content

    def test_add_widget_display_type(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Errors",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"displayType is required during creation" in response.content

    def test_add_widget_invalid_query(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid fields",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["p95(transaction.duration)"],
                            "columns": [],
                            "aggregates": ["p95(transaction.duration)"],
                            "conditions": "foo: bar:",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid conditions" in response.content

    def test_add_widget_unknown_aggregation(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid fields",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["wrong()"],
                            "columns": [],
                            "aggregates": ["wrong()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid fields" in response.content

    def test_add_widget_invalid_aggregate_parameter(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid fields",
                    "displayType": "line",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["p95(user)"],
                            "columns": [],
                            "aggregates": ["p95(user)"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid fields" in response.content

    def test_add_widget_invalid_interval(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid interval",
                    "displayType": "line",
                    "interval": "1q",
                    "queries": [
                        {
                            "name": "Durations",
                            "fields": ["p95(transaction.duration)"],
                            "columns": [],
                            "aggregates": ["p95(transaction.duration)"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid interval" in response.content

    def test_add_widget_e2e_test_with_translation(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "transaction widget to translate",
                    "displayType": "line",
                    "interval": "5m",
                    "widgetType": "transaction-like",
                    "limit": 3,
                    "queries": [
                        {
                            "fields": [
                                "title",
                                "total.count",
                                "count()",
                                "count_web_vitals(measurements.lcp,good)",
                            ],
                            "columns": ["title", "total.count"],
                            "aggregates": ["count()", "count_web_vitals(measurements.lcp,good)"],
                            "conditions": "title:foo",
                            "orderby": "-count_web_vitals(measurements.lcp,good)",
                            "order": 0,
                        }
                    ],
                }
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        assert DashboardWidget.objects.filter(title="transaction widget to translate").exists()
        widget = DashboardWidget.objects.filter(title="transaction widget to translate").first()
        assert widget is not None
        assert widget.widget_type == DashboardWidgetTypes.TRANSACTION_LIKE
        assert widget.dataset_source == DatasetSourcesTypes.USER.value
        assert widget.display_type == DashboardWidgetDisplayTypes.LINE_CHART
        assert widget.interval == "5m"

        widget_queries = DashboardWidgetQuery.objects.filter(widget=widget)
        assert widget_queries.count() == 1
        widget_query = widget_queries.first()
        assert widget_query is not None
        assert widget_query.fields == [
            "title",
            "total.count",
            "count()",
            "count_web_vitals(measurements.lcp,good)",
        ]
        assert widget_query.aggregates == ["count()", "count_web_vitals(measurements.lcp,good)"]
        assert widget_query.columns == ["title", "total.count"]
        assert widget_query.conditions == "title:foo"
        assert widget_query.orderby == "-count_web_vitals(measurements.lcp,good)"

        translated_widget = translate_dashboard_widget(widget)
        assert translated_widget.widget_type == DashboardWidgetTypes.SPANS
        assert (
            translated_widget.dataset_source
            == DashboardWidgetDatasetSourcesTypes.SPAN_MIGRATION_VERSION_5.value
        )
        assert translated_widget.display_type == DashboardWidgetDisplayTypes.LINE_CHART
        assert translated_widget.interval == "5m"

        translated_widget_queries = DashboardWidgetQuery.objects.filter(widget=translated_widget)
        assert translated_widget_queries.count() == 1
        translated_widget_query = translated_widget_queries.first()
        assert translated_widget_query is not None
        assert translated_widget_query.fields == ["transaction", "count(span.duration)"]
        assert translated_widget_query.aggregates == ["count(span.duration)"]
        assert translated_widget_query.columns == ["transaction"]
        assert translated_widget_query.conditions == "(transaction:foo) AND is_transaction:1"
        assert translated_widget_query.orderby == ""

    def test_update_widget_title(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id), "title": "New title"},
                {"id": str(self.widget_2.id)},
                {"id": str(self.widget_3.id)},
                {"id": str(self.widget_4.id)},
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200

        widgets = self.get_widgets(self.dashboard.id)
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

    def test_update_widget_add_query(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {
                            "id": str(self.widget_1_data_1.id),
                            "columns": [],
                            "aggregates": [],
                        },
                        {
                            "name": "transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        },
                    ],
                    "datasetSource": "user",
                },
                {"id": str(self.widget_2.id)},
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        # two widgets should be removed
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 2
        assert data["widgets"][0]["queries"][0]["id"] == str(queries[0].id)
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][1], queries[1])

    def test_update_widget_remove_and_update_query(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {
                            "id": str(self.widget_1_data_1.id),
                            "name": "transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        },
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        # only one widget should remain
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_update_widget_reorder_queries(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {
                            "id": str(self.widget_1_data_2.id),
                            "columns": [],
                            "aggregates": [],
                        },
                        {
                            "id": str(self.widget_1_data_1.id),
                            "columns": [],
                            "aggregates": [],
                        },
                    ],
                },
                {"id": str(self.widget_2.id)},
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        # two widgets should be removed
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 2
        assert queries[0].id == self.widget_1_data_2.id
        assert queries[1].id == self.widget_1_data_1.id

    def test_update_widget_use_other_query(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {
                            "id": str(self.widget_2_data_1.id),
                            "columns": [],
                            "aggregates": [],
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert "You cannot use a query not owned by this widget" in response.data

    def test_update_widget_invalid_orderby(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "queries": [
                        {
                            "fields": ["title", "count()"],
                            "columns": ["title"],
                            "aggregates": ["count()"],
                            "conditions": "",
                            "orderby": "message",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Cannot sort by a field" in response.content

    def test_remove_widget_and_add_new(self) -> None:
        # Remove a widget from the middle of the set and put a new widget there
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {"id": str(self.widget_2.id)},
                {
                    "title": "Errors over time",
                    "displayType": "line",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
                {"id": str(self.widget_4.id)},
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 4
        # Check ordering
        assert self.widget_1.id == widgets[0].id
        assert self.widget_2.id == widgets[1].id
        assert self.widget_4.id == widgets[2].id
        # The new widget was added to the end, this is because the order is based on the id
        self.assert_serialized_widget(data["widgets"][2], widgets[3])

    def test_update_widget_invalid_aggregate_parameter(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "Invalid fields",
                    "displayType": "line",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["p95(user)"],
                            "columns": [],
                            "aggregates": ["p95(user)"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid fields" in response.content

    def test_update_widget_invalid_fields(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "Invalid fields",
                    "displayType": "line",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["p95()"],
                            "columns": [],
                            "aggregates": ["p95()"],
                            "conditions": "foo: bar:",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid conditions" in response.content

    def test_update_widget_with_thresholds_and_preferred_polarity(self) -> None:
        data = {
            "title": "Dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "Big Number with Thresholds and Polarity",
                    "displayType": "big_number",
                    "thresholds": {
                        "max_values": {"max1": 100, "max2": 200},
                        "unit": "count",
                        "preferred_polarity": "+",
                    },
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        assert response.data["widgets"][0]["thresholds"] == {
            "max_values": {"max1": 100, "max2": 200},
            "unit": "count",
            "preferredPolarity": "+",
        }

        widget = DashboardWidget.objects.get(id=self.widget_1.id)
        assert widget.thresholds == {
            "max_values": {"max1": 100, "max2": 200},
            "unit": "count",
            "preferred_polarity": "+",
        }

    def test_update_widget_with_invalid_preferred_polarity(self) -> None:
        data = {
            "title": "Dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "Big Number with Invalid Polarity",
                    "displayType": "big_number",
                    "thresholds": {
                        "max_values": {"max1": 100, "max2": 200},
                        "unit": "count",
                        "preferredPolarity": "$",
                    },
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert (
            response.data["widgets"][0]["thresholds"]["preferredPolarity"]
            == "Must be '+', '-', or empty string."
        )

    def test_update_migrated_spans_widget_reset_changed_reason(self) -> None:
        new_dashboard = Dashboard.objects.create(
            title="New dashboard",
            organization=self.organization,
            created_by_id=self.user.id,
        )
        spans_widget = DashboardWidget.objects.create(
            dashboard=new_dashboard,
            title="Spans widget",
            widget_type=DashboardWidgetTypes.SPANS,
            dataset_source=DashboardWidgetDatasetSourcesTypes.SPAN_MIGRATION_VERSION_1.value,
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            changed_reason=[
                {
                    "orderby": [
                        {"orderby": "total.count", "reason": "fields were dropped: total.count"}
                    ],
                    "equations": [],
                    "columns": ["total.count"],
                }
            ],
        )

        data = {
            "title": "New dashboard",
            "widgets": [
                {
                    "id": str(spans_widget.id),
                    "title": "updated spans widget",
                    "widgetType": "spans",
                    "datasetSource": "user",
                    "displayType": "line",
                    "changedReason": spans_widget.changed_reason,
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count(span.duration)"],
                            "columns": [],
                            "aggregates": ["count(span.duration)"],
                            "conditions": "",
                        }
                    ],
                }
            ],
        }

        response = self.do_request("put", self.url(new_dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["widgets"][0]["changedReason"] is None
        spans_widget.refresh_from_db()
        assert spans_widget.changed_reason is None
        assert spans_widget.dataset_source == DashboardWidgetDatasetSourcesTypes.USER.value

    def test_remove_widgets(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id), "title": "New title"},
                {"id": str(self.widget_2.id), "title": "Other title"},
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2
        self.assert_serialized_widget(data["widgets"][0], widgets[0])
        self.assert_serialized_widget(data["widgets"][1], widgets[1])

    def test_reorder_widgets_has_no_effect(self) -> None:
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {"id": self.widget_3.id},
                    {"id": self.widget_2.id},
                    {"id": self.widget_1.id},
                    {"id": self.widget_4.id},
                ]
            },
        )
        assert response.status_code == 200, response.data

        # Reordering has no effect since the order is based on the id
        self.assert_dashboard_and_widgets(
            [self.widget_1.id, self.widget_2.id, self.widget_3.id, self.widget_4.id]
        )

    def test_update_widget_layouts(self) -> None:
        layouts = {
            self.widget_1.id: {"x": 0, "y": 0, "w": 2, "h": 5, "minH": 2},
            self.widget_2.id: {"x": 2, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_3.id: {"x": 3, "y": 0, "w": 2, "h": 2, "minH": 2},
            self.widget_4.id: {"x": 0, "y": 5, "w": 2, "h": 5, "minH": 2},
        }
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {"id": widget.id, "layout": layouts[widget.id]}
                    for widget in [self.widget_1, self.widget_2, self.widget_3, self.widget_4]
                ]
            },
        )
        assert response.status_code == 200, response.data
        widgets = response.data["widgets"]
        for widget in widgets:
            assert widget["layout"] == layouts[int(widget["id"])]

    def test_update_layout_with_invalid_data_fails(self) -> None:
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {
                        "id": self.widget_1.id,
                        "layout": {
                            "x": "this type is unexpected",
                            "y": 0,
                            "w": 2,
                            "h": 5,
                            "minH": 2,
                        },
                    }
                ]
            },
        )
        assert response.status_code == 400, response.data

    def test_update_without_specifying_layout_does_not_change_saved_layout(self) -> None:
        expected_layouts = {
            self.widget_1.id: {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_2.id: {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_3.id: None,
            self.widget_4.id: None,
        }
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {"id": widget.id}  # Not specifying layout for any widget
                    for widget in [self.widget_1, self.widget_2, self.widget_3, self.widget_4]
                ]
            },
        )
        assert response.status_code == 200, response.data
        widgets = response.data["widgets"]
        for widget in widgets:
            assert widget["layout"] == expected_layouts[int(widget["id"])]

    def test_ignores_certain_keys_in_layout(self) -> None:
        expected_layouts = {
            self.widget_1.id: {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_2.id: {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2},
        }
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {
                        "id": widget.id,
                        "layout": {
                            **expected_layouts[widget.id],
                            "i": "this-should-be-ignored",
                            "static": "don't want this",
                            "moved": False,
                        },
                    }
                    for widget in [self.widget_1, self.widget_2]
                ]
            },
        )
        assert response.status_code == 200, response.data
        widgets = response.data["widgets"]
        for widget in widgets:
            assert widget["layout"] == expected_layouts[int(widget["id"])]

    def test_update_prebuilt_dashboard(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "New title",
                    "displayType": "line",
                    "queries": [
                        {
                            "name": "transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        },
                    ],
                },
            ],
        }
        slug = "default-overview"
        response = self.do_request("put", self.url(slug), data=data)
        assert response.status_code == 200, response.data
        dashboard_id = response.data["id"]
        assert dashboard_id != slug

        # Ensure widget and query were saved
        widgets = self.get_widgets(dashboard_id)
        assert len(widgets) == 1
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 1
        assert DashboardTombstone.objects.filter(slug=slug).exists()

    def test_update_unknown_prebuilt(self) -> None:
        data = {
            "title": "First dashboard",
        }
        slug = "nope-not-real"
        response = self.client.put(self.url(slug), data=data)
        assert response.status_code == 404

    def test_partial_reordering_deletes_widgets(self) -> None:
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "title": "Changed the title",
                "widgets": [{"id": self.widget_3.id}, {"id": self.widget_4.id}],
            },
        )
        assert response.status_code == 200
        self.assert_dashboard_and_widgets([self.widget_3.id, self.widget_4.id])
        deleted_widget_ids = [self.widget_1.id, self.widget_2.id]
        assert not DashboardWidget.objects.filter(id__in=deleted_widget_ids).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id__in=deleted_widget_ids).exists()

    def test_widget_does_not_belong_to_dashboard(self) -> None:
        widget = DashboardWidget.objects.create(
            dashboard=Dashboard.objects.create(
                organization=self.organization, title="Dashboard 2", created_by_id=self.user.id
            ),
            title="Widget 200",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": widget.id}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()

    def test_widget_does_not_exist(self) -> None:
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": 1234567890}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()

    def test_add_issue_widget_valid_query(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "is:unresolved",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

    def test_add_issue_widget_invalid_query(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "is:())",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Parse error" in response.content

    def test_add_discover_widget_invalid_issue_query(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "transaction-like",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "is:unresolved",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid conditions" in response.content

    def test_add_multiple_discover_and_issue_widget(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Unresolved Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "is:unresolved",
                        }
                    ],
                },
                {
                    "title": "Resolved Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "is:resolved",
                        }
                    ],
                },
                {
                    "title": "Transactions",
                    "displayType": "table",
                    "widgetType": "transaction-like",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
                {
                    "title": "Errors",
                    "displayType": "table",
                    "widgetType": "error-events",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

    def test_add_discover_widget_using_total_count(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "transaction-like",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()", "total.count"],
                            "columns": ["total.count"],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

    def test_add_discover_widget_returns_validation_error(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "discover",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["count()", "total.count"],
                            "columns": ["total.count"],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        with self.feature({"organizations:deprecate-discover-widget-type": True}):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)

        assert response.status_code == 400, response.data
        assert (
            "Attribute value `discover` is deprecated. Please use `error-events` or `transaction-like`"
            in response.content.decode()
        )

    def test_update_dashboard_with_filters(self) -> None:
        project1 = self.create_project(name="foo", organization=self.organization)
        project2 = self.create_project(name="bar", organization=self.organization)
        data = {
            "title": "First dashboard",
            "projects": [project1.id, project2.id],
            "environment": ["alpha"],
            "period": "7d",
            "filters": {"release": ["v1"]},
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert sorted(response.data["projects"]) == [project1.id, project2.id]
        assert response.data["environment"] == ["alpha"]
        assert response.data["period"] == "7d"
        assert response.data["filters"]["release"] == ["v1"]

    def test_update_dashboard_with_invalid_project_filter(self) -> None:
        other_project = self.create_project(name="other", organization=self.create_organization())
        data = {
            "title": "First dashboard",
            "projects": [other_project.id],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 403, response.data

    def test_update_dashboard_with_all_projects(self) -> None:
        data = {
            "title": "First dashboard",
            "projects": [-1],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["projects"] == [-1]

    def test_update_dashboard_with_my_projects_after_setting_all_projects(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Filters",
            created_by_id=self.user.id,
            organization=self.organization,
            filters={"all_projects": True},
        )
        data = {
            "title": "First dashboard",
            "projects": [],
        }

        response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["projects"] == []

    def test_update_dashboard_with_more_widgets_than_max(self) -> None:
        data = {
            "title": "Too many widgets",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": f"Widget {i}",
                    "limit": 5,
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": ["transaction"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
                }
                for i in range(Dashboard.MAX_WIDGETS + 1)
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert (
            f"Number of widgets must be less than {Dashboard.MAX_WIDGETS}"
            in response.content.decode()
        )

    def test_update_dashboard_with_widget_filter_requiring_environment(self) -> None:
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Widget",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "release.stage:adopted",
                        }
                    ],
                }
            ],
        }
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 200, response.data

    def test_update_dashboard_permissions_with_put(self) -> None:

        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "False"},
        }

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )

        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False

    def test_update_dashboard_permissions_to_false(self) -> None:
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "false"},
        }

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False

    def test_update_dashboard_permissions_when_already_created(self) -> None:
        mock_project = self.create_project()
        permission = DashboardPermissions.objects.create(
            is_editable_by_everyone=True, dashboard=self.dashboard
        )
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "false"},
        }

        assert permission.is_editable_by_everyone is True
        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )

        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False

        permission.refresh_from_db()
        assert permission.is_editable_by_everyone is False

    def test_update_dashboard_permissions_with_invalid_value(self) -> None:
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "something-invalid"},
        }
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 400, response.data
        assert "isEditableByEveryone" in response.data["permissions"]

    def test_edit_dashboard_with_edit_permissions_not_granted(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=3456)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request("put", self.url(dashboard.id), data={"title": "New Dashboard 9"})
        assert response.status_code == 403

    def test_all_users_can_edit_dashboard_with_edit_permissions_disabled(self) -> None:
        self.create_user(id=12333)
        dashboard = Dashboard.objects.create(
            id=67,
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=True, dashboard=dashboard)

        user = self.create_user(id=3456)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request("put", self.url(dashboard.id), data={"title": "New Dashboard 9"})
        assert response.status_code == 200, response.content
        assert response.data["title"] == "New Dashboard 9"

    def test_creator_can_edit_dashboard(self) -> None:
        user = self.create_user(id=12333)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        response = self.do_request("put", self.url(dashboard.id), data={"title": "New Dashboard 9"})
        assert response.status_code == 200, response.content
        assert response.data["title"] == "New Dashboard 9"

    def test_user_in_team_with_access_can_edit_dashboard(self) -> None:
        self.create_user(id=11452)
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=dashboard
        )

        # Create team and add to dashboard permissions
        team = self.create_team(organization=self.organization)
        permissions.teams_with_edit_access.set([team])

        # Create user and add to team
        user = self.create_user(id=12345)
        self.create_member(user=user, organization=self.organization, teams=[team])
        self.login_as(user)

        response = self.do_request("put", self.url(dashboard.id), data={"title": "New Dashboard 9"})
        assert response.status_code == 200, response.content

    def test_user_in_team_without_access_cannot_edit_dashboard(self) -> None:
        self.create_user(id=11452)
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=dashboard
        )

        # Create team and add to dashboard permissions
        team = self.create_team(organization=self.organization)
        permissions.teams_with_edit_access.set([team])

        # Create user not in team
        user = self.create_user(id=12345)
        self.login_as(user)

        response = self.do_request("put", self.url(dashboard.id), data={"title": "New Dashboard 9"})
        assert response.status_code == 403

    def test_user_tries_to_update_dashboard_edit_perms(self) -> None:
        DashboardPermissions.objects.create(is_editable_by_everyone=True, dashboard=self.dashboard)

        user = self.create_user(id=28193)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"permissions": {"is_editable_by_everyone": False}},
        )
        assert response.status_code == 400
        assert (
            "Only the Dashboard Creator may modify Dashboard Edit Access"
            in response.content.decode()
        )

    def test_only_owner_can_update_dashboard_edit_perms(self) -> None:
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=self.dashboard)

        user = self.create_user(id=28193)
        self.create_member(user=user, organization=self.organization, role="manager")
        self.login_as(user)

        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"permissions": {"is_editable_by_everyone": False}},
        )
        assert response.status_code == 403

        user = self.create_user(id=28194)
        self.create_member(user=user, organization=self.organization, role="owner")
        self.login_as(user)

        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"permissions": {"is_editable_by_everyone": False}},
        )
        assert response.status_code == 200

    def test_update_dashboard_permissions_with_new_teams(self) -> None:
        mock_project = self.create_project()
        permission = DashboardPermissions.objects.create(
            is_editable_by_everyone=True, dashboard=self.dashboard
        )
        self.create_environment(project=mock_project, name="mock_env")
        assert permission.is_editable_by_everyone is True

        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)
        data = {
            "title": "Dashboard",
            "permissions": {
                "isEditableByEveryone": "false",
                "teamsWithEditAccess": [str(team1.id), str(team2.id)],
            },
        }

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False
        assert response.data["permissions"]["teamsWithEditAccess"] == [team1.id, team2.id]

        updated_perms = DashboardPermissions.objects.get(dashboard=self.dashboard)
        assert set(updated_perms.teams_with_edit_access.all()) == {team1, team2}

    def test_update_teams_in_dashboard_permissions(self) -> None:
        mock_project = self.create_project()
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)
        perms = DashboardPermissions.objects.create(
            is_editable_by_everyone=True, dashboard=self.dashboard
        )
        perms.teams_with_edit_access.add(team1)
        perms.teams_with_edit_access.add(team2)
        assert set(perms.teams_with_edit_access.all()) == {team1, team2}

        self.create_environment(project=mock_project, name="mock_env")
        assert perms.is_editable_by_everyone is True

        new_team1 = self.create_team(organization=self.organization)
        new_team2 = self.create_team(organization=self.organization)
        data = {
            "title": "Dashboard",
            "permissions": {
                "isEditableByEveryone": "false",
                "teamsWithEditAccess": [str(team1.id), str(new_team1.id), str(new_team2.id)],
            },
        }

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["teamsWithEditAccess"] == [
            team1.id,
            new_team1.id,
            new_team2.id,
        ]

        updated_perms = DashboardPermissions.objects.get(dashboard=self.dashboard)
        assert set(updated_perms.teams_with_edit_access.all()) == {team1, new_team1, new_team2}

    def test_update_dashboard_permissions_with_invalid_teams(self) -> None:
        mock_project = self.create_project()
        permission = DashboardPermissions.objects.create(
            is_editable_by_everyone=True, dashboard=self.dashboard
        )
        self.create_environment(project=mock_project, name="mock_env")
        assert permission.is_editable_by_everyone is True

        data = {
            "title": "Dashboard",
            "permissions": {
                "isEditableByEveryone": "false",
                "teamsWithEditAccess": ["6", "23134", "0", "1"],
            },
        }

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 400
        assert (
            "Cannot update dashboard edit permissions. Teams with IDs 0, 23134, 6, and 1 do not exist."
            in response.content.decode()
        )

    def test_update_dashboard_permissions_with_teams_from_different_org(self) -> None:
        mock_project = self.create_project()

        test_org = self.create_organization(name="TOrg", owner=self.user)
        team_1 = self.create_team(organization=self.organization)
        team_test_org = self.create_team(organization=test_org)
        data = {
            "title": "Dashboard",
            "permissions": {
                "isEditableByEveryone": "false",
                "teamsWithEditAccess": [str(team_1.id), str(team_test_org.id)],
            },
        }

        self.create_environment(project=mock_project, name="mock_env")

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )

        assert response.status_code == 400
        assert (
            f"Cannot update dashboard edit permissions. Teams with IDs {team_test_org.id} do not exist."
            in response.content.decode()
        )

    def test_update_dashboard_permissions_with_none_does_not_create_permissions_object(
        self,
    ) -> None:
        data = {
            "title": "Dashboard",
            "permissions": None,
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["permissions"] is None
        assert not DashboardPermissions.objects.filter(dashboard=self.dashboard).exists()

    def test_select_everyone_in_dashboard_permissions_clears_all_teams(self) -> None:
        mock_project = self.create_project()
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)
        perms = DashboardPermissions.objects.create(
            is_editable_by_everyone=False, dashboard=self.dashboard
        )
        perms.teams_with_edit_access.add(team1)
        perms.teams_with_edit_access.add(team2)
        assert set(perms.teams_with_edit_access.all()) == {team1, team2}

        self.create_environment(project=mock_project, name="mock_env")
        assert perms.is_editable_by_everyone is False

        data = {
            "title": "Dashboard",
            "permissions": {
                "isEditableByEveryone": "true",
                "teamsWithEditAccess": [str(team1.id), str(team2.id)],
            },
        }

        user = User(id=self.dashboard.created_by_id)  # type: ignore[misc]
        self.login_as(user=user)
        response = self.do_request(
            "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
        )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["teamsWithEditAccess"] == []

        updated_perms = DashboardPermissions.objects.get(dashboard=self.dashboard)
        assert set(updated_perms.teams_with_edit_access.all()) == set()

    def test_update_dashboard_without_projects_does_not_clear_projects(self) -> None:
        project1 = self.create_project(name="foo", organization=self.organization)
        project2 = self.create_project(name="bar", organization=self.organization)

        dashboard = self.create_dashboard(title="First dashboard", organization=self.organization)
        dashboard.projects.add(project1)
        dashboard.projects.add(project2)

        data = {
            "title": "Modified Title",
        }

        response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert sorted(response.data["projects"]) == [project1.id, project2.id]

    def test_save_widget_with_custom_measurement_in_equation_tables(self) -> None:
        BaseMetricsTestCase.store_metric(
            self.organization.id,
            self.project.id,
            "d:transactions/measurements.custom_duration@millisecond",
            {},
            int(before_now(days=1).timestamp()),
            1,
        )

        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "EPM table",
                    "widgetType": "transaction-like",
                    "displayType": "table",
                    "queries": [
                        {
                            "name": "",
                            "fields": [
                                "transaction.duration",
                                "measurements.custom_duration",
                                "equation|measurements.custom_duration / transaction.duration",
                            ],
                            "columns": [
                                "transaction.duration",
                                "measurements.custom_duration",
                            ],
                            "aggregates": [
                                "equation|measurements.custom_duration / transaction.duration"
                            ],
                            "conditions": "",
                            "orderby": "",
                            "selectedAggregate": 1,
                        }
                    ],
                },
            ],
        }
        with self.feature({"organizations:performance-use-metrics": True}):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1

        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = widgets[0].dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_save_widget_with_custom_measurement_in_equation_line_chart(self) -> None:
        BaseMetricsTestCase.store_metric(
            self.organization.id,
            self.project.id,
            "d:transactions/measurements.custom_duration@millisecond",
            {},
            int(before_now(days=1).timestamp()),
            1,
        )

        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "EPM line",
                    "displayType": "line",
                    "limit": 3,
                    "queries": [
                        {
                            "name": "",
                            "fields": [
                                "transaction.duration",
                                "measurements.custom_duration",
                                "equation|avg(measurements.custom_duration) / avg(transaction.duration)",
                            ],
                            "columns": [
                                "transaction.duration",
                                "measurements.custom_duration",
                            ],
                            "aggregates": [
                                "equation|avg(measurements.custom_duration) / avg(transaction.duration)"
                            ],
                            "conditions": "",
                            "orderby": "",
                            "selectedAggregate": 1,
                        }
                    ],
                },
            ],
        }
        with self.feature({"organizations:performance-use-metrics": True}):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1

        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = widgets[0].dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_dashboard_release_widget_resets_to_errors(self) -> None:
        dashboard = self.create_dashboard(
            title="dataset reset issue", organization=self.organization
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="Custom Widget",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
            dataset_source=DatasetSourcesTypes.USER.value,
        )
        DashboardWidgetQuery.objects.create(
            widget=widget,
            name="",
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            conditions="",
            orderby="-count()",
            order=0,
        )

        data = {
            "title": "dataset reset issue",
            "widgets": [
                {
                    "id": str(widget.id),
                    "title": "Custom Widget",
                    "displayType": "table",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["crash_free_rate(session)"],
                            "fieldAliases": [],
                            "columns": [],
                            "aggregates": ["crash_free_rate(session)"],
                            "conditions": "",
                            "orderby": "-crash_free_rate(session)",
                        }
                    ],
                    "widgetType": "metrics",
                    "thresholds": None,
                    "description": None,
                },
            ],
        }

        response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 200, response.data

        assert response.data["widgets"][0]["widgetType"] == "metrics"

        widget = DashboardWidget.objects.get(id=widget.id)
        assert widget.discover_widget_split is None
        assert widget.dataset_source == DatasetSourcesTypes.UNKNOWN.value

    def test_dashboard_widget_missing_columns_can_successfully_save(self) -> None:
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Issue Widget",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(DashboardWidgetTypes.ISSUE),
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["issue", "title"],
                            "aggregates": [],
                            "conditions": "",
                            "orderby": "",
                        }
                    ],
                }
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["widgets"][0]["queries"][0]["columns"] == []
        assert response.data["widgets"][0]["queries"][0]["fields"] == ["issue", "title"]
        assert response.data["widgets"][0]["widgetType"] == "issue"

    def test_dashboard_transaction_widget_deprecation_with_flag(self) -> None:
        with self.feature("organizations:discover-saved-queries-deprecation"):
            data = {
                "title": "Test Dashboard",
                "widgets": [
                    {
                        "title": "Transaction Widget",
                        "displayType": "table",
                        "widgetType": DashboardWidgetTypes.get_type_name(
                            DashboardWidgetTypes.TRANSACTION_LIKE
                        ),
                        "queries": [
                            {
                                "name": "Transaction Widget",
                                "fields": ["count()"],
                                "aggregates": ["count()"],
                                "conditions": "",
                                "orderby": "-count()",
                                "columns": [],
                                "fieldAliases": [],
                            }
                        ],
                    }
                ],
            }
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
            assert response.status_code == 400
            assert (
                response.data["widgets"][0]["widgetType"][0]
                == "The transactions dataset is being deprecated. Please use the spans dataset with the `is_transaction:true` filter instead."
            )

    def test_dashboard_exisiting_transaction_widget_deprecation_with_flag(self) -> None:
        with self.feature("organizations:discover-saved-queries-deprecation"):
            data = {
                "title": "Test Dashboard",
                "widgets": [
                    {
                        "id": self.widget_1.id,
                        "title": "Transaction Widget",
                        "displayType": "table",
                        "widgetType": DashboardWidgetTypes.get_type_name(
                            DashboardWidgetTypes.TRANSACTION_LIKE
                        ),
                        "queries": [
                            {
                                "name": "Transaction Widget",
                                "fields": ["count()"],
                                "aggregates": ["count()"],
                                "conditions": "",
                                "orderby": "-count()",
                                "columns": [],
                                "fieldAliases": [],
                            }
                        ],
                    },
                    {
                        "title": "Error Widget",
                        "displayType": "table",
                        "widgetType": DashboardWidgetTypes.get_type_name(
                            DashboardWidgetTypes.ERROR_EVENTS
                        ),
                        "queries": [
                            {
                                "name": "Error Widget",
                                "fields": ["count()"],
                                "aggregates": ["count()"],
                                "conditions": "",
                                "orderby": "-count()",
                                "columns": [],
                                "fieldAliases": [],
                            }
                        ],
                    },
                ],
            }
            # should be able to add widget to dashboard with existing transaction widgets

            response = self.do_request("put", self.url(self.dashboard.id), data=data)
            assert response.status_code == 200

    def test_create_widget_with_field_links(self) -> None:
        # Create a second dashboard to link to
        linked_dashboard = Dashboard.objects.create(
            title="Linked Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )

        data: dict[str, Any] = {
            "title": "Dashboard with Field Links",
            "widgets": [
                {
                    "title": "Widget with Links",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Query with Links",
                            "fields": ["count()", "project"],
                            "columns": ["project"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                            "linkedDashboards": [
                                {"field": "project", "dashboardId": linked_dashboard.id}
                            ],
                        }
                    ],
                    "datasetSource": "user",
                }
            ],
        }

        with self.feature("organizations:dashboards-drilldown-flow"):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data.get("widgets")[0].get("queries")[0].get("linkedDashboards") == [
            {
                "field": "project",
                "dashboardId": linked_dashboard.id,
            }
        ]

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1

        widget = widgets[0]
        queries = widget.dashboardwidgetquery_set.all()
        assert len(queries) == 1

        # Verify field links were created
        field_links = DashboardFieldLink.objects.filter(dashboard_widget_query=queries[0])
        assert len(field_links) == 1

        field_link = field_links[0]
        assert field_link.field == "project"
        assert field_link.dashboard_id == linked_dashboard.id
        assert field_link.dashboard_widget_query_id == queries[0].id

    def test_update_widget_with_field_links(self) -> None:
        dashboard = self.create_dashboard(
            title="Dashboard with Links", organization=self.organization
        )
        linked_dashboard = Dashboard.objects.create(
            title="Linked Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="Widget with Links",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
            dataset_source=DatasetSourcesTypes.USER.value,
        )
        widget_query = DashboardWidgetQuery.objects.create(
            widget=widget,
            name="",
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            conditions="",
            orderby="-count()",
            order=0,
        )
        DashboardFieldLink.objects.create(
            dashboard_widget_query=widget_query,
            field="project",
            dashboard_id=linked_dashboard.id,
        )
        data: dict[str, Any] = {
            "title": "Dashboard with Links",
            "widgets": [
                {
                    "id": str(widget.id),
                    "title": "Widget with Links",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "id": str(widget_query.id),
                            "name": "Query with Links",
                            "fields": ["count()", "project", "environment"],
                            "columns": ["project"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                            "linkedDashboards": [
                                {"field": "project", "dashboardId": linked_dashboard.id},
                                {"field": "environment", "dashboardId": linked_dashboard.id},
                            ],
                        }
                    ],
                }
            ],
        }

        with self.feature("organizations:dashboards-drilldown-flow"):
            response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        widget = widgets[0]
        queries = widget.dashboardwidgetquery_set.all()
        assert len(queries) == 1

        field_links = DashboardFieldLink.objects.filter(dashboard_widget_query=queries[0]).order_by(
            "field"
        )
        assert len(field_links) == 2

        # Verify the field links were updated correctly
        assert field_links[0].field == "environment"
        assert field_links[0].dashboard_id == linked_dashboard.id
        assert field_links[0].dashboard_widget_query_id == queries[0].id
        assert field_links[1].field == "project"
        assert field_links[1].dashboard_id == linked_dashboard.id
        assert field_links[1].dashboard_widget_query_id == queries[0].id

    def test_deletes_widget_with_field_links(self) -> None:
        dashboard = self.create_dashboard(
            title="Dashboard with Links", organization=self.organization
        )
        linked_dashboard = Dashboard.objects.create(
            title="Linked Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="Widget with Links",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
            dataset_source=DatasetSourcesTypes.USER.value,
        )
        widget_query = DashboardWidgetQuery.objects.create(
            widget=widget,
            name="",
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            conditions="",
            orderby="-count()",
            order=0,
        )
        DashboardFieldLink.objects.create(
            dashboard_widget_query=widget_query,
            field="project",
            dashboard_id=linked_dashboard.id,
        )
        data: dict[str, Any] = {
            "title": "Dashboard with Links",
            "widgets": [
                {
                    "id": str(widget.id),
                    "title": "Widget with Links",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "id": str(widget_query.id),
                            "name": "Query with Links",
                            "fields": ["count()", "project", "environment"],
                            "columns": ["project"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                            "linkedDashboards": [],
                        }
                    ],
                }
            ],
        }

        with self.feature("organizations:dashboards-drilldown-flow"):
            response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        widget = widgets[0]
        queries = widget.dashboardwidgetquery_set.all()
        assert len(queries) == 1

        field_links = DashboardFieldLink.objects.filter(dashboard_widget_query=queries[0])
        assert len(field_links) == 0

    def test_does_not_update_non_table_dashboard_links(self) -> None:
        dashboard = self.create_dashboard(
            title="Dashboard with Links", organization=self.organization
        )
        linked_dashboard = Dashboard.objects.create(
            title="Linked Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="Widget with Links",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
            dataset_source=DatasetSourcesTypes.USER.value,
        )
        widget_query = DashboardWidgetQuery.objects.create(
            widget=widget,
            name="",
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            conditions="",
            orderby="-count()",
            order=0,
        )
        DashboardFieldLink.objects.create(
            dashboard_widget_query=widget_query,
            field="project",
            dashboard_id=self.dashboard.id,
        )
        data: dict[str, Any] = {
            "title": "Dashboard with Links",
            "widgets": [
                {
                    "id": str(widget.id),
                    "title": "Widget with Links",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "id": str(widget_query.id),
                            "name": "Query with Links",
                            "fields": ["count()", "project", "environment"],
                            "linkedDashboards": [
                                {"field": "project", "dashboardId": linked_dashboard.id},
                            ],
                        }
                    ],
                }
            ],
        }

        with self.feature("organizations:dashboards-drilldown-flow"):
            response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Field links are only supported for table widgets" in response.content

    def test_does_not_update_if_linked_dashboard_does_not_appear_in_fields(self) -> None:
        dashboard = self.create_dashboard(
            title="Dashboard with Links", organization=self.organization
        )
        linked_dashboard = Dashboard.objects.create(
            title="Linked Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            title="Widget with Links",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
            dataset_source=DatasetSourcesTypes.USER.value,
        )
        widget_query = DashboardWidgetQuery.objects.create(
            widget=widget,
            name="",
            fields=["count()"],
            columns=[],
            aggregates=["count()"],
            conditions="",
            orderby="-count()",
            order=0,
        )
        DashboardFieldLink.objects.create(
            dashboard_widget_query=widget_query,
            field="project",
            dashboard_id=linked_dashboard.id,
        )
        data: dict[str, Any] = {
            "title": "Dashboard with Links",
            "widgets": [
                {
                    "id": str(widget.id),
                    "title": "Widget with Links",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "id": str(widget_query.id),
                            "name": "Query with Links",
                            "fields": ["count()", "user.email"],
                            "columns": ["user.email"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                            "linkedDashboards": [
                                {"field": "project", "dashboardId": linked_dashboard.id},
                            ],
                        }
                    ],
                }
            ],
        }
        with self.feature("organizations:dashboards-drilldown-flow"):
            response = self.do_request("put", self.url(dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Linked dashboard does not appear in the fields of the query" in response.content

    def test_cannot_delete_prebuilt_insights_dashboard(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Frontend Session Health",
            organization=self.organization,
            prebuilt_id=PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
        )
        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 409
        assert "Cannot delete prebuilt Dashboards." in response.content.decode()

    def test_cannot_edit_prebuilt_insights_dashboard(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Frontend Session Health",
            organization=self.organization,
            prebuilt_id=PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
        )
        response = self.do_request(
            "put", self.url(dashboard.id), data={"title": "Frontend Session Health Edited"}
        )
        assert response.status_code == 409
        assert "Cannot edit prebuilt Dashboards." in response.content.decode()


class OrganizationDashboardDetailsOnDemandTest(OrganizationDashboardDetailsTestCase):
    widget_type = DashboardWidgetTypes.TRANSACTION_LIKE

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.create_user_member_role()
        self.widget_3 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Widget 3",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=self.widget_type,
        )
        self.widget_4 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Widget 4",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=self.widget_type,
        )
        self.widget_ids = [self.widget_1.id, self.widget_2.id, self.widget_3.id, self.widget_4.id]

    def test_ondemand_without_flags(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:pre-rollout"

    def test_ondemand_with_unapplicable_query(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:not-applicable"

    def test_ondemand_with_flags(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "enabled:creation"

    @mock.patch("sentry.relay.config.metric_extraction.get_max_widget_specs", return_value=0)
    def test_ondemand_hits_spec_limit(self, mock_max: mock.MagicMock) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:spec-limit"

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_ondemand_hits_card_limit(self, mock_query: mock.MagicMock) -> None:
        mock_query.return_value = {
            "data": [{"count_unique(sometag)": 1_000_000, "count_unique(someothertag)": 1}]
        }, [
            "sometag",
            "someothertag",
        ]
        data: dict[str, Any] = {
            "title": "first dashboard",
            "widgets": [
                {
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:high-cardinality"

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_ondemand_updates_existing_widget(self, mock_query: mock.MagicMock) -> None:
        mock_query.return_value = {"data": [{"count_unique(sometag)": 1_000_000}]}, [
            "sometag",
        ]
        data: dict[str, Any] = {
            "title": "first dashboard",
            "widgets": [
                {
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:high-cardinality"

        data = {
            "title": "first dashboard",
            "widgets": [
                {
                    "id": str(widgets[0].id),
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "id": str(queries[0].id),
                            "name": "errors",
                            "fields": ["count()", "someothertag"],
                            "columns": ["someothertag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }

        mock_query.return_value = {"data": [{"count_unique(someothertag)": 0}]}, [
            "someothertag",
        ]
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "enabled:creation"

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_ondemand_updates_new_widget(self, mock_query: mock.MagicMock) -> None:
        mock_query.return_value = {"data": [{"count_unique(sometag)": 1_000_000}]}, [
            "sometag",
        ]
        data: dict[str, Any] = {
            "title": "first dashboard",
            "widgets": [
                {
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:high-cardinality"

        data = {
            "title": "first dashboard",
            "widgets": [
                {
                    "id": str(widgets[0].id),
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            # without id here we'll make a new query and delete the old one
                            "name": "errors",
                            "fields": ["count()", "someotherothertag"],
                            "columns": ["someotherothertag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }

        mock_query.return_value = {"data": [{"count_unique(someotherothertag)": 0}]}, [
            "someotherothertag",
        ]
        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "enabled:creation"

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_cardinality_check_with_feature_flag(self, mock_query: mock.MagicMock) -> None:
        mock_query.return_value = {"data": [{"count_unique(sometag)": 1_000_000}]}, [
            "sometag",
        ]
        data: dict[str, Any] = {
            "title": "first dashboard",
            "widgets": [
                {
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }

        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:high-cardinality"

    @mock.patch("sentry.tasks.on_demand_metrics._query_cardinality")
    def test_feature_check_takes_precedence_over_cardinality(
        self, mock_query: mock.MagicMock
    ) -> None:
        mock_query.return_value = {"data": [{"count_unique(sometag)": 1_000_000}]}, [
            "sometag",
        ]
        data: dict[str, Any] = {
            "title": "first dashboard",
            "widgets": [
                {
                    "title": "errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "widgetType": DashboardWidgetTypes.get_type_name(self.widget_type),
                    "queries": [
                        {
                            "name": "errors",
                            "fields": ["count()", "sometag"],
                            "columns": ["sometag"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        last = list(widgets).pop()
        queries = last.dashboardwidgetquery_set.all()

        ondemand_objects = DashboardWidgetQueryOnDemand.objects.filter(
            dashboard_widget_query=queries[0]
        )
        for version in OnDemandMetricSpecVersioning.get_spec_versions():
            current_version = ondemand_objects.filter(spec_version=version.version).first()
            assert current_version is not None
            assert current_version.extraction_state == "disabled:pre-rollout"

    @mock.patch("sentry.api.serializers.rest_framework.dashboard.get_current_widget_specs")
    def test_cardinality_skips_non_discover_widget_types(
        self, mock_get_specs: mock.MagicMock
    ) -> None:
        widget = {
            "title": "issues widget",
            "displayType": "table",
            "interval": "5m",
            "widgetType": "issue",
            "queries": [
                {
                    "name": "errors",
                    "fields": ["count()", "sometag"],
                    "columns": ["sometag"],
                    "aggregates": ["count()"],
                    "conditions": "event.type:transaction",
                }
            ],
        }
        data: dict[str, Any] = {
            "title": "first dashboard",
            "widgets": [
                {**widget, "widgetType": "issue"},
                {**widget, "widgetType": "metrics"},
            ],
        }

        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        assert mock_get_specs.call_count == 0

    def test_add_widget_with_split_widget_type_writes_to_split_decision(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "project"],
                            "columns": ["project"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                    "widgetType": "error-events",
                },
                {
                    "title": "Transaction Op Count",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Transaction Op Count",
                            "fields": ["count()", "transaction.op"],
                            "columns": ["transaction.op"],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                    "widgetType": "transaction-like",
                },
                {
                    "title": "Irrelevant widget type",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Issues",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                    "widgetType": "issue",
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.dashboard.dashboardwidget_set.all().order_by("id")
        assert widgets[0].widget_type == DashboardWidgetTypes.get_id_for_type_name("error-events")
        assert widgets[0].discover_widget_split == DashboardWidgetTypes.get_id_for_type_name(
            "error-events"
        )

        assert widgets[1].widget_type == DashboardWidgetTypes.get_id_for_type_name(
            "transaction-like"
        )
        assert widgets[1].discover_widget_split == DashboardWidgetTypes.get_id_for_type_name(
            "transaction-like"
        )

        assert widgets[2].widget_type == DashboardWidgetTypes.get_id_for_type_name("issue")
        assert widgets[2].discover_widget_split is None


class OrganizationDashboardDetailsOnDemandTransactionLikeTest(
    OrganizationDashboardDetailsOnDemandTest
):
    # Re-run the on-demand tests with the transaction-like widget type
    widget_type = DashboardWidgetTypes.TRANSACTION_LIKE


class OrganizationDashboardVisitTest(OrganizationDashboardDetailsTestCase):
    def url(self, dashboard_id):
        return reverse(
            "sentry-api-0-organization-dashboard-visit",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": dashboard_id,
            },
        )

    def test_visit_dashboard(self) -> None:
        assert self.dashboard.last_visited is not None
        last_visited = self.dashboard.last_visited
        assert self.dashboard.visits == 1

        response = self.do_request("post", self.url(self.dashboard.id))
        assert response.status_code == 204

        dashboard = Dashboard.objects.get(id=self.dashboard.id)
        assert dashboard.visits == 2
        assert dashboard.last_visited is not None
        assert dashboard.last_visited > last_visited

    def test_visit_dashboard_no_access(self) -> None:
        last_visited = self.dashboard.last_visited
        assert self.dashboard.visits == 1

        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request("post", self.url(self.dashboard.id))

        assert response.status_code == 404

        dashboard = Dashboard.objects.get(id=self.dashboard.id)
        assert dashboard.visits == 1
        assert dashboard.last_visited == last_visited

    def test_user_visited_dashboard_creates_entry(self) -> None:
        member = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        assert not DashboardLastVisited.objects.filter(
            dashboard=self.dashboard,
            member=member,
        ).exists()

        response = self.do_request("post", self.url(self.dashboard.id))
        assert response.status_code == 204

        visit = DashboardLastVisited.objects.get(
            dashboard=self.dashboard,
            member=member,
        )
        assert visit.last_visited.timestamp() == pytest.approx(timezone.now().timestamp())

    def test_user_visited_dashboard_updates_entry(self) -> None:
        member = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        DashboardLastVisited.objects.create(
            dashboard=self.dashboard,
            member=member,
            last_visited=timezone.now() - timedelta(days=10),
        )

        response = self.do_request("post", self.url(self.dashboard.id))
        assert response.status_code == 204

        visit = DashboardLastVisited.objects.get(
            dashboard=self.dashboard,
            member=member,
        )
        assert visit.last_visited.timestamp() == pytest.approx(timezone.now().timestamp())


class OrganizationDashboardFavoriteTest(OrganizationDashboardDetailsTestCase):
    def setUp(self) -> None:
        super().setUp()
        # Create two additional users
        self.user_1 = self.create_user(email="user1@example.com")
        self.user_2 = self.create_user(email="user2@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.create_member(user=self.user_2, organization=self.organization)

        # Both users have favorited the dashboard
        self.dashboard.favorited_by = [self.user_1.id, self.user_2.id]

    def url(self, dashboard_id):
        return reverse(
            "sentry-api-0-organization-dashboard-favorite",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": dashboard_id,
            },
        )

    # PUT tests
    def test_favorite_dashboard(self) -> None:
        assert self.user.id not in self.dashboard.favorited_by
        self.login_as(user=self.user)
        response = self.do_request("put", self.url(self.dashboard.id), data={"isFavorited": "true"})
        assert response.status_code == 204
        assert self.user.id in self.dashboard.favorited_by

    def test_unfavorite_dashboard(self) -> None:
        assert self.user_1.id in self.dashboard.favorited_by
        self.login_as(user=self.user_1)
        response = self.do_request("put", self.url(self.dashboard.id), data={"isFavorited": False})
        assert response.status_code == 204
        assert self.user_1.id not in self.dashboard.favorited_by

    def test_favorite_dashboard_no_dashboard_edit_access(self) -> None:
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=self.dashboard)
        self.login_as(user=self.user_2)
        dashboard_detail_url = reverse(
            "sentry-api-0-organization-dashboard-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
            },
        )
        response = self.do_request("put", dashboard_detail_url, data={"title": "New Dashboard 9"})
        # assert user cannot edit dashboard
        assert response.status_code == 403

        # assert if user can edit the favorite status of the dashboard
        assert self.user_2.id in self.dashboard.favorited_by
        response = self.do_request("put", self.url(self.dashboard.id), data={"isFavorited": False})
        assert response.status_code == 204
        assert self.user_2.id not in self.dashboard.favorited_by


class OrganizationDashboardFavoriteReorderingTest(OrganizationDashboardDetailsTestCase):
    """
    These tests are intended to cover and eventually replace the existing
    OrganizationDashboardFavoriteTest cases.

    They are updated as necessary to match the new functionality and
    constraints regarding the position maintenance of the dashboard favorites.
    """

    features = ["organizations:dashboards-starred-reordering"]

    def do_request(self, *args, **kwargs):
        with self.feature(self.features):
            return super().do_request(*args, **kwargs)

    def setUp(self) -> None:
        super().setUp()
        # Create two additional users
        self.user_1 = self.create_user(email="user1@example.com")
        self.user_2 = self.create_user(email="user2@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.create_member(user=self.user_2, organization=self.organization)

        # Both users have favorited the dashboard
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            organization=self.organization,
            user_id=self.user_1.id,
            dashboard=self.dashboard,
        )
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            organization=self.organization,
            user_id=self.user_2.id,
            dashboard=self.dashboard,
        )

    def url(self, dashboard_id):
        return reverse(
            "sentry-api-0-organization-dashboard-favorite",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": dashboard_id,
            },
        )

    # PUT tests
    def test_favorite_dashboard(self) -> None:
        assert self.user.id not in self.dashboard.favorited_by
        self.login_as(user=self.user)

        # Insert an initial starred dashboard for this user
        initial_dashboard = Dashboard.objects.create(
            title="Other Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            organization=self.organization,
            user_id=self.user.id,
            dashboard=initial_dashboard,
        )
        response = self.do_request("put", self.url(self.dashboard.id), data={"isFavorited": "true"})
        assert response.status_code == 204

        # Assert that the dashboard is added to the end of the list by its position
        assert list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization,
                user_id=self.user.id,
            )
            .order_by("position")
            .values_list("dashboard_id", flat=True)
        ) == [
            initial_dashboard.id,
            self.dashboard.id,
        ]

    def test_unfavorite_dashboard(self) -> None:
        assert self.user_1.id in self.dashboard.favorited_by
        self.login_as(user=self.user_1)
        response = self.do_request("put", self.url(self.dashboard.id), data={"isFavorited": False})
        assert response.status_code == 204
        assert (
            DashboardFavoriteUser.objects.get_favorite_dashboard(
                organization=self.organization,
                user_id=self.user_1.id,
                dashboard=self.dashboard,
            )
            is None
        )

    def test_favorite_dashboard_no_dashboard_edit_access(self) -> None:
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=self.dashboard)
        self.login_as(user=self.user_2)
        dashboard_detail_url = reverse(
            "sentry-api-0-organization-dashboard-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
            },
        )
        response = self.do_request("put", dashboard_detail_url, data={"title": "New Dashboard 9"})
        # assert user cannot edit dashboard
        assert response.status_code == 403

        # assert if user can edit the favorite status of the dashboard
        assert (
            DashboardFavoriteUser.objects.get_favorite_dashboard(
                organization=self.organization,
                user_id=self.user_2.id,
                dashboard=self.dashboard,
            )
            is not None
        )
        response = self.do_request("put", self.url(self.dashboard.id), data={"isFavorited": False})

        # The dashboard was successfully unfavorited
        assert response.status_code == 204
        assert (
            DashboardFavoriteUser.objects.get_favorite_dashboard(
                organization=self.organization,
                user_id=self.user_2.id,
                dashboard=self.dashboard,
            )
            is None
        )
