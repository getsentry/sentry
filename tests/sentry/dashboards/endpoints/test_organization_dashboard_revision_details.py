from __future__ import annotations

from django.urls import reverse

from sentry.models.dashboard import DashboardRevision
from sentry.testutils.cases import APITestCase


class OrganizationDashboardRevisionDetailsTestCase(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.dashboard = self.create_dashboard(
            title="Dashboard 1",
            created_by=self.user,
            organization=self.organization,
        )
        self.revision = DashboardRevision.objects.create(
            dashboard=self.dashboard,
            created_by_id=self.user.id,
            title="Dashboard 1",
            source="edit",
            snapshot={"id": str(self.dashboard.id), "title": "Dashboard 1", "widgets": []},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )
        self.url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
                "revision_id": self.revision.id,
            },
        )


class GetOrganizationDashboardRevisionDetailsTest(OrganizationDashboardRevisionDetailsTestCase):
    def test_returns_404_without_feature_flag(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_returns_snapshot_with_expected_fields(self) -> None:
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["id"] == str(self.dashboard.id)
        assert response.data["title"] == "Dashboard 1"
        assert response.data["widgets"] == []

    def test_returns_422_for_old_schema_version(self) -> None:
        old_revision = DashboardRevision.objects.create(
            dashboard=self.dashboard,
            created_by_id=self.user.id,
            title="Dashboard 1",
            source="edit",
            snapshot={"id": str(self.dashboard.id), "title": "Dashboard 1", "widgets": []},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION - 1,
        )
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
                "revision_id": old_revision.id,
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(url)

        assert response.status_code == 422

    def test_returns_404_for_non_integer_revision_id(self) -> None:
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
                "revision_id": "abc",
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(url)

        assert response.status_code == 404

    def test_returns_404_for_nonexistent_revision(self) -> None:
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
                "revision_id": 99999,
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(url)

        assert response.status_code == 404

    def test_returns_404_for_prebuilt_dashboard(self) -> None:
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": "default-overview",
                "revision_id": self.revision.id,
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(url)

        assert response.status_code == 404

    def test_returns_404_for_revision_belonging_to_different_dashboard(self) -> None:
        other_dashboard = self.create_dashboard(
            title="Other Dashboard",
            created_by=self.user,
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
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": self.dashboard.id,
                "revision_id": other_revision.id,
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(url)

        assert response.status_code == 404

    def test_returns_404_for_dashboard_belonging_to_different_org(self) -> None:
        other_org = self.create_organization()
        other_dashboard = self.create_dashboard(
            title="Other Org Dashboard",
            created_by=self.user,
            organization=other_org,
        )
        other_revision = DashboardRevision.objects.create(
            dashboard=other_dashboard,
            created_by_id=self.user.id,
            title="Other Org Dashboard",
            source="edit",
            snapshot={},
            snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
        )
        url = reverse(
            "sentry-api-0-organization-dashboard-revision-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "dashboard_id": other_dashboard.id,
                "revision_id": other_revision.id,
            },
        )
        with self.feature("organizations:dashboards-revisions"):
            response = self.client.get(url)

        assert response.status_code == 404
