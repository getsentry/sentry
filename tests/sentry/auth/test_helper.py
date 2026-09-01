from __future__ import annotations

from typing import TypedDict
from unittest import mock

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, models, router, transaction
from django.http import HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.test import Client, RequestFactory
from django.urls import reverse

from sentry import audit_log
from sentry.analytics.events.user_signup import UserSignUpEvent
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.email_verification import hash_email
from sentry.auth.exceptions import AuthIdentityUserMismatch
from sentry.auth.helper import (
    ERR_IDENTITY_CONFLICT,
    ERR_MERGE_FAILED,
    ERR_NEW_USER_SETUP_FAILED,
    ERR_USER_SUSPENDED,
    OK_LINK_IDENTITY,
    AuthHelper,
    AuthIdentityHandler,
)
from sentry.auth.idpmigration import SSO_VERIFICATION_KEY
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.store import FLOW_LOGIN, FLOW_SETUP_PROVIDER, AuthHelperSessionStore
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.constants import PIPELINE_STATE_TTL
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.utils import json
from sentry.utils.redis import clusters
from sentry.web.frontend.signup_email_verification import (
    PENDING_EXPIRY_TEXT_SESSION_KEY,
    PENDING_VERIFICATION_SESSION_KEY,
)


def _set_up_request():
    request = RequestFactory().post("/auth/sso/")
    request.user = AnonymousUser()
    request.auth = None
    request.session = Client().session
    return request


class _Identity(TypedDict):
    id: str
    email: str
    name: str
    data: dict[str, str]


class AuthIdentityHandlerTest(TestCase):
    def setUp(self) -> None:
        self.provider = "dummy"
        self.request = _set_up_request()

        self.auth_provider_inst = self.create_auth_provider(
            organization_id=self.organization.id, provider=self.provider
        )
        self.email = "test@example.com"
        self.identity: _Identity = {
            "id": "1234",
            "email": self.email,
            "name": "Morty",
            "data": {"foo": "bar"},
        }

        self.state = AuthHelperSessionStore(self.request, "pipeline", ttl=PIPELINE_STATE_TTL)

    @property
    def handler(self):
        return self._handler_with(self.identity)

    def _handler_with(self, identity):
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_organization = serialize_rpc_organization(self.organization)
        return AuthIdentityHandler(
            self.auth_provider_inst,
            DummyProvider(),
            rpc_organization,
            self.request,
            identity,
        )

    def set_up_user(self):
        """Set up a persistent user and associate it to the request.

        If not called, default to having the request come from an
        anonymous user.
        """

        user = self.create_user()
        self.request.user = user
        return user

    def set_up_user_identity(self):
        """Set up a persistent user who already has an auth identity."""
        user = self.set_up_user()
        auth_identity = self.create_auth_identity(
            user=user, auth_provider=self.auth_provider_inst, ident="test_ident"
        )
        return user, auth_identity


@control_silo_test
class UserResolutionTest(AuthIdentityHandlerTest):
    """Tests for AuthIdentityHandler.user property resolution."""

    def test_resolves_to_org_member_over_primary_email_user(self) -> None:
        """
        Regression test for SSO account merge infinite loop.

        When the identity email matches multiple users:
        - user1: org member, email is verified secondary
        - user2: NOT org member, email is their primary

        The handler.user property should resolve to user1 (the org member)
        because org membership takes precedence over primary email.

        Previously, organization context wasn't passed to resolve_email_to_user(),
        causing user2 to be selected (primary email wins), which led to an infinite
        loop when user1 was logged in trying to link their SSO identity.
        """
        shared_email = "shared@example.com"

        # user1: org member, shared email is verified but NOT primary
        user1 = self.create_user()
        self.create_useremail(user=user1, email=shared_email, is_verified=True)
        self.create_member(organization=self.organization, user=user1)

        # user2: NOT an org member, shared email IS their primary
        self.create_user(email=shared_email)

        # Create handler with identity using the shared email
        identity: _Identity = {
            "id": "sso_id_123",
            "email": shared_email,
            "name": "Test User",
            "data": {},
        }
        handler = self._handler_with(identity)

        # Should resolve to user1 (org member) not user2 (primary email)
        assert handler.user == user1

    def test_authenticated_user_resolves_to_session_user(self) -> None:
        """Session user takes priority over IdP email resolution."""
        session_user = self.set_up_user()
        other_user = self.create_user(email=self.email)

        assert self.handler.user == session_user
        assert self.handler.user != other_user

    def test_unauthenticated_with_no_email_match_resolves_to_anonymous(self) -> None:
        identity: _Identity = {
            "id": "sso_unknown",
            "email": "nobody@nowhere.com",
            "name": "Unknown",
            "data": {},
        }
        handler = self._handler_with(identity)
        assert isinstance(handler.user, AnonymousUser)


