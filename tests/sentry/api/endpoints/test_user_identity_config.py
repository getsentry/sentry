from sentry.models import AuthIdentity, AuthProvider, Identity, IdentityProvider
from sentry.testutils import APITestCase
from social_auth.models import UserSocialAuth


class UserIdentityConfigTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.slack_idp = IdentityProvider.objects.create(type="slack", external_id="S", config={})
        self.github_idp = IdentityProvider.objects.create(type="github", external_id="G", config={})

        self.org_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )

        self.login_as(self.user)


class UserIdentityConfigEndpointTest(UserIdentityConfigTest):
    endpoint = "sentry-api-0-user-identity-config"
    method = "get"

    def test_simple(self):
        UserSocialAuth.objects.create(provider="github", user=self.user)
        Identity.objects.create(user=self.user, idp=self.github_idp)
        AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)

        response = self.get_success_response(self.user.id, status_code=200)

        identities = {(obj["category"], obj["providerName"]): obj for obj in response.data}
        assert len(identities) == 3

        social_ident = identities[("social-identity", "GitHub")]
        assert social_ident["status"] == "can_disconnect"
        assert social_ident["organization"] is None

        global_ident = identities[("global-identity", "GitHub")]
        assert global_ident["status"] == "can_disconnect"
        assert global_ident["organization"] is None

        org_ident = identities[("org-identity", "Dummy")]
        assert org_ident["status"] == "needed_for_org_auth"
        assert org_ident["organization"]["id"] == str(self.organization.id)

    def test_identity_needed_for_global_auth(self):
        self.user.update(password="")
        ident = Identity.objects.create(user=self.user, idp=self.github_idp)
        self.login_as(self.user)

        response = self.get_success_response(self.user.id, status_code=200)
        (identity,) = response.data
        assert identity["status"] == "needed_for_global_auth"

        # A second identity should flip both to can_disconnect
        another_ident = Identity.objects.create(user=self.user, idp=self.slack_idp)
        response = self.get_success_response(self.user.id, status_code=200)
        assert len(response.data) == 2
        for identity in response.data:
            assert identity["status"] == "can_disconnect"

        # Deleting the first should flip the second to needed
        ident.delete()
        response = self.get_success_response(self.user.id, status_code=200)
        (identity,) = response.data
        assert identity["id"] == str(another_ident.id)
        assert identity["status"] == "needed_for_global_auth"

    def test_org_identity_can_be_deleted_if_not_required(self):
        self.org_provider.flags.allow_unlinked = True
        self.org_provider.save()

        AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)
        self.login_as(self.user)

        response = self.get_success_response(self.user.id, status_code=200)
        (identity,) = response.data
        assert identity["category"] == "org-identity"
        assert identity["status"] == "can_disconnect"

    def test_org_identity_used_for_global_auth(self):
        self.org_provider.flags.allow_unlinked = True
        self.org_provider.save()

        self.user.update(password="")
        AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)
        self.login_as(self.user)

        response = self.get_success_response(self.user.id, status_code=200)
        (identity,) = response.data
        assert identity["category"] == "org-identity"
        assert identity["status"] == "needed_for_global_auth"


class UserIdentityConfigDetailsEndpointGetTest(UserIdentityConfigTest):
    endpoint = "sentry-api-0-user-identity-config-details"
    method = "get"

    def test_get(self):
        social_obj = UserSocialAuth.objects.create(provider="github", user=self.user)
        global_obj = Identity.objects.create(user=self.user, idp=self.github_idp)
        org_obj = AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)

        social_ident = self.get_success_response(
            self.user.id, "social-identity", str(social_obj.id), status_code=200
        ).data
        assert social_ident["id"] == str(social_obj.id)
        assert social_ident["category"] == "social-identity"
        assert social_ident["status"] == "can_disconnect"
        assert social_ident["organization"] is None

        global_ident = self.get_success_response(
            self.user.id, "global-identity", str(global_obj.id), status_code=200
        ).data
        assert global_ident["id"] == str(global_obj.id)
        assert global_ident["category"] == "global-identity"
        assert global_ident["status"] == "can_disconnect"
        assert global_ident["organization"] is None

        org_ident = self.get_success_response(
            self.user.id, "org-identity", str(org_obj.id), status_code=200
        ).data
        assert org_ident["id"] == str(org_obj.id)
        assert org_ident["category"] == "org-identity"
        assert org_ident["status"] == "needed_for_org_auth"
        assert org_ident["organization"]["id"] == str(self.organization.id)

    def test_enforces_ownership_by_user(self):
        another_user = self.create_user()
        their_identity = Identity.objects.create(user=another_user, idp=self.github_idp)

        self.get_error_response(
            self.user.id, "global-identity", str(their_identity.id), status_code=404
        )


class UserIdentityConfigDetailsEndpointDeleteTest(UserIdentityConfigTest):
    endpoint = "sentry-api-0-user-identity-config-details"
    method = "delete"

    def test_delete(self):
        self.org_provider.flags.allow_unlinked = True
        self.org_provider.save()

        social_obj = UserSocialAuth.objects.create(provider="github", user=self.user)
        global_obj = Identity.objects.create(user=self.user, idp=self.github_idp)
        org_obj = AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)

        self.get_success_response(
            self.user.id, "social-identity", str(social_obj.id), status_code=204
        )
        assert not UserSocialAuth.objects.filter(id=social_obj.id).exists()

        self.get_success_response(
            self.user.id, "global-identity", str(global_obj.id), status_code=204
        )
        assert not Identity.objects.filter(id=global_obj.id).exists()

        self.get_success_response(self.user.id, "org-identity", str(org_obj.id), status_code=204)
        assert not AuthIdentity.objects.filter(id=org_obj.id).exists()

    def test_enforces_ownership_by_user(self):
        another_user = self.create_user()
        their_identity = Identity.objects.create(user=another_user, idp=self.github_idp)

        self.get_error_response(
            self.user.id, "global-identity", str(their_identity.id), status_code=404
        )
        assert Identity.objects.get(id=their_identity.id)

    def test_enforces_needed_for_org_access(self):
        ident_obj = AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)
        self.get_error_response(self.user.id, "org-identity", str(ident_obj.id), status_code=405)
        assert AuthIdentity.objects.get(id=ident_obj.id)

    def test_enforces_global_ident_needed_for_login(self):
        self.user.update(password="")
        self.login_as(self.user)

        ident_obj = Identity.objects.create(user=self.user, idp=self.github_idp)
        self.get_error_response(self.user.id, "global-identity", str(ident_obj.id), status_code=405)
        assert Identity.objects.get(id=ident_obj.id)

    def test_enforces_org_ident_needed_for_login(self):
        self.org_provider.flags.allow_unlinked = True
        self.org_provider.save()

        self.user.update(password="")
        ident_obj = AuthIdentity.objects.create(user=self.user, auth_provider=self.org_provider)
        self.login_as(self.user)

        self.get_error_response(self.user.id, "org-identity", str(ident_obj.id), status_code=405)
        assert AuthIdentity.objects.get(id=ident_obj.id)
