from __future__ import annotations

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
    InvestigationProject,
    InvestigationStatus,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationsDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_detail_is_scoped_to_organization(self) -> None:
        other_organization = self.create_organization()
        foreign = self.create_investigation(
            organization=other_organization, created_by=self.user, title="Foreign"
        )
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": foreign.id,
            },
        )
        assert self.client.get(url).status_code == 404

    def test_archive_restore_and_list_filters(self) -> None:
        first = self.client.post(
            self.collection_url, data={"title": "Checkout investigation"}, format="json"
        ).data
        self.client.post(
            self.collection_url, data={"title": "Payments investigation"}, format="json"
        )
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": first["id"],
            },
        )

        response = self.client.delete(
            detail_url,
            data={"investigationVersion": first["version"]},
            format="json",
        )
        assert response.status_code == 204
        response = self.client.get(f"{self.collection_url}?query=Checkout")
        assert response.data == []
        response = self.client.get(self.collection_url, {"status": "archived"})
        assert [item["id"] for item in response.data] == [first["id"]]

        archived = self.client.get(detail_url).data
        response = self.client.put(
            detail_url,
            data={"investigationVersion": archived["version"], "status": "active"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "active"

    def test_metadata_update_persists_and_stale_version_rolls_back(self) -> None:
        created = self.client.post(
            self.collection_url,
            data={"title": "Before", "projectIds": [self.project.id]},
            format="json",
        ).data
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": created["id"],
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": created["version"],
                "title": "After",
                "filters": {"environment": ["production"]},
                "projectIds": [],
            },
            format="json",
        )
        assert response.status_code == 200
        assert response.data["title"] == "After"
        assert response.data["filters"] == {"environment": ["production"]}
        assert response.data["projectIds"] == []

        response = self.client.put(
            url,
            data={"investigationVersion": created["version"], "title": "Stale write"},
            format="json",
        )
        assert response.status_code == 409
        investigation = Investigation.objects.get(id=created["id"])
        assert investigation.title == "After"

    def archived_investigation(self) -> Investigation:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Archived"
        )
        self.create_investigation_project(investigation=investigation, project=self.project)
        Investigation.objects.filter(id=investigation.id).update(
            status=InvestigationStatus.ARCHIVED
        )
        investigation.refresh_from_db()
        return investigation

    def details_url(self, investigation: Investigation) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

    def test_restoring_an_archived_investigation_cannot_also_change_projects(self) -> None:
        investigation = self.archived_investigation()
        other_project = self.create_project(organization=self.organization)

        response = self.client.put(
            self.details_url(investigation),
            data={
                "investigationVersion": investigation.version,
                "status": "active",
                "projectIds": [other_project.id],
            },
            format="json",
        )

        assert response.status_code == 400
        investigation.refresh_from_db()
        assert investigation.status == InvestigationStatus.ARCHIVED
        assert list(
            InvestigationProject.objects.filter(investigation=investigation).values_list(
                "project_id", flat=True
            )
        ) == [self.project.id]

    def test_restoring_an_archived_investigation_by_status_alone_is_allowed(self) -> None:
        investigation = self.archived_investigation()

        response = self.client.put(
            self.details_url(investigation),
            data={"investigationVersion": investigation.version, "status": "active"},
            format="json",
        )

        assert response.status_code == 200, response.data
        investigation.refresh_from_db()
        assert investigation.status == InvestigationStatus.ACTIVE

    def test_archived_investigations_reject_other_edits(self) -> None:
        investigation = self.archived_investigation()

        response = self.client.put(
            self.details_url(investigation),
            data={"investigationVersion": investigation.version, "title": "Renamed"},
            format="json",
        )

        assert response.status_code == 400
        investigation.refresh_from_db()
        assert investigation.title == "Archived"
