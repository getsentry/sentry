from __future__ import annotations

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
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
