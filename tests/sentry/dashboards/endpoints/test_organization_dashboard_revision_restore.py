from __future__ import annotations

from django.urls import reverse

from sentry.dashboards.endpoints.organization_dashboard_revision_restore import (
    _prepare_restore_data,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.testutils.cases import APITestCase


class TestPrepareRestoreData:
    def test_strips_widget_ids(self) -> None:
        snapshot = {"widgets": [{"id": 1, "title": "Widget"}, {"id": 2, "title": "Other"}]}
        result = _prepare_restore_data(snapshot)
        for widget in result["widgets"]:
            assert "id" not in widget

    def test_strips_query_ids(self) -> None:
        snapshot = {
            "widgets": [
                {
                    "id": 1,
                    "queries": [{"id": 10, "fields": ["count()"], "conditions": ""}],
                }
            ]
        }
        result = _prepare_restore_data(snapshot)
        assert "id" not in result["widgets"][0]
        assert "id" not in result["widgets"][0]["queries"][0]
        assert result["widgets"][0]["queries"][0]["fields"] == ["count()"]

    def test_no_widgets_key(self) -> None:
        snapshot = {"title": "Dashboard"}
        result = _prepare_restore_data(snapshot)
        assert result == {"title": "Dashboard"}


class OrganizationDashboardRevisionRestoreTestCase(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1",
            created_by_id=self.user.id,
            organization=self.organization,
        )

    def _url(self, revision_id: int | str) -> str:
        return reverse(
            "sentry-api-0-organization-dashboard-revision-restore",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
                "revision_id": revision_id,
            },
        )

    def _create_revision(
        self, snapshot: dict | None = None, title: str = "Dashboard 1"
    ) -> DashboardRevision:
        return DashboardRevision.objects.create(
            dashboard=self.dashboard,
            created_by_id=self.user.id,
            title=title,
            source="edit",
            snapshot=snapshot or {},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )


class PostOrganizationDashboardRevisionRestoreTest(OrganizationDashboardRevisionRestoreTestCase):
    def test_returns_404_without_feature_flag(self) -> None:
        revision = self._create_revision()
        response = self.client.post(self._url(revision.id))
        assert response.status_code == 404

    def test_returns_404_for_prebuilt_dashboard(self) -> None:
        revision = self._create_revision()
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-restore",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": "default-overview",
                "revision_id": revision.id,
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(url)

        assert response.status_code == 404

    def test_returns_404_for_nonexistent_revision(self) -> None:
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(99999))

        assert response.status_code == 404

    def test_returns_404_for_revision_from_different_dashboard(self) -> None:
        other_dashboard = Dashboard.objects.create(
            title="Other Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        other_revision = DashboardRevision.objects.create(
            dashboard=other_dashboard,
            created_by_id=self.user.id,
            title="Other Dashboard",
            source="edit",
            snapshot={},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(other_revision.id))

        assert response.status_code == 404

    def test_restores_dashboard_title_from_revision(self) -> None:
        revision = self._create_revision(
            snapshot={"title": "Old Title", "widgets": []},
            title="Old Title",
        )

        self.dashboard.title = "New Title"
        self.dashboard.save()

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 200
        assert response.data["title"] == "Old Title"

        self.dashboard.refresh_from_db()
        assert self.dashboard.title == "Old Title"

    def test_creates_pre_restore_snapshot(self) -> None:
        revision = self._create_revision(snapshot={"title": "Old Title", "widgets": []})

        initial_revision_count = DashboardRevision.objects.filter(dashboard=self.dashboard).count()

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 200

        new_revisions = DashboardRevision.objects.filter(dashboard=self.dashboard).order_by(
            "-date_added"
        )
        assert new_revisions.count() == initial_revision_count + 1
        newest = new_revisions.first()
        assert newest is not None
        assert newest.source == "pre-restore"

    def test_returns_updated_dashboard(self) -> None:
        revision = self._create_revision(
            snapshot={"title": "Restored Title", "widgets": [], "projects": []}
        )

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 200
        assert "id" in response.data
        assert "title" in response.data
        assert "widgets" in response.data

    def test_returns_400_for_unsupported_schema_version(self) -> None:
        revision = DashboardRevision.objects.create(
            dashboard=self.dashboard,
            created_by_id=self.user.id,
            title="Dashboard 1",
            source="edit",
            snapshot={},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION + 1,
        )

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 400
        assert "detail" in response.data

    def test_returns_403_when_user_lacks_edit_permission(self) -> None:
        DashboardPermissions.objects.create(
            is_editable_by_everyone=False,
            dashboard=self.dashboard,
        )
        revision = self._create_revision(snapshot={"title": "Dashboard 1", "widgets": []})

        other_user = self.create_user()
        self.create_member(user=other_user, organization=self.organization, role="member")
        self.login_as(other_user)

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 403

    def test_returns_409_when_restored_title_conflicts_with_another_dashboard(self) -> None:
        Dashboard.objects.create(
            title="Conflicting Title",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        revision = self._create_revision(
            snapshot={"title": "Conflicting Title", "widgets": []},
            title="Conflicting Title",
        )

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 409
        assert "detail" in response.data

    def test_widget_ids_are_not_reused_after_restore(self) -> None:
        snapshot_widget_id = 999999
        revision = self._create_revision(
            snapshot={
                "title": "Dashboard 1",
                "widgets": [
                    {
                        "id": snapshot_widget_id,
                        "title": "Widget",
                        "displayType": "table",
                        "interval": "5m",
                        "queries": [
                            {
                                "name": "",
                                "fields": ["count()"],
                                "columns": [],
                                "aggregates": ["count()"],
                                "conditions": "",
                                "orderby": "",
                            }
                        ],
                        "widgetType": "error-events",
                        "order": 0,
                    }
                ],
            }
        )

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.post(self._url(revision.id))

        assert response.status_code == 200
        assert len(response.data["widgets"]) == 1
        assert response.data["widgets"][0]["id"] != str(snapshot_widget_id)
