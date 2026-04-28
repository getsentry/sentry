from __future__ import annotations

from django.urls import reverse

from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.testutils.cases import APITestCase
from sentry.utils.avatar import get_gravatar_url


class OrganizationDashboardRevisionsTestCase(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        self.url = reverse(
            "sentry-api-0-organization-dashboard-revisions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
            },
        )

    def _create_revision(self, title: str = "Dashboard 1") -> DashboardRevision:
        return DashboardRevision.objects.create(
            dashboard=self.dashboard,
            created_by_id=self.user.id,
            title=title,
            source="edit",
            snapshot={},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )


class GetOrganizationDashboardRevisionsTest(OrganizationDashboardRevisionsTestCase):
    def test_returns_404_without_feature_flag(self) -> None:
        self._create_revision()
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_returns_empty_list_when_no_revisions(self) -> None:
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data == []

    def test_returns_revisions_with_expected_fields(self) -> None:
        revision = self._create_revision()
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 1
        data = response.data[0]
        assert data["id"] == str(revision.id)
        assert data["title"] == "Dashboard 1"
        assert data["source"] == "edit"
        assert data["createdBy"] == {
            "id": str(self.user.id),
            "name": self.user.get_display_name(),
            "email": self.user.email,
            "avatarUrl": get_gravatar_url(self.user.email, size=32),
        }
        assert "dateCreated" in data

    def test_returns_revisions_newest_first(self) -> None:
        first = self._create_revision(title="First")
        second = self._create_revision(title="Second")

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(second.id)
        assert response.data[1]["id"] == str(first.id)

    def test_returns_404_for_prebuilt_dashboard(self) -> None:
        prebuilt_url = reverse(
            "sentry-api-0-organization-dashboard-revisions",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": "default-overview",
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(prebuilt_url)

        assert response.status_code == 404

    def test_returns_revisions_scoped_to_dashboard(self) -> None:
        other_dashboard = Dashboard.objects.create(
            title="Other Dashboard",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardRevision.objects.create(
            dashboard=other_dashboard,
            created_by_id=self.user.id,
            title="Other Dashboard",
            source="edit",
            snapshot={},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )
        revision = self._create_revision()

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(revision.id)

    def test_null_created_by_when_user_deleted(self) -> None:
        DashboardRevision.objects.create(
            dashboard=self.dashboard,
            created_by_id=None,
            title="Dashboard 1",
            source="edit",
            snapshot={},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )

        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["createdBy"] is None