@control_silo_test
class HandleNewUserTest(AuthIdentityHandlerTest, HybridCloudTestMixin):
    def test_email_verified_suppresses_confirm_email(self) -> None:
        with mock.patch.object(User, "send_confirm_emails") as mock_send:
            self.handler.handle_new_user(email_verified=True)
        mock_send.assert_not_called()

    @mock.patch("sentry.auth.helper.user_service.verify_user_email", return_value=False)
    def test_email_verified_fallback_sends_confirm_email_on_failure(
        self, mock_verify: mock.MagicMock
    ) -> None:
        with mock.patch.object(User, "send_confirm_emails") as mock_send:
            auth_identity = self.handler.handle_new_user(email_verified=True)
        mock_verify.assert_called_once()
        mock_send.assert_called_once()
        user = auth_identity.user
        assert UserEmail.objects.get(user=user, email=self.email).is_verified is False

    def test_confirm_emails_sent_by_default(self) -> None:
        with mock.patch.object(User, "send_confirm_emails") as mock_send:
            self.handler.handle_new_user()
        mock_send.assert_called_once()

    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record: mock.MagicMock) -> None:
        auth_identity = self.handler.handle_new_user()
        user = auth_identity.user

        assert user.email == self.email
        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.get(
                organization=self.organization, user_id=user.id
            )
        self.assert_org_member_mapping(org_member=org_member)

        assert_last_analytics_event(
            mock_record,
            UserSignUpEvent(
                user_id=user.id,
                source="sso",
                provider=self.provider,
                referrer="in-app",
            ),
        )

    def test_associated_existing_member_invite_by_email(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.create(
                organization=self.organization, email=self.email
            )

        auth_identity = self.handler.handle_new_user()

        with assume_test_silo_mode(SiloMode.CELL):
            assigned_member = OrganizationMember.objects.get(
                organization=self.organization, user_id=auth_identity.user_id
            )

        assert assigned_member.id == member.id

    def test_demo_user_cannot_be_added_new_user(self) -> None:
        with mock.patch("sentry.auth.helper.is_demo_user", return_value=True):
            with self.assertRaisesMessage(
                Exception,
                "Demo user cannot be added to an organization that is not a demo organization.",
            ):
                self.handler.handle_new_user()

    def test_associated_existing_member_invite_request(self) -> None:
        member = self.create_member(
            organization=self.organization,
            email=self.email,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        auth_identity = self.handler.handle_new_user()

        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.get(
                organization=self.organization,
                user_id=auth_identity.user_id,
                invite_status=InviteStatus.APPROVED.value,
            )

        self.assert_org_member_mapping(org_member=org_member)
        self.assert_org_member_mapping_not_exists(org_member=member)
        with assume_test_silo_mode(SiloMode.CELL):
            assert not OrganizationMember.objects.filter(id=member.id).exists()

    def test_associate_pending_invite(self) -> None:
        # The org member invite should have a non matching email, but the
        # member id and token will match from the session, allowing association
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.create(
                organization=self.organization, email="different.email@example.com", token="abc"
            )

        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()

        auth_identity = self.handler.handle_new_user()

        with assume_test_silo_mode(SiloMode.CELL):
            assigned_member = OrganizationMember.objects.get(
                organization=self.organization, user_id=auth_identity.user.id
            )

        assert assigned_member.id == member.id

    def test_demo_user_can_be_added_new_user_when_demo_org(self) -> None:
        # Force demo user behavior, and mark org as demo org
        with override_options(
            {"demo-mode.enabled": True, "demo-mode.orgs": [self.organization.id]}
        ):
            with mock.patch("sentry.auth.helper.is_demo_user", return_value=True):
                # Should not raise when org is demo org
                auth_identity = self.handler.handle_new_user()
                with assume_test_silo_mode(SiloMode.CELL):
                    org_member = OrganizationMember.objects.get(
                        organization=self.organization, user_id=auth_identity.user.id
                    )
                assert getattr(org_member.flags, "sso:linked")


@control_silo_test
class HandleExistingIdentityTest(AuthIdentityHandlerTest, HybridCloudTestMixin):
    @mock.patch("sentry.auth.helper.auth")
    def test_simple(self, mock_auth: mock.MagicMock) -> None:
        mock_auth.get_login_redirect.return_value = "test_login_url"
        user, auth_identity = self.set_up_user_identity()

        redirect = self.handler.handle_existing_identity(self.state, auth_identity)

        assert redirect.url == mock_auth.get_login_redirect.return_value
        mock_auth.get_login_redirect.assert_called_with(
            self.request, default=f"/organizations/{self.organization.slug}/issues/"
        )

        persisted_identity = AuthIdentity.objects.get(ident=auth_identity.ident)
        assert persisted_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.CELL):
            persisted_om = OrganizationMember.objects.get(
                user_id=user.id, organization=self.organization
            )
        assert getattr(persisted_om.flags, "sso:linked")
        assert not getattr(persisted_om.flags, "member-limit:restricted")
        assert not getattr(persisted_om.flags, "sso:invalid")
        self.assert_org_member_mapping(org_member=persisted_om)

        login_request, login_user = mock_auth.login.call_args.args
        assert login_request == self.request
        assert login_user == user

    @mock.patch("sentry.auth.helper.auth")
    def test_no_invite_members_flag(self, mock_auth: mock.MagicMock) -> None:
        with mock.patch("sentry.features.has", return_value=False) as features_has:
            mock_auth.get_login_redirect.return_value = "test_login_url"
            user, auth_identity = self.set_up_user_identity()

            redirect = self.handler.handle_existing_identity(self.state, auth_identity)

            assert redirect.url == mock_auth.get_login_redirect.return_value
            mock_auth.get_login_redirect.assert_called_with(
                self.request, default=f"/organizations/{self.organization.slug}/issues/"
            )

            persisted_identity = AuthIdentity.objects.get(ident=auth_identity.ident)
            assert persisted_identity.data == self.identity["data"]

            with assume_test_silo_mode(SiloMode.CELL):
                persisted_om = OrganizationMember.objects.get(
                    user_id=user.id, organization=self.organization
                )
            assert getattr(persisted_om.flags, "sso:linked")
            assert getattr(persisted_om.flags, "member-limit:restricted")
            assert not getattr(persisted_om.flags, "sso:invalid")
            with assume_test_silo_mode(SiloMode.CELL):
                expected_rpc_org = serialize_rpc_organization(self.organization)
            features_has.assert_any_call("organizations:invite-members", expected_rpc_org)
            self.assert_org_member_mapping(org_member=persisted_om)

    def test_demo_user_cannot_be_added_existing_identity(self) -> None:
        user, auth_identity = self.set_up_user_identity()
        with override_options({"demo-mode.enabled": True, "demo-mode.users": [user.id]}):
            with self.assertRaisesMessage(
                Exception,
                "Demo user cannot be added to an organization that is not a demo organization.",
            ):
                self.handler.handle_existing_identity(self.state, auth_identity)

    def test_demo_user_can_be_added_when_demo_org(self) -> None:
        user, auth_identity = self.set_up_user_identity()
        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [user.id],
                "demo-mode.orgs": [self.organization.id],
            }
        ):
            redirect = self.handler.handle_existing_identity(self.state, auth_identity)
            assert redirect.status_code == 302
            with assume_test_silo_mode(SiloMode.CELL):
                persisted_om = OrganizationMember.objects.get(
                    user_id=user.id, organization=self.organization
                )
            assert getattr(persisted_om.flags, "sso:linked")


