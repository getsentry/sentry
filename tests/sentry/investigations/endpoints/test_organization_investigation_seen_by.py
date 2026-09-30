from __future__ import annotations

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationSeenByTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )

    def url(self, organization_slug: str) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-seen-by",
            kwargs={
                "organization_id_or_slug": organization_slug,
                "investigation_id": self.investigation.id,
            },
        )

    def test_most_recent_first(self) -> None:
        other = self.create_user()
        now = timezone.now()
        self.create_investigation_seen(
            investigation=self.investigation, user=self.user, last_seen=now - timedelta(hours=1)
        )
        self.create_investigation_seen(investigation=self.investigation, user=other, last_seen=now)

        response = self.client.get(self.url(self.organization.slug))

        assert response.status_code == 200
        assert [(v["id"], v["lastSeen"]) for v in response.data] == [
            (str(other.id), now),
            (str(self.user.id), now - timedelta(hours=1)),
        ]

    def test_empty_when_nobody_has_opened_it(self) -> None:
        response = self.client.get(self.url(self.organization.slug))

        assert response.data == []

    def test_other_organization_cannot_read(self) -> None:
        other_org = self.create_organization()

        response = self.client.get(self.url(other_org.slug))

        assert response.status_code in (403, 404)
