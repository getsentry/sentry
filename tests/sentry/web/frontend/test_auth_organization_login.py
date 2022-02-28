from unittest import mock
from urllib.parse import urlencode

from django.test import override_settings
from django.urls import reverse
from exam import fixture

from sentry.auth.authenticators import RecoveryCodeInterface, TotpInterface
from sentry.models import (
    AuthIdentity,
    AuthProvider,
    OrganizationMember,
    OrganizationOption,
    UserEmail,
)
from sentry.testutils import AuthProviderTestCase
from sentry.testutils.helpers import with_feature
from sentry.utils import json


# TODO(dcramer): this is an integration test and repeats tests from
# core auth_login
class OrganizationAuthLoginTest(AuthProviderTestCase):
    @fixture
    def organization(self):
        return self.create_organization(name="foo", owner=self.user)

    @fixture
    def path(self):
        return reverse("sentry-auth-organization", args=[self.organization.slug])

    def test_renders_basic(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/organization-login.html")

        assert resp.context["login_form"]
        assert resp.context["organization"] == self.organization
        assert "provider_key" not in resp.context
        assert resp.context["join_request_link"]

    def test_cannot_get_request_join_link_with_setting_disabled(self):
        OrganizationOption.objects.create(
            organization_id=self.organization.id, key="sentry:join_requests", value=False
        )

        self.login_as(self.user)
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        assert resp.context["join_request_link"] is None

    def test_renders_session_expire_message(self):
        self.client.cookies["session_expired"] = "1"
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/organization-login.html")
        assert len(resp.context["messages"]) == 1

    def test_flow_as_anonymous(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": "foo@example.com"})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200

        frontend_events = {"event_name": "Sign Up", "event_label": "dummy"}
        marketing_query = urlencode({"frontend_events": json.dumps(frontend_events)})

        with self.settings(
            TERMS_URL="https://example.com/terms", PRIVACY_URL="https://example.com/privacy"
        ):
            resp = self.client.post(path, {"op": "newuser"}, follow=True)
            assert resp.redirect_chain == [
                (reverse("sentry-login") + f"?{marketing_query}", 302),
                ("/organizations/foo/issues/", 302),
            ]

        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)

        user = auth_identity.user
        assert user.email == "foo@example.com"
        assert not user.has_usable_password()
        assert not user.is_managed
        assert user.flags.newsletter_consent_prompt

        member = OrganizationMember.objects.get(organization=self.organization, user=user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_as_existing_user_with_new_account(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("bar@example.com")

        self.login_as(user)
        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": "foo@example.com"})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200

        resp = self.client.post(path, {"op": "confirm"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert user == auth_identity.user

        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_as_existing_user_with_new_account_member_limit(self):
        with self.feature({"organizations:invite-members": False}):
            auth_provider = AuthProvider.objects.create(
                organization=self.organization, provider="dummy"
            )
            user = self.create_user("bar@example.com")

            self.login_as(user)
            resp = self.client.post(self.path, {"init": True})

            assert resp.status_code == 200
            assert self.provider.TEMPLATE in resp.content.decode("utf-8")

            path = reverse("sentry-auth-sso")

            resp = self.client.post(path, {"email": "foo@example.com"})

            self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
            assert resp.status_code == 200

            resp = self.client.post(path, {"op": "confirm"}, follow=True)
            assert resp.redirect_chain == [
                (reverse("sentry-login"), 302),
                ("/organizations/foo/issues/", 302),
                ("/organizations/foo/disabled-member/", 302),
            ]

            auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
            assert user == auth_identity.user

            member = OrganizationMember.objects.get(organization=self.organization, user=user)
            assert getattr(member.flags, "sso:linked")
            assert not getattr(member.flags, "sso:invalid")
            assert getattr(member.flags, "member-limit:restricted")

    def test_flow_as_existing_identity(self):
        user = self.create_user("bar@example.com")
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        AuthIdentity.objects.create(auth_provider=auth_provider, user=user, ident="foo@example.com")

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")
        resp = self.client.post(path, {"email": "foo@example.com"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

    def test_flow_as_existing_identity_superuser_granted(self):
        from sentry.auth.superuser import COOKIE_NAME, Superuser

        with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
            SUPERUSER_ORG_ID=self.organization.id
        ):
            user = self.create_user("bar@example.com", is_superuser=True)
            auth_provider = AuthProvider.objects.create(
                organization=self.organization, provider="dummy"
            )

            AuthIdentity.objects.create(
                auth_provider=auth_provider, user=user, ident="foo@example.com"
            )

            resp = self.client.post(self.path, {"init": True})

            assert resp.status_code == 200

            path = reverse("sentry-auth-sso")
            resp = self.client.post(path, {"email": "foo@example.com"})
            # if the superuser session is active we'll set a signed cookie
            assert COOKIE_NAME in resp.cookies

    def test_flow_as_unauthenticated_existing_matched_user_no_merge(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("bar@example.com")

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")
        resp = self.client.post(path, {"email": user.email})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == user
        assert resp.context["login_form"]

        frontend_events = {"event_name": "Sign Up", "event_label": "dummy"}
        marketing_query = urlencode({"frontend_events": json.dumps(frontend_events)})

        resp = self.client.post(path, {"op": "newuser"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login") + f"?{marketing_query}", 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        new_user = auth_identity.user
        assert user.email == "bar@example.com"
        assert new_user != user

        # Without settings.TERMS_URL and settings.PRIVACY_URL, this should be
        # unset following new user creation
        assert not new_user.flags.newsletter_consent_prompt

        member = OrganizationMember.objects.get(organization=self.organization, user=new_user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_as_unauthenticated_existing_matched_user_with_merge(self):
        user = self.create_user("bar@example.com")

        user.update(is_superuser=False)
        org1 = self.create_organization(name="bar", owner=user)
        path = reverse("sentry-auth-organization", args=[org1.slug])
        # create a second org that the user belongs to, ensure they are redirected to correct
        self.create_organization(name="zap", owner=user)

        auth_provider = AuthProvider.objects.create(organization=org1, provider="dummy")

        email = user.emails.all()[:1].get()
        email.is_verified = False
        email.save()

        resp = self.client.post(path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": user.email})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == user
        assert resp.context["login_form"]

        resp = self.client.post(
            path, {"op": "login", "username": user.username, "password": "admin"}
        )

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200

        resp = self.client.post(path, {"op": "confirm"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            (f"/organizations/{org1.slug}/issues/", 302),
        ]
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(organization=org1, user=user)
        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_as_unauthenticated_existing_matched_user_via_secondary_email(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("foo@example.com")
        UserEmail.objects.create(user=user, email="bar@example.com", is_verified=True)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")
        resp = self.client.post(path, {"email": user.email})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == user
        assert resp.context["login_form"]

        resp = self.client.post(
            path, {"op": "login", "username": user.username, "password": "admin"}
        )

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200

        resp = self.client.post(path, {"op": "confirm"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(organization=self.organization, user=user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    @mock.patch("sentry.auth.helper.AuthIdentityHandler.warn_about_ambiguous_email")
    def test_flow_as_unauthenticated_existing_matched_user_with_ambiguous_email(self, mock_warning):
        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        secondary_email = "foo@example.com"
        users = {self.create_user() for _ in range(2)}
        for user in users:
            UserEmail.objects.create(user=user, email=secondary_email, is_verified=True)

        resp = self.client.post(self.path, {"init": True})
        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")
        resp = self.client.post(path, {"email": secondary_email})
        assert resp.status_code == 200

        assert mock_warning.called
        received_email, found_users, chosen_user = mock_warning.call_args.args
        assert received_email == secondary_email
        assert set(found_users) == users
        assert chosen_user in users

    def test_flow_as_unauthenticated_existing_unmatched_user_with_merge(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("foo@example.com")

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": "bar@example.com"})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200
        assert not resp.context["existing_user"]
        assert resp.context["login_form"]

        resp = self.client.post(
            path, {"op": "login", "username": user.username, "password": "admin"}
        )

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200

        resp = self.client.post(path, {"op": "confirm"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(organization=self.organization, user=user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_as_unauthenticated_existing_matched_user_with_merge_and_existing_identity(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("bar@example.com")

        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident="adfadsf@example.com"
        )

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": user.email})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == user
        assert resp.context["login_form"]

        resp = self.client.post(
            path, {"op": "login", "username": user.username, "password": "admin"}
        )

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200

        resp = self.client.post(path, {"op": "confirm"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(id=auth_identity.id)

        assert auth_identity.ident == user.email

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(organization=self.organization, user=user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_as_unauthenticated_existing_inactive_user_with_merge_and_existing_identity(self):
        """
        Given an unauthenticated user, and an existing, inactive user account
        with a linked identity, this should claim that identity and create
        a new user account.
        """
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("bar@example.com", is_active=False)

        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident="adfadsf@example.com"
        )

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": "adfadsf@example.com"})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-identity.html")
        assert resp.status_code == 200
        assert not resp.context["existing_user"]
        assert resp.context["login_form"]

        frontend_events = {"event_name": "Sign Up", "event_label": "dummy"}
        marketing_query = urlencode({"frontend_events": json.dumps(frontend_events)})

        resp = self.client.post(path, {"op": "newuser"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login") + f"?{marketing_query}", 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(id=auth_identity.id)

        assert auth_identity.ident == "adfadsf@example.com"

        new_user = auth_identity.user
        assert new_user != user

        member = OrganizationMember.objects.get(organization=self.organization, user=new_user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_duplicate_users_with_membership_and_verified(self):
        """
        Given an existing authenticated user, and an updated identity (e.g.
        the ident changed from the SSO provider), we should be re-linking
        the identity automatically (without prompt) assuming the user is
        a member of the org.

        This only works when the email is mapped to an identical identity.
        """
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user("bar@example.com", is_managed=True, is_active=False)
        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident="bar@example.com"
        )

        # they must be a member for the auto merge to happen
        self.create_member(organization=self.organization, user=user)

        # user needs to be logged in
        self.login_as(user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(
            path, {"email": "bar@example.com", "id": "123", "email_verified": "1"}, follow=True
        )
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
            ("/auth/login/foo/", 302),
        ]
        # there should be no prompt as we auto merge the identity

        auth_identity = AuthIdentity.objects.get(id=auth_identity.id)

        assert auth_identity.ident == "123"

        new_user = auth_identity.user
        assert new_user == user

        member = OrganizationMember.objects.get(organization=self.organization, user=new_user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    def test_flow_duplicate_users_without_verified(self):
        """
        Given an existing authenticated user, and an updated identity (e.g.
        the ident changed from the SSO provider), we should be re-linking
        the identity automatically (without prompt) assuming the user is
        a member of the org.
        """
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user("bar@example.com", is_managed=True)
        AuthIdentity.objects.create(auth_provider=auth_provider, user=user, ident="bar@example.com")

        # they must be a member for the auto merge to happen
        self.create_member(organization=self.organization, user=user)

        # user needs to be logged in
        self.login_as(user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(path, {"email": "adfadsf@example.com"})

        # there should be no prompt as we auto merge the identity
        assert resp.status_code == 200

    def test_flow_authenticated_without_verified_without_password(self):
        """
        Given an existing authenticated user, and an updated identity (e.g.
        the ident changed from the SSO provider), we should be re-linking
        the identity automatically as they don't have a password.
        This is specifically testing an unauthenticated flow.
        """
        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user("bar@example.com", is_managed=False, password="")
        assert not user.has_usable_password()
        UserEmail.objects.filter(user=user, email="bar@example.com").update(is_verified=False)
        self.create_member(organization=self.organization, user=user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": "bar@example.com"})
        self.assertTemplateUsed(resp, "sentry/auth-confirm-account.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == user

    def test_flow_managed_duplicate_users_without_membership(self):
        """
        Given an existing authenticated user, and an updated identity (e.g.
        the ident changed from the SSO provider), we should be prompting to
        confirm their identity as they don't have membership.
        """
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user("bar@example.com", is_managed=True)
        AuthIdentity.objects.create(auth_provider=auth_provider, user=user, ident="bar@example.com")

        # user needs to be logged in
        self.login_as(user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(path, {"email": "adfadsf@example.com", "email_verified": "1"})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == user

    def test_swapped_identities(self):
        """
        Given two existing user accounts with mismatched identities, such as:

        - foo SSO'd as bar@example.com
        - bar SSO'd as foo@example.com

        If bar is authenticating via SSO as bar@example.com, we should remove
        the existing entry attached to bar, and re-bind the entry owned by foo.
        """
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )

        # setup a 'previous' identity, such as when we migrated Google from
        # the old idents to the new
        user = self.create_user("bar@example.com", is_managed=True, is_active=False)
        identity1 = AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident="bar@example.com"
        )

        # create another identity which is used, but not by the authenticating
        # user
        user2 = self.create_user("adfadsf@example.com", is_managed=True, is_active=False)
        identity2 = AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user2, ident="adfadsf@example.com"
        )
        member2 = self.create_member(user=user2, organization=self.organization)

        # user needs to be logged in
        self.login_as(user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        # we're suggesting the identity changed (as if the Google ident was
        # updated to be something else)
        resp = self.client.post(path, {"email": "adfadsf@example.com"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
            ("/auth/login/foo/", 302),
        ]

        assert not AuthIdentity.objects.filter(id=identity1.id).exists()

        identity2 = AuthIdentity.objects.get(id=identity2.id)

        assert identity2.ident == "adfadsf@example.com"
        assert identity2.user == user

        member1 = OrganizationMember.objects.get(user=user, organization=self.organization)
        assert getattr(member1.flags, "sso:linked")
        assert not getattr(member1.flags, "sso:invalid")
        assert not getattr(member1.flags, "member-limit:restricted")

        member2 = OrganizationMember.objects.get(id=member2.id)
        assert not getattr(member2.flags, "sso:linked")
        assert getattr(member2.flags, "sso:invalid")
        assert not getattr(member2.flags, "member-limit:restricted")

    def test_flow_as_unauthenticated_existing_user_legacy_identity_migration(self):
        user = self.create_user("bar@example.com")
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user_ident = AuthIdentity.objects.create(
            auth_provider=auth_provider, user=user, ident="foo@example.com"
        )

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(
            path, {"email": "foo@new-domain.com", "legacy_email": "foo@example.com"}, follow=True
        )
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        # Ensure the ident was migrated from the legacy identity
        updated_ident = AuthIdentity.objects.get(id=user_ident.id)
        assert updated_ident.ident == "foo@new-domain.com"

    def test_flow_as_authenticated_user_with_invite_joining(self):
        auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        user = self.create_user("bar@example.com")
        member = self.create_member(email="bar@example.com", organization=self.organization)
        member.user = None
        member.save()
        self.login_as(user)
        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        path = reverse("sentry-auth-sso")

        resp = self.client.post(path, {"email": "bar@example.com"})

        self.assertTemplateUsed(resp, "sentry/auth-confirm-link.html")
        assert resp.status_code == 200

        resp = self.client.post(path, {"op": "confirm"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert user == auth_identity.user

        test_member = OrganizationMember.objects.get(organization=self.organization, user=user)
        assert member.id == test_member.id
        assert getattr(test_member.flags, "sso:linked")
        assert not getattr(test_member.flags, "sso:invalid")
        assert not getattr(test_member.flags, "member-limit:restricted")

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @with_feature({"organizations:create": False})
    def test_basic_auth_flow_as_invited_user(self):
        user = self.create_user("foor@example.com")
        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "foor@example.com"
        member.user = None
        member.save()

        self.session["_next"] = reverse(
            "sentry-organization-settings", args=[self.organization.slug]
        )
        self.save_session()

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )
        assert resp.redirect_chain == [("/auth/login/", 302)]
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, "sentry/no-organization-access.html")

    def test_basic_auth_flow_as_invited_user_not_single_org_mode(self):
        user = self.create_user("u2@example.com")
        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "u2@example.com"
        member.user = None
        member.save()
        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )
        assert resp.redirect_chain == [("/auth/login/", 302), ("/organizations/new/", 302)]

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @with_feature({"organizations:create": False})
    def test_basic_auth_flow_as_user_with_confirmed_membership(self):
        user = self.create_user("foor@example.com")
        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "foor@example.com"
        member.save()

        self.session["_next"] = reverse(
            "sentry-organization-settings", args=[self.organization.slug]
        )
        self.save_session()

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )
        assert resp.redirect_chain == [
            (reverse("sentry-organization-settings", args=[self.organization.slug]), 302),
        ]

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @with_feature({"organizations:create": False})
    def test_flow_as_user_without_any_membership(self):
        # not sure how this could happen on Single Org Mode
        user = self.create_user("foor@example.com")
        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )
        assert resp.redirect_chain == [("/auth/login/", 302)]
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, "sentry/no-organization-access.html")

    def test_multiorg_login_correct_redirect_basic_auth(self):
        user = self.create_user("bar@example.com")
        user.update(is_superuser=False)

        org1 = self.create_organization(name="bar", owner=user)
        path = reverse("sentry-auth-organization", args=[org1.slug])
        # create a second org that the user belongs to, ensure they are redirected to correct
        self.create_organization(name="zap", owner=user)

        self.client.get(path)
        resp = self.client.post(
            path,
            {"username": user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            (f"/organizations/{org1.slug}/issues/", 302),
        ]

    def test_multiorg_login_correct_redirect_sso(self):
        user = self.create_user("bar@example.com")
        user.update(is_superuser=False)

        org1 = self.create_organization(name="bar", owner=user)
        path = reverse("sentry-auth-organization", args=[org1.slug])
        # create a second org that the user belongs to, ensure they are redirected to correct
        self.create_organization(name="zap", owner=user)

        auth_provider = AuthProvider.objects.create(organization=org1, provider="dummy")
        AuthIdentity.objects.create(auth_provider=auth_provider, user=user, ident="foo@example.com")

        resp = self.client.post(path, {"init": True})

        path = reverse("sentry-auth-sso")
        resp = self.client.post(path, {"email": "foo@example.com"}, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            (f"/organizations/{org1.slug}/issues/", 302),
        ]

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @with_feature({"organizations:create": False})
    def test_correct_redirect_as_2fa_user_single_org_invited(self):
        user = self.create_user("foor@example.com")

        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)

        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "foor@example.com"
        member.user = None
        member.save()

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )

        assert resp.redirect_chain == [("/auth/2fa/", 302)]

    def test_correct_redirect_as_2fa_user_invited(self):
        user = self.create_user("foor@example.com")

        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)

        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "foor@example.com"
        member.user = None
        member.save()

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )

        assert resp.redirect_chain == [("/auth/2fa/", 302)]

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @with_feature({"organizations:create": False})
    def test_correct_redirect_as_2fa_user_single_org_no_membership(self):
        user = self.create_user("foor@example.com")

        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )

        assert resp.redirect_chain == [("/auth/2fa/", 302)]

    def test_correct_redirect_as_2fa_user_no_membership(self):
        user = self.create_user("foor@example.com")

        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )

        assert resp.redirect_chain == [("/auth/2fa/", 302)]

    @override_settings(SENTRY_SINGLE_ORGANIZATION=True)
    @with_feature({"organizations:create": False})
    def test_correct_redirect_as_2fa_user_single_org_member(self):
        user = self.create_user("foor@example.com")

        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)

        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "foor@example.com"
        member.save()

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )

        assert resp.redirect_chain == [("/auth/2fa/", 302)]

    def test_correct_redirect_as_2fa_user_invited_member(self):
        user = self.create_user("foor@example.com")

        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)

        self.create_member(organization=self.organization, user=user)
        member = OrganizationMember.objects.get(organization=self.organization, user=user)
        member.email = "foor@example.com"
        member.save()

        resp = self.client.post(
            self.path, {"username": user, "password": "admin", "op": "login"}, follow=True
        )

        assert resp.redirect_chain == [("/auth/2fa/", 302)]

    def test_anonymous_user_with_automatic_migration(self):
        AuthProvider.objects.create(organization=self.organization, provider="dummy")
        resp = self.client.post(self.path, {"init": True})
        assert resp.status_code == 200

        path = reverse("sentry-auth-sso")

        # Check that we don't call send_one_time_account_confirm_link with an AnonymousUser
        resp = self.client.post(path, {"email": "foo@example.com"})
        assert resp.status_code == 200


class OrganizationAuthLoginNoPasswordTest(AuthProviderTestCase):
    def setUp(self):
        self.owner = self.create_user()
        self.organization = self.create_organization(name="foo", owner=self.owner)
        self.user = self.create_user("bar@example.com", is_managed=False, password="")
        self.auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        self.path = reverse("sentry-auth-organization", args=[self.organization.slug])
        self.auth_sso_path = reverse("sentry-auth-sso")
        UserEmail.objects.filter(user=self.user, email="bar@example.com").update(is_verified=False)

    @mock.patch("sentry.auth.idpmigration.MessageBuilder")
    def test_flow_verify_and_link_without_password_sends_email(self, email):
        assert not self.user.has_usable_password()
        self.create_member(organization=self.organization, user=self.user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        resp = self.client.post(self.auth_sso_path, {"email": "bar@example.com"})
        self.assertTemplateUsed(resp, "sentry/auth-confirm-account.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == self.user

        _, message = email.call_args
        context = message["context"]
        assert context["user"] == self.user
        assert context["email"] == self.user.email
        assert context["organization"] == self.organization.name
        email.return_value.send_async.assert_called_with([self.user.email])

        path = reverse("sentry-idp-email-verification", args=[context["verification_key"]])
        resp = self.client.get(path)
        assert resp.templates[0].name == "sentry/idp_account_verified.html"
        assert resp.status_code == 200

        path = reverse("sentry-auth-organization", args=[self.organization.slug])
        resp = self.client.post(path, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=self.auth_provider)
        assert self.user == auth_identity.user

    @mock.patch("sentry.auth.idpmigration.MessageBuilder")
    def test_flow_verify_without_org_membership(self, email):
        assert not self.user.has_usable_password()
        assert not OrganizationMember.objects.filter(
            organization=self.organization, user=self.user
        ).exists()

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        resp = self.client.post(self.auth_sso_path, {"email": "bar@example.com"})
        self.assertTemplateUsed(resp, "sentry/auth-confirm-account.html")
        assert resp.status_code == 200
        assert resp.context["existing_user"] == self.user

        _, message = email.call_args
        context = message["context"]
        assert context["organization"] == self.organization.name

        path = reverse("sentry-idp-email-verification", args=[context["verification_key"]])
        resp = self.client.get(path)
        assert resp.templates[0].name == "sentry/idp_account_verified.html"
        assert resp.status_code == 200

        path = reverse("sentry-auth-organization", args=[self.organization.slug])
        resp = self.client.post(path, follow=True)
        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=self.auth_provider)
        assert self.user == auth_identity.user

        # Check that OrganizationMember was created as a side effect
        assert OrganizationMember.objects.filter(
            organization=self.organization, user=self.user
        ).exists()

    @mock.patch("sentry.auth.idpmigration.MessageBuilder")
    def test_flow_verify_and_link_without_password_login_success(self, email):
        assert not self.user.has_usable_password()
        self.create_member(organization=self.organization, user=self.user)

        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        resp = self.client.post(self.auth_sso_path, {"email": "bar@example.com"})
        self.assertTemplateUsed(resp, "sentry/auth-confirm-account.html")

        assert resp.status_code == 200
        assert resp.context["existing_user"] == self.user
        path = reverse(
            "sentry-idp-email-verification",
            args=[email.call_args.kwargs["context"]["verification_key"]],
        )

        resp = self.client.get(path)
        assert resp.templates[0].name == "sentry/idp_account_verified.html"

        assert resp.status_code == 200

        path = reverse("sentry-auth-organization", args=[self.organization.slug])

        resp = self.client.post(path, follow=True)

        assert resp.redirect_chain == [
            (reverse("sentry-login"), 302),
            ("/organizations/foo/issues/", 302),
        ]

        auth_identity = AuthIdentity.objects.get(auth_provider=self.auth_provider)
        assert self.user == auth_identity.user

        member = OrganizationMember.objects.get(organization=self.organization, user=self.user)
        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")
        assert not getattr(member.flags, "member-limit:restricted")

    @mock.patch("sentry.auth.idpmigration.MessageBuilder")
    def test_flow_verify_and_link_without_password_need_2fa(self, email):
        assert not self.user.has_usable_password()
        self.create_member(organization=self.organization, user=self.user)
        TotpInterface().enroll(self.user)
        resp = self.client.post(self.path, {"init": True})

        assert resp.status_code == 200
        assert self.provider.TEMPLATE in resp.content.decode("utf-8")

        resp = self.client.post(self.auth_sso_path, {"email": "bar@example.com"})
        self.assertTemplateUsed(resp, "sentry/auth-confirm-account.html")

        assert resp.status_code == 200
        assert resp.context["existing_user"] == self.user
        path = reverse(
            "sentry-idp-email-verification",
            args=[email.call_args.kwargs["context"]["verification_key"]],
        )

        resp = self.client.get(path)
        assert resp.templates[0].name == "sentry/idp_account_verified.html"

        assert resp.status_code == 200

        path = reverse("sentry-auth-organization", args=[self.organization.slug])

        resp = self.client.post(path, follow=True)

        assert resp.redirect_chain == [
            (reverse("sentry-2fa-dialog"), 302),
        ]
