from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest import mock

import pytest
from django.urls import reverse

from sentry.discover.models import DatasetSourcesTypes
from sentry.models.dashboard import Dashboard, DashboardTombstone
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.project import Project
from sentry.snuba.metrics.extraction import OnDemandMetricSpecVersioning
from sentry.testutils.cases import BaseMetricsTestCase, OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.users.models.user import User

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]


class OrganizationDashboardDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def setUp(self):
        super().setUp()
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        self.widget_2 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=1,
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
    def test_get(self):
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

    def test_dashboard_does_not_exist(self):
        response = self.do_request("get", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_get_prebuilt_dashboard(self):
        # Pre-built dashboards should be accessible
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_prebuilt_dashboard_with_discover_split_feature_flag(self):
        with self.feature({"organizations:performance-discover-dataset-selector": True}):
            response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200, response.data

        for widget in response.data["widgets"]:
            assert widget["widgetType"] in {"issue", "transaction-like", "error-events"}

    def test_prebuilt_dashboard_without_discover_split_feature_flag(self):
        with self.feature({"organizations:performance-discover-dataset-selector": False}):
            response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200, response.data

        for widget in response.data["widgets"]:
            assert widget["widgetType"] in {"issue", "discover"}

    def test_get_prebuilt_dashboard_tombstoned(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        # Pre-built dashboards should be accessible even when tombstoned
        # This is to preserve behavior around bookmarks
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_features_required(self):
        with self.feature({"organizations:dashboards-basic": False}):
            response = self.do_request("get", self.url("default-overview"))
            assert response.status_code == 404

    def test_dashboard_widget_returns_limit(self):
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["limit"] is None
        assert response.data["widgets"][1]["limit"] == 5

    def test_dashboard_widget_query_returns_field_aliases(self):
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["queries"][0]["fieldAliases"][0] == "Count Alias"
        assert response.data["widgets"][1]["queries"][0]["fieldAliases"] == []

    def test_filters_is_empty_dict_in_response_if_not_applicable(self):
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

    def test_dashboard_filters_are_returned_in_response(self):
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

    def test_start_and_end_filters_are_returned_in_response(self):
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

    def test_response_truncates_with_retention(self):
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

    def test_dashboard_widget_type_returns_split_decision(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Split Widgets",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            discover_widget_split=DashboardWidgetTypes.ERROR_EVENTS,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title="transaction widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
            discover_widget_split=DashboardWidgetTypes.TRANSACTION_LIKE,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            order=2,
            title="no split",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        with self.feature({"organizations:performance-discover-dataset-selector": True}):
            response = self.do_request(
                "get",
                self.url(dashboard.id),
            )
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["widgetType"] == "error-events"
        assert response.data["widgets"][1]["widgetType"] == "transaction-like"
        assert response.data["widgets"][2]["widgetType"] == "discover"

    def test_dashboard_widget_returns_dataset_source(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            order=0,
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

    def test_dashboard_widget_default_dataset_source_is_unknown(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard Without",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard,
            order=0,
            title="error widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )

        response = self.do_request("get", self.url(dashboard.id))
        assert response.status_code == 200, response.content
        assert response.data["widgets"][0]["datasetSource"] == "unknown"

    def test_dashboard_widget_query_returns_selected_aggregate(self):
        widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=2,
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

    def test_dashboard_details_data_returns_permissions(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(dashboard=dashboard, is_editable_by_everyone=False)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("get", self.url(dashboard.id))

        assert response.status_code == 200, response.content

        assert "permissions" in response.data
        assert not response.data["permissions"]["isEditableByEveryone"]

    def test_dashboard_details_data_returns_Null_permissions(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("get", self.url(dashboard.id))

        assert response.status_code == 200, response.content

        assert "permissions" in response.data
        assert not response.data["permissions"]

    def test_dashboard_viewable_with_no_edit_permissions(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=1142,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=1289)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("get", self.url(dashboard.id))
        assert response.status_code == 200, response.content

    def test_dashboard_details_data_returns_permissions_with_teams(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("get", self.url(dashboard.id))

        assert response.status_code == 200, response.content

        assert "permissions" in response.data
        assert not response.data["permissions"]["isEditableByEveryone"]
        assert "teamsWithEditAccess" in response.data["permissions"]
        assert response.data["permissions"]["teamsWithEditAccess"] == [team1.id, team2.id]

    def test_get_favorited_user_status(self):
        self.user_1 = self.create_user(email="user1@example.com")
        self.user_2 = self.create_user(email="user2@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.create_member(user=self.user_2, organization=self.organization)

        self.dashboard.favorited_by = [self.user_1.id, self.user_2.id]

        self.login_as(user=self.user_1)
        with self.feature({"organizations:dashboards-favourite": True}):
            response = self.do_request("get", self.url(self.dashboard.id))
            assert response.status_code == 200
            assert response.data["isFavorited"] is True

    def test_get_not_favorited_user_status(self):
        self.user_1 = self.create_user(email="user1@example.com")
        self.create_member(user=self.user_1, organization=self.organization)
        self.dashboard.favorited_by = [self.user_1.id, self.user.id]

        user_3 = self.create_user()
        self.create_member(user=user_3, organization=self.organization)
        self.login_as(user=user_3)
        with self.feature({"organizations:dashboards-favourite": True}):
            response = self.do_request("get", self.url(self.dashboard.id))
            assert response.status_code == 200
            assert response.data["isFavorited"] is False

    def test_get_favorite_status_no_dashboard_edit_access(self):
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
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", dashboard_detail_put_url, data={"title": "New Dashboard 9"}
            )
            # assert user cannot edit dashboard
            assert response.status_code == 403

        # assert user can see if they favorited the dashboard
        with self.feature({"organizations:dashboards-favourite": True}):
            response = self.do_request("get", self.url(self.dashboard.id))
            assert response.status_code == 200
            assert response.data["isFavorited"] is True


class OrganizationDashboardDetailsDeleteTest(OrganizationDashboardDetailsTestCase):
    def test_delete(self):
        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204

        assert self.client.get(self.url(self.dashboard.id)).status_code == 404

        assert not Dashboard.objects.filter(id=self.dashboard.id).exists()
        assert not DashboardWidget.objects.filter(id=self.widget_1.id).exists()
        assert not DashboardWidget.objects.filter(id=self.widget_2.id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=self.widget_1.id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=self.widget_2.id).exists()

    def test_delete_permission(self):
        self.create_user_member_role()
        self.test_delete()

    def test_disallow_delete_when_no_project_access(self):
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
        assert response.status_code == 403
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_disallow_delete_all_projects_dashboard_when_no_open_membership(self):
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
        assert response.status_code == 403
        assert response.data == {"detail": "You do not have permission to perform this action."}

        # owner is allowed to delete
        self.owner = self.create_member(
            user=self.create_user(), organization=self.organization, role="owner"
        )
        self.login_as(self.owner)
        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_disallow_delete_my_projects_dashboard_when_no_open_membership(self):
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
        assert response.status_code == 403
        assert response.data == {"detail": "You do not have permission to perform this action."}

        # creator is allowed to delete
        self.login_as(self.user)
        response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_when_no_project_access(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_all_projects_dashboard_when_no_open_membership(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_my_projects_dashboard_when_no_open_membership(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_disallow_delete_when_no_project_access_and_no_edit_perms(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204

    def test_allow_delete_as_superuser_but_no_edit_perms(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204, response.content

    def test_dashboard_does_not_exist(self):
        response = self.do_request("delete", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_delete_prebuilt_dashboard(self):
        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()

    def test_delete_last_dashboard(self):
        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()

        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 409

    def test_delete_last_default_dashboard(self):
        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204
        assert self.client.get(self.url(self.dashboard.id)).status_code == 404

        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 409

    def test_features_required(self):
        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request("delete", self.url("default-overview"))
            assert response.status_code == 404

    def test_delete_dashboard_with_edit_permissions_not_granted(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=1235)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 403

    def test_delete_dashboard_with_edit_permissions_disabled(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=11452,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=True, dashboard=dashboard)

        user = self.create_user(id=1235)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204

    def test_creator_can_delete_dashboard(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=12333)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204, response.content

    def test_user_in_team_with_access_can_delete_dashboard(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("delete", self.url(dashboard.id))
        assert response.status_code == 204, response.content

    def test_user_in_team_without_access_cannot_delete_dashboard(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("put", self.url(dashboard.id))
        assert response.status_code == 403


class OrganizationDashboardDetailsPutTest(OrganizationDashboardDetailsTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.create_user_member_role()
        self.widget_3 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=2,
            title="Widget 3",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        self.widget_4 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=3,
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

    def test_dashboard_does_not_exist(self):
        response = self.do_request("put", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_feature_required(self):
        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
            )
            assert response.status_code == 404, response.data

    def test_change_dashboard_title(self):
        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
        )
        assert response.status_code == 200, response.data
        assert Dashboard.objects.filter(
            title="Dashboard Hello", organization=self.organization, id=self.dashboard.id
        ).exists()

    def test_rename_dashboard_title_taken(self):
        Dashboard.objects.create(
            title="Dashboard 2", created_by_id=self.user.id, organization=self.organization
        )
        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard 2"}
        )
        assert response.status_code == 409, response.data
        assert list(response.data) == ["Dashboard with that title already exists."]

    def test_disallow_put_when_no_project_access(self):
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

    def test_allow_put_when_no_project_access(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
            )
        assert response.status_code == 200, response.data

    def test_disallow_put_when_no_project_access_and_no_edit_perms(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
            )
        assert response.status_code == 403, response.data
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_disallow_put_when_has_project_access_and_no_edit_perms(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
            )
        assert response.status_code == 403, response.data
        assert response.data == {"detail": "You do not have permission to perform this action."}

    def test_allow_put_as_superuser_but_no_edit_perms(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(dashboard.id), data={"title": "New Dashboard 9"}
            )
        assert response.status_code == 200, response.content
        assert response.data["title"] == "New Dashboard 9"

    def test_add_widget(self):
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

    def test_add_widget_with_field_aliases(self):
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

    def test_add_widget_with_selected_aggregate(self):
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

    def test_add_big_number_widget_with_equation(self):
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

    def test_add_widget_with_aggregates_and_columns(self):
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

    def test_add_widget_missing_title(self):
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

    def test_add_widget_with_limit(self):
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

    def test_add_widget_with_invalid_limit_above_maximum(self):
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

    def test_add_widget_with_invalid_limit_below_minimum(self):
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

    def test_add_widget_display_type(self):
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

    def test_add_widget_invalid_query(self):
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

    def test_add_widget_unknown_aggregation(self):
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

    def test_add_widget_invalid_aggregate_parameter(self):
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

    def test_add_widget_invalid_interval(self):
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

    def test_update_widget_title(self):
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

    def test_update_widget_add_query(self):
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

    def test_update_widget_remove_and_update_query(self):
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

    def test_update_widget_reorder_queries(self):
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

    def test_update_widget_use_other_query(self):
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

    def test_update_widget_invalid_orderby(self):
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

    def test_remove_widget_and_add_new(self):
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
        self.assert_serialized_widget(data["widgets"][2], widgets[2])
        assert self.widget_4.id == widgets[3].id

    def test_update_widget_invalid_aggregate_parameter(self):
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

    def test_update_widget_invalid_fields(self):
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

    def test_remove_widgets(self):
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

    def test_reorder_widgets(self):
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
        self.assert_dashboard_and_widgets(
            [self.widget_3.id, self.widget_2.id, self.widget_1.id, self.widget_4.id]
        )

    def test_update_widget_layouts(self):
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

    def test_update_layout_with_invalid_data_fails(self):
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

    def test_update_without_specifying_layout_does_not_change_saved_layout(self):
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

    def test_ignores_certain_keys_in_layout(self):
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

    def test_update_prebuilt_dashboard(self):
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

    def test_update_unknown_prebuilt(self):
        data = {
            "title": "First dashboard",
        }
        slug = "nope-not-real"
        response = self.client.put(self.url(slug), data=data)
        assert response.status_code == 404

    def test_partial_reordering_deletes_widgets(self):
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

    def test_widget_does_not_belong_to_dashboard(self):
        widget = DashboardWidget.objects.create(
            order=5,
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

    def test_widget_does_not_exist(self):
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": 1234567890}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()

    def test_add_issue_widget_valid_query(self):
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

    def test_add_issue_widget_invalid_query(self):
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

    def test_add_discover_widget_invalid_issue_query(self):
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

    def test_add_multiple_discover_and_issue_widget(self):
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
                    "widgetType": "discover",
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
                    "widgetType": "discover",
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

    def test_add_discover_widget_using_total_count(self):
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

    def test_update_dashboard_with_filters(self):
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

    def test_update_dashboard_with_invalid_project_filter(self):
        other_project = self.create_project(name="other", organization=self.create_organization())
        data = {
            "title": "First dashboard",
            "projects": [other_project.id],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 403, response.data

    def test_update_dashboard_with_all_projects(self):
        data = {
            "title": "First dashboard",
            "projects": [-1],
        }

        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["projects"] == [-1]

    def test_update_dashboard_with_my_projects_after_setting_all_projects(self):
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

    def test_update_dashboard_with_more_widgets_than_max(self):
        data = {
            "title": "Too many widgets",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": f"Widget {i}",
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

    def test_update_dashboard_with_widget_filter_requiring_environment(self):
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

    def test_update_dashboard_permissions_with_put(self):

        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "False"},
        }

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )

        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False

    def test_update_dashboard_permissions_to_false(self):
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "false"},
        }

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False

    def test_update_dashboard_permissions_when_already_created(self):
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
        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )

        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False

        permission.refresh_from_db()
        assert permission.is_editable_by_everyone is False

    def test_update_dashboard_permissions_with_invalid_value(self):
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "permissions": {"isEditableByEveryone": "something-invalid"},
        }
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )
        assert response.status_code == 400, response.data
        assert "isEditableByEveryone" in response.data["permissions"]

    def test_edit_dashboard_with_edit_permissions_not_granted(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        user = self.create_user(id=3456)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(dashboard.id), data={"title": "New Dashboard 9"}
            )
        assert response.status_code == 403

    def test_all_users_can_edit_dashboard_with_edit_permissions_disabled(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(dashboard.id), data={"title": "New Dashboard 9"}
            )
        assert response.status_code == 200, response.content
        assert response.data["title"] == "New Dashboard 9"

    def test_creator_can_edit_dashboard(self):
        user = self.create_user(id=12333)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        dashboard = Dashboard.objects.create(
            title="Dashboard With Dataset Source",
            created_by_id=12333,
            organization=self.organization,
        )
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=dashboard)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(dashboard.id), data={"title": "New Dashboard 9"}
            )
        assert response.status_code == 200, response.content
        assert response.data["title"] == "New Dashboard 9"

    def test_user_in_team_with_access_can_edit_dashboard(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(dashboard.id), data={"title": "New Dashboard 9"}
            )
        assert response.status_code == 200, response.content

    def test_user_in_team_without_access_cannot_edit_dashboard(self):
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

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", self.url(dashboard.id), data={"title": "New Dashboard 9"}
            )
        assert response.status_code == 403

    def test_user_tries_to_update_dashboard_edit_perms(self):
        DashboardPermissions.objects.create(is_editable_by_everyone=True, dashboard=self.dashboard)

        user = self.create_user(id=28193)
        self.create_member(user=user, organization=self.organization)
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
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

    def test_manager_or_owner_can_update_dashboard_edit_perms(self):
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=self.dashboard)

        user = self.create_user(id=28193)
        self.create_member(user=user, organization=self.organization, role="manager")
        self.login_as(user)

        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put",
                self.url(self.dashboard.id),
                data={"permissions": {"is_editable_by_everyone": False}},
            )
        assert response.status_code == 200

    def test_update_dashboard_permissions_with_new_teams(self):
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

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["isEditableByEveryone"] is False
        assert response.data["permissions"]["teamsWithEditAccess"] == [team1.id, team2.id]

        updated_perms = DashboardPermissions.objects.get(dashboard=self.dashboard)
        assert set(updated_perms.teams_with_edit_access.all()) == {team1, team2}

    def test_update_teams_in_dashboard_permissions(self):
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

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
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

    def test_update_dashboard_permissions_with_invalid_teams(self):
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

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )
        assert response.status_code == 400
        assert (
            "Cannot update dashboard edit permissions. Teams with IDs 0, 23134, 6, and 1 do not exist."
            in response.content.decode()
        )

    def test_update_dashboard_permissions_with_teams_from_different_org(self):
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

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )

        assert response.status_code == 400
        assert (
            f"Cannot update dashboard edit permissions. Teams with IDs {team_test_org.id} do not exist."
            in response.content.decode()
        )

    def test_update_dashboard_permissions_with_none_does_not_create_permissions_object(self):
        data = {
            "title": "Dashboard",
            "permissions": None,
        }
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data
        assert response.data["permissions"] is None
        assert not DashboardPermissions.objects.filter(dashboard=self.dashboard).exists()

    def test_select_everyone_in_dashboard_permissions_clears_all_teams(self):
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

        user = User(id=self.dashboard.created_by_id)
        self.login_as(user=user)
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", f"{self.url(self.dashboard.id)}?environment=mock_env", data=data
            )
        assert response.status_code == 200, response.data
        assert response.data["permissions"]["teamsWithEditAccess"] == []

        updated_perms = DashboardPermissions.objects.get(dashboard=self.dashboard)
        assert set(updated_perms.teams_with_edit_access.all()) == set()

    def test_update_dashboard_without_projects_does_not_clear_projects(self):
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

    def test_save_widget_with_custom_measurement_in_equation_tables(self):
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

    def test_save_widget_with_custom_measurement_in_equation_line_chart(self):
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


class OrganizationDashboardDetailsOnDemandTest(OrganizationDashboardDetailsTestCase):
    widget_type = DashboardWidgetTypes.DISCOVER

    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.create_user_member_role()
        self.widget_3 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=2,
            title="Widget 3",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=self.widget_type,
        )
        self.widget_4 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=3,
            title="Widget 4",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=self.widget_type,
        )
        self.widget_ids = [self.widget_1.id, self.widget_2.id, self.widget_3.id, self.widget_4.id]

    def get_widget_queries(self, widget):
        return DashboardWidgetQuery.objects.filter(widget=widget).order_by("order")

    def test_ondemand_without_flags(self):
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

    def test_ondemand_with_unapplicable_query(self):
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

    def test_ondemand_with_flags(self):
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
    def test_ondemand_hits_spec_limit(self, mock_max):
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
    def test_ondemand_hits_card_limit(self, mock_query):
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
    def test_ondemand_updates_existing_widget(self, mock_query):
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
    def test_ondemand_updates_new_widget(self, mock_query):
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
    def test_cardinality_precedence_over_feature_checks(self, mock_query):
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
            assert current_version.extraction_state == "disabled:high-cardinality"

    @mock.patch("sentry.api.serializers.rest_framework.dashboard.get_current_widget_specs")
    def test_cardinality_skips_non_discover_widget_types(self, mock_get_specs):
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
                {**widget, "widgetType": "custom-metrics"},
            ],
        }

        with self.feature(["organizations:on-demand-metrics-extraction-widgets"]):
            response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        assert mock_get_specs.call_count == 0

    def test_add_widget_with_split_widget_type_writes_to_split_decision(self):
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

        widgets = self.dashboard.dashboardwidget_set.all()
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

    def test_visit_dashboard(self):
        assert self.dashboard.last_visited is not None
        last_visited = self.dashboard.last_visited
        assert self.dashboard.visits == 1

        response = self.do_request("post", self.url(self.dashboard.id))
        assert response.status_code == 204

        dashboard = Dashboard.objects.get(id=self.dashboard.id)
        assert dashboard.visits == 2
        assert dashboard.last_visited is not None
        assert dashboard.last_visited > last_visited

    def test_visit_dashboard_no_access(self):
        last_visited = self.dashboard.last_visited
        assert self.dashboard.visits == 1

        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request("post", self.url(self.dashboard.id))

        assert response.status_code == 404

        dashboard = Dashboard.objects.get(id=self.dashboard.id)
        assert dashboard.visits == 1
        assert dashboard.last_visited == last_visited


