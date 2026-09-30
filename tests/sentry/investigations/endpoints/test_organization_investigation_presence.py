from __future__ import annotations

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationPresenceTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.url = reverse(
            "sentry-api-0-organization-investigation-presence",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def test_lists_current_viewers_most_recent_first(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other, role="member")

        self.login_as(self.user)
        response = self.client.put(self.url)
        assert response.status_code == 200
        assert response.data == {"viewerIds": [str(self.user.id)]}

        self.login_as(other)
        response = self.client.put(self.url)
        assert response.data == {"viewerIds": [str(other.id), str(self.user.id)]}

    def test_other_organization_cannot_heartbeat(self) -> None:
        self.login_as(self.user)
        other_org = self.create_organization()
        url = reverse(
            "sentry-api-0-organization-investigation-presence",
            kwargs={
                "organization_id_or_slug": other_org.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(url)

        assert response.status_code in (403, 404)
