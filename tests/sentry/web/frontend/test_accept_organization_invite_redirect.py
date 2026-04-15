from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AcceptOrganizationInviteRedirectViewTest(TestCase):
    def test_redirects_legacy_invite_to_org_scoped_route(self) -> None:
        organization = self.create_organization()
        member = self.create_member(
            organization=organization, email="newuser@example.com", token="abc"
        )

        response = self.client.get(
            reverse("sentry-accept-invite", args=[member.id, member.token]) + "?referrer=email"
        )

        assert response.status_code == 302
        assert response["Location"] == (
            reverse(
                "sentry-organization-accept-invite",
                kwargs={
                    "organization_slug": organization.slug,
                    "member_id": member.id,
                    "token": member.token,
                },
            )
            + "?referrer=email"
        )

    def test_invalid_token_does_not_leak_org_slug(self) -> None:
        organization = self.create_organization()
        member = self.create_member(organization=organization, email="newuser@example.com")

        response = self.client.get(
            reverse("sentry-accept-invite", args=[member.id, "invalidtoken"])
        )

        assert response.status_code == 404

    def test_unresolved_legacy_invite_returns_404(self) -> None:
        response = self.client.get(reverse("sentry-accept-invite", args=[123456, "invalidtoken"]))

        assert response.status_code == 404
