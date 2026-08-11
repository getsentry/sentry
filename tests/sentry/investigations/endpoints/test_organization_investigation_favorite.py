from __future__ import annotations

from django.urls import reverse

from sentry.investigations.models import InvestigationFavoriteUser
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationsFavoriteTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_favorite_is_user_specific_and_returned_in_list(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Star me"
        )
        favorite_url = reverse(
            "sentry-api-0-organization-investigation-favorite",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.put(favorite_url, data={"shouldFavorite": True}, format="json")
        assert response.status_code == 204
        assert InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=self.user.id
        ).exists()
        assert self.client.get(self.collection_url).data[0]["isFavorited"] is True

        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, role="member")
        self.login_as(other_user)
        assert self.client.get(self.collection_url).data[0]["isFavorited"] is False

        self.login_as(self.user)
        response = self.client.put(favorite_url, data={"shouldFavorite": False}, format="json")
        assert response.status_code == 204
        assert not InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=self.user.id
        ).exists()

    def test_read_only_viewer_can_favorite_an_investigation(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Read only"
        )
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        self.login_as(viewer)
        favorite_url = reverse(
            "sentry-api-0-organization-investigation-favorite",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.put(favorite_url, data={"shouldFavorite": True}, format="json")

        assert response.status_code == 204
        assert InvestigationFavoriteUser.objects.filter(
            investigation=investigation, user_id=viewer.id
        ).exists()