class OrganizationDashboardFavoriteTest(OrganizationDashboardDetailsTestCase):
    def setUp(self):
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
    def test_favorite_dashboard(self):
        assert self.user.id not in self.dashboard.favorited_by
        self.login_as(user=self.user)
        with self.feature({"organizations:dashboards-favourite": True}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"isFavorited": "true"}
            )
            assert response.status_code == 204
            assert self.user.id in self.dashboard.favorited_by

    def test_unfavorite_dashboard(self):
        assert self.user_1.id in self.dashboard.favorited_by
        self.login_as(user=self.user_1)
        with self.feature({"organizations:dashboards-favourite": True}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"isFavorited": False}
            )
            assert response.status_code == 204
            assert self.user_1.id not in self.dashboard.favorited_by

    def test_favorite_dashboard_no_dashboard_edit_access(self):
        DashboardPermissions.objects.create(is_editable_by_everyone=False, dashboard=self.dashboard)
        self.login_as(user=self.user_2)
        dashboard_detail_url = reverse(
            "sentry-api-0-organization-dashboard-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
            },
        )
        with self.feature({"organizations:dashboards-edit-access": True}):
            response = self.do_request(
                "put", dashboard_detail_url, data={"title": "New Dashboard 9"}
            )
            # assert user cannot edit dashboard
            assert response.status_code == 403

        # assert if user can edit the favorite status of the dashboard
        assert self.user_2.id in self.dashboard.favorited_by
        with self.feature({"organizations:dashboards-favourite": True}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"isFavorited": False}
            )
            assert response.status_code == 204
            assert self.user_2.id not in self.dashboard.favorited_by
