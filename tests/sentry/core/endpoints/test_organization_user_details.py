from sentry.testutils.cases import APITestCase


class OrganizationUserDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-details"

    def setUp(self) -> None:
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.member = self.create_member(organization=self.org, user=self.user)

        self.login_as(user=self.owner_user)

    def test_gets_info_for_user_in_org(self) -> None:
        response = self.get_success_response(self.org.slug, self.user.id)

        assert response.data["id"] == str(self.user.id)
        assert response.data["email"] == self.user.email

    def test_cannot_access_info_if_user_not_in_org(self) -> None:
        user = self.create_user("meep@localhost", username="meep")

        self.get_error_response(self.org.slug, user.id, status_code=404)

    def test_bad_user_id(self) -> None:
        self.get_error_response(self.org.slug, 123, status_code=404)
        self.get_error_response(self.org.slug, "not_valid", status_code=400)

    def test_does_not_expose_secondary_emails(self) -> None:
        """VULN-720: secondary emails should not be visible to other org members."""
        self.create_useremail(self.owner_user, email="secondary@example.com", is_verified=True)

        # Request as a regular member, not the owner themselves
        self.login_as(user=self.user)
        response = self.get_success_response(self.org.slug, self.owner_user.id)

        assert response.data["email"] == self.owner_user.email
        assert response.data["emails"] == []
