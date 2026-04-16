from __future__ import annotations

from django.urls import reverse

from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.testutils.cases import APITestCase


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