@control_silo_test
class HandleAttachIdentityTest(AuthIdentityHandlerTest, HybridCloudTestMixin):
    @mock.patch("sentry.auth.helper.messages")
    def test_new_identity(self, mock_messages: mock.MagicMock) -> None:
        request_user = self.set_up_user()

        auth_identity = self.handler.handle_attach_identity()
        assert auth_identity.ident == self.identity["id"]
        assert auth_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.get(
                user_id=request_user.id, organization=self.organization
            )

        self.assert_org_member_mapping(org_member=org_member)

        self.assert_org_member_mapping(org_member=org_member)

        assert AuditLogEntry.objects.filter(
            organization_id=self.organization.id,
            target_object=auth_identity.id,
            event=audit_log.get_event_id("SSO_IDENTITY_LINK"),
            data=auth_identity.get_audit_log_data(),
        ).exists()

        mock_messages.add_message.assert_called_with(
            self.request, mock_messages.SUCCESS, OK_LINK_IDENTITY
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_new_identity_with_existing_om(self, mock_messages: mock.MagicMock) -> None:
        user = self.set_up_user()
        with assume_test_silo_mode(SiloMode.CELL):
            existing_om = OrganizationMember.objects.create(
                user_id=user.id, organization=self.organization
            )

        auth_identity = self.handler.handle_attach_identity()
        assert auth_identity.ident == self.identity["id"]
        assert auth_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.CELL):
            persisted_om = OrganizationMember.objects.get(id=existing_om.id)
            assert getattr(persisted_om.flags, "sso:linked")
            assert not getattr(persisted_om.flags, "sso:invalid")

        mock_messages.add_message.assert_called_with(
            self.request, mock_messages.SUCCESS, OK_LINK_IDENTITY
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_new_identity_with_existing_om_idp_flags(self, mock_messages: mock.MagicMock) -> None:
        user = self.set_up_user()
        with assume_test_silo_mode(SiloMode.CELL):
            with (
                assume_test_silo_mode(SiloMode.CELL),
                outbox_context(transaction.atomic(using=router.db_for_write(OrganizationMember))),
            ):
                existing_om = OrganizationMember.objects.create(
                    user_id=user.id,
                    organization=self.organization,
                )

                existing_om.update(
                    flags=models.F("flags")
                    .bitor(OrganizationMember.flags["idp:provisioned"])
                    .bitor(OrganizationMember.flags["idp:role-restricted"])
                )
                existing_om.save()

        auth_identity = self.handler.handle_attach_identity()
        assert auth_identity.ident == self.identity["id"]
        assert auth_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.CELL):
            persisted_om = OrganizationMember.objects.get(id=existing_om.id)
            assert getattr(persisted_om.flags, "sso:linked")
            assert getattr(persisted_om.flags, "idp:provisioned")
            assert getattr(persisted_om.flags, "idp:role-restricted")
            assert not getattr(persisted_om.flags, "sso:invalid")

        mock_messages.add_message.assert_called_with(
            self.request, mock_messages.SUCCESS, OK_LINK_IDENTITY
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_existing_identity(self, mock_messages: mock.MagicMock) -> None:
        user, existing_identity = self.set_up_user_identity()

        returned_identity = self.handler.handle_attach_identity()
        assert returned_identity == existing_identity
        assert not mock_messages.add_message.called

        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.get(
                organization=self.organization,
                user_id=user.id,
            )
        self.assert_org_member_mapping(org_member=org_member)

    def _test_with_identity_belonging_to_another_user(self, request_user):
        other_user = self.create_user()

        # The user logs in with credentials from this other identity
        AuthIdentity.objects.create(
            user=other_user, auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        )
        with assume_test_silo_mode(SiloMode.CELL):
            OrganizationMember.objects.create(user_id=other_user.id, organization=self.organization)

        returned_identity = self.handler.handle_attach_identity()
        assert returned_identity.user == request_user
        assert returned_identity.ident == self.identity["id"]
        assert returned_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.CELL):
            org_member = OrganizationMember.objects.get(
                user_id=request_user.id, organization=self.organization
            )

            persisted_om = OrganizationMember.objects.get(
                user_id=other_user.id, organization=self.organization
            )

        self.assert_org_member_mapping(org_member=org_member)

        assert not getattr(persisted_om.flags, "sso:linked")
        assert getattr(persisted_om.flags, "sso:invalid")
        self.assert_org_member_mapping(org_member=persisted_om)

    def test_login_with_other_identity(self) -> None:
        request_user = self.set_up_user()
        self._test_with_identity_belonging_to_another_user(request_user)

    def test_wipe_existing_identity(self) -> None:
        request_user, existing_identity = self.set_up_user_identity()
        self._test_with_identity_belonging_to_another_user(request_user)
        assert not AuthIdentity.objects.filter(id=existing_identity.id).exists()

    def test_raises_on_session_user_mismatch(self) -> None:
        """Defense-in-depth: handle_attach_identity must refuse to write
        when the session user differs from the resolved target user."""
        self.set_up_user()
        other_user = self.create_user(email="other@example.com")
        identity: _Identity = {
            "id": "sso_id_456",
            "email": other_user.email,
            "name": "Other",
            "data": {},
        }
        # Build handler while unauthenticated so self.user resolves by email,
        # then set request.user to simulate a post-login state mismatch.
        unauthenticated_request = _set_up_request()
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_organization = serialize_rpc_organization(self.organization)
        handler = AuthIdentityHandler(
            self.auth_provider_inst,
            DummyProvider(),
            rpc_organization,
            unauthenticated_request,
            identity,
        )
        assert handler.user == other_user
        handler.request.user = self.request.user

        with pytest.raises(AuthIdentityUserMismatch):
            handler.handle_attach_identity()
        assert not AuthIdentity.objects.filter(
            auth_provider=self.auth_provider_inst, ident=identity["id"]
        ).exists()


@control_silo_test
class HandleUnknownIdentityTest(AuthIdentityHandlerTest):
    def _test_simple(self, mock_render, expected_template):
        redirect = self.handler.handle_unknown_identity(self.state)

        assert redirect is mock_render.return_value
        template, context, request = mock_render.call_args.args
        status = mock_render.call_args.kwargs["status"]

        assert template == expected_template
        assert request is self.request
        assert status == 200

        with assume_test_silo_mode(SiloMode.CELL):
            expected_org = serialize_rpc_organization(self.organization)

        assert context["organization"] == expected_org
        assert context["identity"] == self.identity
        assert context["provider"] == self.auth_provider_inst.get_provider().name
        assert context["identity_display_name"] == self.identity["name"]
        assert context["identity_identifier"] == self.email
        return context

    @mock.patch("sentry.auth.helper.render_to_response")
    def test_unauthenticated(self, mock_render: mock.MagicMock) -> None:
        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert context["existing_user"] is None
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    def test_authenticated(self, mock_render: mock.MagicMock) -> None:
        self.set_up_user()
        context = self._test_simple(mock_render, "sentry/auth-confirm-link.html")
        assert context["existing_user"] is self.request.user
        assert "login_form" not in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_unauthenticated_with_secondary_email_shows_login(
        self, mock_create_key: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        """When the IdP asserts a verified secondary email, the unauthenticated
        user should be shown the login page rather than auto-linked."""
        existing_user = self.create_user(email="primary@example.com")
        self.create_useremail(user=existing_user, email=self.email, is_verified=True)

        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert not mock_create_key.called
        assert context["existing_user"] == existing_user
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_unauthenticated_with_unverified_secondary_email_shows_login(
        self, mock_create_key: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        """An unverified secondary email still resolves via resolve_email_to_user
        (no is_verified filter on the query), so the user should be shown the
        login page."""
        existing_user = self.create_user(email="primary@example.com")
        self.create_useremail(user=existing_user, email=self.email, is_verified=False)

        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert not mock_create_key.called
        assert context["existing_user"] == existing_user
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_automatic_migration(
        self, mock_create_key: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        existing_user = self.create_user(email=self.email)
        existing_user.update(password="")

        context = self._test_simple(mock_render, "sentry/auth-confirm-account.html")
        assert mock_create_key.call_count == 1
        (user, org, provider, email, identity_id) = mock_create_key.call_args.args
        assert user.id == existing_user.id
        assert org.id == self.organization.id
        assert provider.id == self.auth_provider_inst.id
        assert email == self.email
        assert identity_id == self.identity["id"]

        assert context["existing_user"].id == existing_user.id
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_does_not_migrate_user_with_password(
        self, mock_create_key: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        existing_user = self.create_user(email=self.email)
        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert not mock_create_key.called
        assert context["existing_user"] == existing_user
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.messages")
    @mock.patch("sentry.auth.helper.render_to_response")
    def test_new_user_duplicate_email_shows_error(
        self, mock_render: mock.MagicMock, mock_messages: mock.MagicMock
    ) -> None:
        self.create_user(email=self.email, is_test_user=False)
        self.request.POST = {"op": "newuser"}
        response = self.handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        mock_messages.add_message.assert_called_once_with(
            self.request,
            mock_messages.ERROR,
            ERR_IDENTITY_CONFLICT,
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_confirm_links_to_session_user_not_email_resolved_user(
        self, mock_messages: mock.MagicMock
    ) -> None:
        # When authenticated as user A and the IdP asserts user B's email,
        # confirming must link the identity to user A (session user).
        session_user = self.create_user(email="other@example.com")
        self.request.user = session_user
        with assume_test_silo_mode(SiloMode.CELL):
            self.create_member(user=session_user, organization=self.organization, role="member")
        # Create the user whose email the IdP asserted
        self.create_user(email=self.email)

        self.request.POST = {"op": "confirm"}
        self.handler.handle_unknown_identity(self.state)

        auth_identity = AuthIdentity.objects.get(
            auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        )
        assert auth_identity.user_id == session_user.id

    @mock.patch("sentry.auth.helper.messages")
    def test_confirm_links_to_session_user_not_secondary_email_user(
        self, mock_messages: mock.MagicMock
    ) -> None:
        """When authenticated as user A and the IdP asserts an email that is a
        verified secondary on user B, confirming links to user A (session user)."""
        session_user = self.create_user(email="session@example.com")
        self.request.user = session_user
        with assume_test_silo_mode(SiloMode.CELL):
            self.create_member(user=session_user, organization=self.organization, role="member")
        other_user = self.create_user(email="primary@example.com")
        self.create_useremail(user=other_user, email=self.email, is_verified=True)

        self.request.POST = {"op": "confirm"}
        self.handler.handle_unknown_identity(self.state)

        auth_identity = AuthIdentity.objects.get(
            auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        )
        assert auth_identity.user_id == session_user.id

    @mock.patch("sentry.auth.helper.messages")
    @mock.patch("sentry.auth.helper.auth")
    def test_is_account_verified_auto_links_unauthenticated_user(
        self, mock_auth: mock.MagicMock, mock_messages: mock.MagicMock
    ) -> None:
        """Unauthenticated user who proved email ownership via verification link
        should auto-link without needing IdP email_verified."""
        existing_user = self.create_user(email=self.email)
        with assume_test_silo_mode(SiloMode.CELL):
            member = self.create_member(
                user=existing_user, organization=self.organization, role="member"
            )

        mock_auth.login.return_value = True
        mock_auth.get_login_redirect.return_value = "/organizations/test-org/issues/"

        # Simulate the is_account_verified flow: session has verification key
        # that resolves to a value matching this user + email
        verification_value = {
            "user_id": existing_user.id,
            "email": self.email,
            "member_id": member.id,
            "identity_id": self.identity["id"],
        }
        with (
            mock.patch(
                "sentry.auth.helper.get_verification_value_from_key",
                return_value=verification_value,
            ),
        ):
            self.request.session[SSO_VERIFICATION_KEY] = "test-verification-key"
            self.handler.handle_unknown_identity(self.state)

        auth_identity = AuthIdentity.objects.get(
            auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        )
        assert auth_identity.user_id == existing_user.id

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_idp_email_verified_does_not_auto_link_unauthenticated_user(
        self, mock_create_key: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        """IdP-asserted email_verified=True must not bypass the login gate
        for unauthenticated users."""
        existing_user = self.create_user(email=self.email)
        with assume_test_silo_mode(SiloMode.CELL):
            self.create_member(user=existing_user, organization=self.organization, role="member")

        identity: _Identity = {
            "id": self.identity["id"],
            "email": self.email,
            "name": self.identity["name"],
            "data": {},
        }
        handler = self._handler_with(identity)
        handler.identity["email_verified"] = True

        response = handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        template = mock_render.call_args.args[0]
        assert template == "sentry/auth-confirm-identity.html"
        assert not AuthIdentity.objects.filter(
            auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        ).exists()

    @mock.patch("sentry.auth.helper.messages")
    @mock.patch("sentry.auth.helper.render_to_response")
    def test_confirm_unauthenticated_unverified_shows_merge_error(
        self, mock_render: mock.MagicMock, mock_messages: mock.MagicMock
    ) -> None:
        """op=confirm without authentication or email verification shows ERR_MERGE_FAILED."""
        self.create_user(email=self.email)

        self.request.POST = {"op": "confirm"}
        response = self.handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        mock_messages.add_message.assert_called_once_with(
            self.request,
            mock_messages.ERROR,
            ERR_MERGE_FAILED,
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_newuser_creates_account_and_identity(self, mock_messages: mock.MagicMock) -> None:
        """op=newuser creates a new User and links the AuthIdentity to them."""
        self.request.POST = {"op": "newuser"}
        self.handler.handle_unknown_identity(self.state)

        auth_identity = AuthIdentity.objects.get(
            auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        )
        assert auth_identity.user.email == self.email

    @mock.patch("sentry.auth.helper.auth")
    @mock.patch("sentry.auth.helper.render_to_response")
    def test_login_with_valid_credentials_returns_confirmation(
        self, mock_render: mock.MagicMock, mock_auth: mock.MagicMock
    ) -> None:
        """op=login with valid credentials calls _login and re-shows the confirmation page."""
        existing_user = self.create_user(email=self.email)
        mock_auth.login.return_value = True

        mock_form = mock.MagicMock()
        mock_form.is_valid.return_value = True
        mock_form.get_user.return_value = existing_user

        self.request.POST = {"op": "login"}
        with mock.patch.object(
            type(self.handler), "_login_form", new_callable=lambda: property(lambda s: mock_form)
        ):
            response = self.handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        mock_auth.login.assert_called_once()

    @mock.patch("sentry.auth.helper.auth")
    @mock.patch("sentry.auth.helper.render_to_response")
    def test_login_with_invalid_credentials_returns_confirmation(
        self, mock_render: mock.MagicMock, mock_auth: mock.MagicMock
    ) -> None:
        """op=login with bad credentials logs the failure and re-shows the confirmation page."""
        self.create_user(email=self.email)

        mock_form = mock.MagicMock()
        mock_form.is_valid.return_value = False

        self.request.POST = {"op": "login", "username": self.email}
        with mock.patch.object(
            type(self.handler), "_login_form", new_callable=lambda: property(lambda s: mock_form)
        ):
            response = self.handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        mock_auth.log_auth_failure.assert_called_once()

    def test_login_2fa_redirect_uses_request_host(self) -> None:
        """The post-2FA redirect must resume the pipeline on the host the request
        arrived on (e.g. a customer subdomain), not the system url-prefix host —
        otherwise the pipeline session cookie isn't sent to the redirect target."""
        user = self.create_user()
        TotpInterface().enroll(user)

        self.request = RequestFactory().post("/auth/sso/", SERVER_NAME="acme.testserver")
        self.request.user = AnonymousUser()
        self.request.session = Client().session

        with override_options({"system.url-prefix": "https://system.example.com"}):
            with pytest.raises(AuthIdentityHandler._NotCompletedSecurityChecks):
                self.handler._login(user)

        assert self.request.session["_after_2fa"] == "http://acme.testserver/auth/sso/"


@control_silo_test
class AuthHelperTest(TestCase):
    def setUp(self) -> None:
        self.provider = "dummy"
        self.auth_provider_inst = AuthProvider.objects.create(
            organization_id=self.organization.id, provider=self.provider
        )

        self.auth_key = "test_auth_key"
        self.request = _set_up_request()
        self.request.session["auth_key"] = self.auth_key

    def _test_pipeline(self, flow, referrer=None):
        initial_state = {
            "org_id": self.organization.id,
            "flow": flow,
            "provider_model_id": self.auth_provider_inst.id,
            "provider_key": None,
            "referrer": referrer,
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        helper = AuthHelper.get_for_request(self.request)
        assert helper is not None
        helper.initialize()
        assert helper.is_valid()
        assert helper.referrer == referrer
        assert helper.flow == flow

        first_step = helper.current_step()
        assert first_step.status_code == 200

        next_step = helper.next_step()
        assert next_step.status_code == 302
        return next_step

    @mock.patch("sentry.auth.helper.messages")
    def test_login(self, mock_messages: mock.MagicMock) -> None:
        final_step = self._test_pipeline(FLOW_LOGIN)
        assert final_step.url == f"/auth/login/{self.organization.slug}/"

    @mock.patch("sentry.auth.helper.messages")
    def test_setup_provider(self, mock_messages: mock.MagicMock) -> None:
        final_step = self._test_pipeline(FLOW_SETUP_PROVIDER)
        assert final_step.url == f"/settings/{self.organization.slug}/auth/"

    @mock.patch("sentry.auth.helper.messages")
    def test_referrer_state(self, mock_messages: mock.MagicMock) -> None:
        final_step = self._test_pipeline(flow=FLOW_SETUP_PROVIDER, referrer="foobar")
        assert final_step.url == f"/settings/{self.organization.slug}/auth/"

    @mock.patch("sentry.auth.helper.messages")
    @mock.patch(
        "sentry.auth.helper.AuthIdentityHandler.handle_existing_identity",
        side_effect=IntegrityError(),
    )
    def test_existing_identity_integrity_error_shows_error(
        self,
        mock_handle_existing: mock.MagicMock,
        mock_messages: mock.MagicMock,
    ) -> None:
        user = self.create_user(email="test@example.com")
        AuthIdentity.objects.create(
            auth_provider=self.auth_provider_inst,
            user=user,
            ident="test@example.com",
        )

        initial_state = {
            "org_id": self.organization.id,
            "flow": FLOW_LOGIN,
            "provider_model_id": self.auth_provider_inst.id,
            "provider_key": None,
            "referrer": None,
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        helper = AuthHelper.get_for_request(self.request)
        assert helper is not None
        helper.initialize()

        helper.bind_state("email", "test@example.com")
        helper.bind_state("email_verified", True)

        # Skip provider views, go straight to finish_pipeline
        helper.state.step_index = len(helper.pipeline_views)
        result = helper.current_step()

        assert result.status_code == 302
        assert isinstance(result, HttpResponseRedirect)
        assert result.url == f"/auth/login/{self.organization.slug}/"
        mock_messages.add_message.assert_called_once_with(
            self.request,
            mock_messages.ERROR,
            f"Authentication error: {ERR_IDENTITY_CONFLICT}",
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_suspended_user_gets_error_not_redirect_loop(
        self,
        mock_messages: mock.MagicMock,
    ) -> None:
        user = self.create_user(email="suspended@example.com")

        with assume_test_silo_mode(SiloMode.CONTROL):
            user.update(is_suspended=True)

        AuthIdentity.objects.create(
            auth_provider=self.auth_provider_inst,
            user=user,
            ident="suspended@example.com",
        )

        initial_state = {
            "org_id": self.organization.id,
            "flow": FLOW_LOGIN,
            "provider_model_id": self.auth_provider_inst.id,
            "provider_key": None,
            "referrer": None,
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        helper = AuthHelper.get_for_request(self.request)
        assert helper is not None
        helper.initialize()

        helper.bind_state("email", "suspended@example.com")
        helper.bind_state("email_verified", True)

        helper.state.step_index = len(helper.pipeline_views)
        result = helper.current_step()

        assert result.status_code == 302
        assert isinstance(result, HttpResponseRedirect)
        assert result.url == f"/auth/login/{self.organization.slug}/"
        mock_messages.add_message.assert_called_once_with(
            self.request,
            mock_messages.ERROR,
            f"Authentication error: {ERR_USER_SUSPENDED}",
        )

    def test_rejects_pipeline_from_different_org(self) -> None:
        other_org = self.create_organization()
        other_auth_provider = AuthProvider.objects.create(
            organization_id=other_org.id, provider=self.provider
        )

        with assume_test_silo_mode(SiloMode.CELL):
            other_rpc_org = serialize_rpc_organization(other_org)

        helper_org_a = AuthHelper(
            request=self.request,
            organization=other_rpc_org,
            auth_provider=other_auth_provider,
            flow=FLOW_LOGIN,
        )
        helper_org_a.initialize()
        assert helper_org_a.is_valid()

        with assume_test_silo_mode(SiloMode.CELL):
            rpc_org = serialize_rpc_organization(self.organization)

        helper_org_b = AuthHelper(
            request=self.request,
            organization=rpc_org,
            auth_provider=self.auth_provider_inst,
            flow=FLOW_LOGIN,
        )
        assert not helper_org_b.is_valid()

    def test_rejects_different_provider_model(self) -> None:
        """Even within the same org, swapping the provider_model_id is rejected."""
        other_org = self.create_organization()
        other_auth_provider = AuthProvider.objects.create(
            organization_id=other_org.id, provider=self.provider
        )

        with assume_test_silo_mode(SiloMode.CELL):
            rpc_org = serialize_rpc_organization(self.organization)

        helper_a = AuthHelper(
            request=self.request,
            organization=rpc_org,
            auth_provider=self.auth_provider_inst,
            flow=FLOW_LOGIN,
        )
        helper_a.initialize()
        assert helper_a.is_valid()

        helper_b = AuthHelper(
            request=self.request,
            organization=rpc_org,
            auth_provider=other_auth_provider,
            flow=FLOW_LOGIN,
        )
        assert not helper_b.is_valid()

    def test_get_for_request_binds_to_stored_org(self) -> None:
        """get_for_request always reconstructs from stored state,
        so the org is bound at init time."""
        other_org = self.create_organization()
        other_auth_provider = AuthProvider.objects.create(
            organization_id=other_org.id, provider=self.provider
        )

        with assume_test_silo_mode(SiloMode.CELL):
            other_rpc_org = serialize_rpc_organization(other_org)

        helper = AuthHelper(
            request=self.request,
            organization=other_rpc_org,
            auth_provider=other_auth_provider,
            flow=FLOW_LOGIN,
        )
        helper.initialize()

        restored = AuthHelper.get_for_request(self.request)
        assert restored is not None
        assert restored.is_valid()
        assert restored.organization.id == other_org.id


@control_silo_test
class HasVerifiedAccountTest(AuthIdentityHandlerTest):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.get(
                organization=self.organization, user_id=self.user.id
            )
        self.identity_id = self.identity["id"]
        self.verification_value = {
            "user_id": self.user.id,
            "email": self.email,
            "member_id": member.id,
            "identity_id": self.identity_id,
        }

    def test_has_verified_account_success(self) -> None:
        self.create_useremail(email=self.email, user=self.user)
        assert self.handler.has_verified_account(self.verification_value) is True

    def test_has_verified_account_fail_email(self) -> None:
        self.create_useremail(email=self.email, user=self.user)
        identity = {
            "id": "1234",
            "email": "b@test.com",
            "name": "Morty",
            "data": {"foo": "bar"},
        }
        assert self._handler_with(identity).has_verified_account(self.verification_value) is False

    def test_has_verified_account_fail_user_id(self) -> None:
        wrong_user = self.create_user()
        self.create_useremail(email=self.email, user=wrong_user)
        assert self.handler.has_verified_account(self.verification_value) is False


@control_silo_test
class ProviderMismatchTest(TestCase):
    """Tests for provider mismatch detection when user auths with wrong SSO provider."""

    def setUp(self) -> None:
        self.provider = "dummy"
        self.auth_provider_inst = AuthProvider.objects.create(
            organization_id=self.organization.id, provider=self.provider
        )

        self.auth_key = "test_auth_key"
        self.request = _set_up_request()
        self.request.session["auth_key"] = self.auth_key

    def _create_helper_with_state(self, provider_key=None):
        """Create an AuthHelper with initial state and optional provider key mismatch."""
        initial_state = {
            "org_id": self.organization.id,
            "flow": FLOW_LOGIN,
            "provider_model_id": self.auth_provider_inst.id,
            "provider_key": self.provider,
            "referrer": None,
            "step_index": 1,
            "signature": None,
            "config": {},
            "data": {"provider_key": provider_key} if provider_key else {},
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        helper = AuthHelper.get_for_request(self.request)
        assert helper is not None
        return helper

    @mock.patch("sentry.auth.helper.messages")
    @mock.patch("sentry.auth.helper.metrics")
    def test_provider_mismatch_redirects_to_correct_sso(
        self, mock_metrics: mock.MagicMock, mock_messages: mock.MagicMock
    ) -> None:
        """Test that authenticating with wrong provider redirects to correct SSO."""
        helper = self._create_helper_with_state(provider_key="google")

        # Mock the provider to have a build_identity that would fail
        with mock.patch.object(helper.provider, "build_identity") as mock_build:
            mock_build.side_effect = Exception("Should not be called")

            response = helper.finish_pipeline()

        # Should redirect to org SSO page
        assert response.status_code == 302
        assert f"/auth/login/{self.organization.slug}/" in response.url

        # Should show warning message
        mock_messages.add_message.assert_called_once()
        call_args = mock_messages.add_message.call_args
        assert call_args[0][1] == mock_messages.WARNING

        # Should log metric
        mock_metrics.incr.assert_called_with(
            "sso.provider_mismatch",
            tags={
                "expected_provider": self.provider,
                "actual_provider": "google",
            },
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_provider_match_continues_normally(self, mock_messages: mock.MagicMock) -> None:
        """Test that matching provider continues with normal flow."""
        helper = self._create_helper_with_state(provider_key=self.provider)

        # Mock build_identity to return a valid identity
        with mock.patch.object(
            helper.provider,
            "build_identity",
            return_value={"id": "123", "email": "test@example.com", "name": "Test"},
        ):
            # The flow will continue and eventually redirect
            helper.finish_pipeline()

        # Should not have shown provider mismatch warning
        for call in mock_messages.add_message.call_args_list:
            assert "SSO" not in str(call)

    @mock.patch("sentry.auth.helper.messages")
    def test_no_provider_key_continues_normally(self, mock_messages: mock.MagicMock) -> None:
        """Test that missing provider_key doesn't trigger mismatch (backward compat)."""
        helper = self._create_helper_with_state(provider_key=None)

        # Mock build_identity to return a valid identity
        with mock.patch.object(
            helper.provider,
            "build_identity",
            return_value={"id": "123", "email": "test@example.com", "name": "Test"},
        ):
            helper.finish_pipeline()

        # Should not have shown provider mismatch warning
        for call in mock_messages.add_message.call_args_list:
            if call[0][1] == mock_messages.WARNING:
                assert "SSO" not in str(call)


@control_silo_test
class SetupPipelineIdentityLinkingTest(TestCase, HybridCloudTestMixin):
    """Tests that the SSO setup pipeline always links the identity to the authenticated admin."""

    def setUp(self) -> None:
        super().setUp()
        self.provider = "dummy"
        self.admin_user = self.create_user(email="admin@example.com")
        self.create_member(organization=self.organization, user=self.admin_user, role="owner")

        self.auth_key = "test_auth_key"
        self.request = _set_up_request()
        self.request.user = self.admin_user
        self.request.session["auth_key"] = self.auth_key

    def _run_setup_pipeline_with_identity_email(self, identity_email: str) -> HttpResponseBase:
        """Run the setup pipeline with a given email in the IdP assertion."""
        initial_state = {
            "org_id": self.organization.id,
            "flow": FLOW_SETUP_PROVIDER,
            "provider_model_id": None,
            "provider_key": self.provider,
            "referrer": None,
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        helper = AuthHelper.get_for_request(self.request)
        assert helper is not None
        helper.initialize()

        helper.bind_state("email", identity_email)
        helper.bind_state("email_verified", True)

        helper.state.step_index = len(helper.pipeline_views)
        result = helper.current_step()
        return result

    @mock.patch("sentry.auth.helper.messages")
    def test_setup_links_to_admin_when_assertion_email_differs(
        self, mock_messages: mock.MagicMock
    ) -> None:
        """When the IdP assertion email belongs to a different org member,
        the identity is still linked to the admin performing setup."""
        other_user = self.create_user(email="other@example.com")
        self.create_member(organization=self.organization, user=other_user)

        result = self._run_setup_pipeline_with_identity_email("other@example.com")

        assert result.status_code == 302

        auth_provider = AuthProvider.objects.get(
            organization_id=self.organization.id, provider=self.provider
        )
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert auth_identity.user_id == self.admin_user.id
        assert not AuthIdentity.objects.filter(user_id=other_user.id).exists()

    @mock.patch("sentry.auth.helper.messages")
    def test_setup_links_to_admin_when_emails_match(self, mock_messages: mock.MagicMock) -> None:
        """Setup succeeds normally when the IdP assertion email matches the admin."""
        result = self._run_setup_pipeline_with_identity_email("admin@example.com")

        assert result.status_code == 302

        auth_provider = AuthProvider.objects.get(
            organization_id=self.organization.id, provider=self.provider
        )
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert auth_identity.user_id == self.admin_user.id

    @mock.patch("sentry.auth.helper.messages")
    def test_setup_links_to_admin_when_email_matches_no_user(
        self, mock_messages: mock.MagicMock
    ) -> None:
        """When the IdP returns an email that doesn't match any Sentry user,
        the identity is still linked to the admin."""
        result = self._run_setup_pipeline_with_identity_email("unknown@nowhere.com")

        assert result.status_code == 302

        auth_provider = AuthProvider.objects.get(
            organization_id=self.organization.id, provider=self.provider
        )
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert auth_identity.user_id == self.admin_user.id


@control_silo_test
class InactiveUserIdentityTest(AuthIdentityHandlerTest):
    """Tests that inactive-user AuthIdentity always routes through handle_unknown_identity."""

    def _create_inactive_user_with_identity(self):
        """Create an inactive user with an AuthIdentity matching self.identity."""
        inactive_user = self.create_user(is_active=False)
        auth_identity = self.create_auth_identity(
            user=inactive_user,
            auth_provider=self.auth_provider_inst,
            ident=self.identity["id"],
        )
        return inactive_user, auth_identity

    @mock.patch("sentry.auth.helper.render_to_response")
    def test_inactive_identity_unauthenticated_shows_confirmation(
        self, mock_render: mock.MagicMock
    ) -> None:
        """Unauthenticated request + inactive-user identity shows confirmation page."""
        self._create_inactive_user_with_identity()

        self.handler.handle_unknown_identity(self.state)

        assert mock_render.called
        template = mock_render.call_args.args[0]
        assert template == "sentry/auth-confirm-identity.html"

    @mock.patch("sentry.auth.helper.render_to_response")
    def test_inactive_identity_authenticated_request_shows_confirmation(
        self, mock_render: mock.MagicMock
    ) -> None:
        """Authenticated request + inactive-user identity routes through
        handle_unknown_identity and shows confirmation page, not a redirect."""
        inactive_user, auth_identity = self._create_inactive_user_with_identity()
        requesting_user = self.set_up_user()

        result = self.handler.handle_unknown_identity(self.state)

        assert result is mock_render.return_value
        template = mock_render.call_args.args[0]
        assert template == "sentry/auth-confirm-link.html"

        # AuthIdentity still points to the original inactive user
        auth_identity.refresh_from_db()
        assert auth_identity.user_id == inactive_user.id
        assert auth_identity.user_id != requesting_user.id


@control_silo_test
class HandleNewUserTransactionRollbackTest(AuthIdentityHandlerTest):
    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.messages")
    def test_plain_newuser_rollback_shows_confirmation_instead_of_500(
        self, mock_messages: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        self.request.POST = {"op": "newuser"}
        with mock.patch("sentry.auth.helper.User.objects.create", side_effect=ValueError("boom")):
            response = self.handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        mock_messages.add_message.assert_called_once_with(
            self.request, mock_messages.ERROR, ERR_NEW_USER_SETUP_FAILED
        )
        assert not User.objects.filter(email=self.email).exists()


@control_silo_test
class SSOEmailVerificationRequiredTest(AuthIdentityHandlerTest, HybridCloudTestMixin):
    def test_flag_off_creates_user_immediately(self) -> None:
        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": False}):
            self.handler.handle_unknown_identity(self.state)

        assert AuthIdentity.objects.filter(
            auth_provider=self.auth_provider_inst, ident=self.identity["id"]
        ).exists()
        user = User.objects.get(email=self.email)
        assert UserEmail.objects.get(user=user, email=self.email).is_verified is False

    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_flag_on_trust_check_passes_creates_user_with_verified_email(
        self, mock_send: mock.MagicMock
    ) -> None:
        identity: _Identity = {
            "id": "google-123",
            "email": self.email,
            "name": "Morty",
            "data": {},
        }
        identity["email_verified"] = True  # type: ignore[typeddict-unknown-key]

        handler = self._handler_with(identity)
        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch.object(handler, "provider") as mock_provider:
                mock_provider.key = "google"
                handler.handle_unknown_identity(self.state)

        mock_send.assert_not_called()
        user = User.objects.get(email=self.email)
        assert UserEmail.objects.get(user=user, email=self.email).is_verified is True

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.messages")
    def test_confirm_op_does_not_trigger_verified_user_creation(
        self, mock_messages: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.state.verified_email = self.email

        self.request.POST = {"op": "confirm"}
        self.handler.handle_unknown_identity(self.state)

        assert not User.objects.filter(email=self.email).exists()
        assert getattr(self.state, "verified_email", None) == self.email

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.auth")
    def test_login_op_does_not_trigger_verified_user_creation(
        self, mock_auth: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.state.verified_email = self.email

        self.request.POST = {"op": "login", "username": self.email}
        self.handler.handle_unknown_identity(self.state)

        assert not User.objects.filter(email=self.email).exists()
        assert getattr(self.state, "verified_email", None) == self.email

    def test_resubmitting_after_verification_does_not_create_duplicate_user(self) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.state.verified_email = self.email

        self.request.POST = {}
        self.handler.handle_unknown_identity(self.state)
        assert User.objects.filter(email=self.email).count() == 1

        response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-login")
        assert User.objects.filter(email=self.email).count() == 1
        assert (
            AuthIdentity.objects.filter(
                auth_provider=self.auth_provider_inst, ident=self.identity["id"]
            ).count()
            == 1
        )

    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_flag_on_untrusted_provider_sends_verification_email(
        self, mock_send: mock.MagicMock
    ) -> None:
        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-signup-verify-email-pending")
        mock_send.assert_called_once_with(
            email=self.email,
            url_name="sentry-signup-verify-email-sso",
            max_age_minutes=PIPELINE_STATE_TTL // 60,
        )
        assert not User.objects.filter(email=self.email).exists()
        assert self.request.session[PENDING_VERIFICATION_SESSION_KEY] == self.email
        assert self.request.session[PENDING_EXPIRY_TEXT_SESSION_KEY] == PIPELINE_STATE_TTL // 60

    @override_options(
        {
            "auth.email-verification-at-signup.force-in-experiment": ["*@example.com"],
            "auth.email-verification-at-signup.sso-enabled": False,
        }
    )
    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_allowlist_forces_verification_even_without_sso_enabled(
        self, mock_send: mock.MagicMock
    ) -> None:
        self.request.POST = {"op": "newuser"}
        response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-signup-verify-email-pending")
        mock_send.assert_called_once()
        assert not User.objects.filter(email=self.email).exists()
        assert self.request.session[PENDING_VERIFICATION_SESSION_KEY] == self.email

    def test_valid_invite_token_exempts_from_verification(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.create(
                organization=self.organization, email=self.email, token="abc"
            )
        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch("sentry.auth.helper.send_signup_verification_email") as mock_send:
                self.handler.handle_unknown_identity(self.state)

        mock_send.assert_not_called()
        user = User.objects.get(email=self.email)
        assert UserEmail.objects.get(user=user, email=self.email).is_verified is True

    def test_invite_token_email_mismatch_still_requires_verification(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.create(
                organization=self.organization, email="someone-else@example.com", token="abc"
            )
        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch("sentry.auth.helper.send_signup_verification_email") as mock_send:
                response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-signup-verify-email-pending")
        mock_send.assert_called_once()
        assert not User.objects.filter(email=self.email).exists()

    def test_invite_without_session_token_still_requires_verification(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            OrganizationMember.objects.create(organization=self.organization, email=self.email)

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch("sentry.auth.helper.send_signup_verification_email") as mock_send:
                response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-signup-verify-email-pending")
        mock_send.assert_called_once()
        assert not User.objects.filter(email=self.email).exists()

    def test_authenticated_user_without_org_membership_still_gets_invite_exemption(self) -> None:
        # an existing user invited to a different org who declines to merge accounts
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.create(
                organization=self.organization, email=self.email, token="abc"
            )
        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()
        self.set_up_user()

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch("sentry.auth.helper.send_signup_verification_email") as mock_send:
                self.handler.handle_unknown_identity(self.state)

        mock_send.assert_not_called()
        user = User.objects.get(email=self.email)
        assert UserEmail.objects.get(user=user, email=self.email).is_verified is True

    def test_authenticated_member_of_org_does_not_get_invite_exemption(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            member = OrganizationMember.objects.create(
                organization=self.organization, email=self.email, token="abc"
            )
        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()
        user = self.set_up_user()
        self.create_member(organization=self.organization, user=user)

        assert self.handler._email_verified_via_pending_invite() is False

    def test_unapproved_invite_does_not_grant_verification_exemption(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            member = self.create_member(
                organization=self.organization,
                email=self.email,
                invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            )
            member.token = "abc"
            member.save()
        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch("sentry.auth.helper.send_signup_verification_email") as mock_send:
                response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-signup-verify-email-pending")
        mock_send.assert_called_once()

    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_invite_check_failure_falls_back_to_requiring_verification(
        self, mock_send: mock.MagicMock
    ) -> None:
        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch(
                "sentry.auth.helper.ApiInviteHelper.from_session_or_email",
                side_effect=Exception("boom"),
            ):
                response = self.handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert response.url == reverse("sentry-signup-verify-email-pending")
        mock_send.assert_called_once()
        assert not User.objects.filter(email=self.email).exists()

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.messages")
    def test_transaction_rollback_after_verification_allows_resend(
        self, mock_messages: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.state.verified_email = self.email
        self.state.verification_email_sent = True

        handler = self.handler
        self.request.POST = {}
        with mock.patch("sentry.auth.helper.User.objects.create", side_effect=ValueError("boom")):
            response = handler.handle_unknown_identity(self.state)

        assert response is mock_render.return_value
        assert getattr(self.state, "verification_email_sent", None) is False
        assert not User.objects.filter(email=self.email).exists()

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            with mock.patch("sentry.auth.helper.send_signup_verification_email") as mock_send:
                handler.handle_unknown_identity(self.state)
        mock_send.assert_called_once()

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.messages")
    def test_retry_after_failed_verification_does_not_bypass_pipeline(
        self, mock_messages: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.state.verified_email = self.email

        handler = self.handler
        self.request.POST = {}
        with mock.patch("sentry.auth.helper.User.objects.create", side_effect=ValueError("boom")):
            handler.handle_unknown_identity(self.state)

        assert getattr(self.state, "verified_email", None) is None

        self.request.POST = {}
        handler.handle_unknown_identity(self.state)

        assert not User.objects.filter(email=self.email).exists()

    @mock.patch("sentry.auth.helper.messages")
    def test_membership_error_after_verification_does_not_reset_sent_marker(
        self, mock_messages: mock.MagicMock
    ) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.state.verified_email = self.email
        self.state.verification_email_sent = True

        handler = self.handler
        self.request.POST = {}
        with mock.patch.object(
            handler, "_handle_new_membership", side_effect=AuthIdentityUserMismatch()
        ):
            response = handler.handle_unknown_identity(self.state)

        assert isinstance(response, HttpResponseRedirect)
        assert getattr(self.state, "verification_email_sent", None) is True
        assert User.objects.filter(email=self.email).exists()

    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_flag_on_refreshes_pipeline_ttl(self, mock_send: mock.MagicMock) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        client = self.state._client
        client.expire(self.state.redis_key, 5)
        assert client.ttl(self.state.redis_key) <= 5

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            self.handler.handle_unknown_identity(self.state)

        assert client.ttl(self.state.redis_key) > 5

    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_resubmitting_confirmation_form_does_not_resend_email(
        self, mock_send: mock.MagicMock
    ) -> None:
        self.state.regenerate({"flow": FLOW_LOGIN})
        self.request.POST = {"op": "newuser"}

        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            for _ in range(3):
                response = self.handler.handle_unknown_identity(self.state)
                assert isinstance(response, HttpResponseRedirect)
                assert response.url == reverse("sentry-signup-verify-email-pending")

        mock_send.assert_called_once()

    @mock.patch("sentry.auth.email_verification.ratelimiter")
    @mock.patch("sentry.auth.helper.send_signup_verification_email")
    def test_rate_limited_send_shows_error_instead_of_pending_page(
        self, mock_send: mock.MagicMock, mock_ratelimiter: mock.MagicMock
    ) -> None:
        mock_ratelimiter.backend.is_limited.return_value = True

        self.request.POST = {"op": "newuser"}
        with override_options({"auth.email-verification-at-signup.sso-enabled": True}):
            response = self.handler.handle_unknown_identity(self.state)

        assert not isinstance(response, HttpResponseRedirect)
        assert response.status_code == 400
        assert b"Too many attempts" in response.content
        mock_send.assert_not_called()
        mock_ratelimiter.backend.is_limited.assert_called_once_with(
            f"signup-verify-send:email:{hash_email(self.email)}", limit=5, window=300
        )
        assert PENDING_VERIFICATION_SESSION_KEY not in self.request.session
