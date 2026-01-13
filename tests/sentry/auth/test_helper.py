from __future__ import annotations

from typing import TypedDict
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.db import models, router, transaction
from django.test import Client, RequestFactory

from sentry import audit_log
from sentry.analytics.events.user_signup import UserSignUpEvent
from sentry.auth.helper import OK_LINK_IDENTITY, AuthHelper, AuthIdentityHandler
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.store import FLOW_LOGIN, FLOW_SETUP_PROVIDER, AuthHelperSessionStore
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json
from sentry.utils.redis import clusters


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

        self.state = AuthHelperSessionStore(self.request, "pipeline")

    @property
    def handler(self):
        return self._handler_with(self.identity)

    def _handler_with(self, identity):
        with assume_test_silo_mode(SiloMode.REGION):
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


@control_silo_test
class HandleNewUserTest(AuthIdentityHandlerTest, HybridCloudTestMixin):
    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record: mock.MagicMock) -> None:
        auth_identity = self.handler.handle_new_user()
        user = auth_identity.user

        assert user.email == self.email
        with assume_test_silo_mode(SiloMode.REGION):
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
        with assume_test_silo_mode(SiloMode.REGION):
            member = OrganizationMember.objects.create(
                organization=self.organization, email=self.email
            )

        auth_identity = self.handler.handle_new_user()

        with assume_test_silo_mode(SiloMode.REGION):
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

        with assume_test_silo_mode(SiloMode.REGION):
            org_member = OrganizationMember.objects.get(
                organization=self.organization,
                user_id=auth_identity.user_id,
                invite_status=InviteStatus.APPROVED.value,
            )

        self.assert_org_member_mapping(org_member=org_member)
        self.assert_org_member_mapping_not_exists(org_member=member)
        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(id=member.id).exists()

    def test_associate_pending_invite(self) -> None:
        # The org member invite should have a non matching email, but the
        # member id and token will match from the session, allowing association
        with assume_test_silo_mode(SiloMode.REGION):
            member = OrganizationMember.objects.create(
                organization=self.organization, email="different.email@example.com", token="abc"
            )

        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()

        auth_identity = self.handler.handle_new_user()

        with assume_test_silo_mode(SiloMode.REGION):
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
                with assume_test_silo_mode(SiloMode.REGION):
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
        mock_auth.get_login_redirect.assert_called_with(self.request)

        persisted_identity = AuthIdentity.objects.get(ident=auth_identity.ident)
        assert persisted_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.REGION):
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
            mock_auth.get_login_redirect.assert_called_with(self.request)

            persisted_identity = AuthIdentity.objects.get(ident=auth_identity.ident)
            assert persisted_identity.data == self.identity["data"]

            with assume_test_silo_mode(SiloMode.REGION):
                persisted_om = OrganizationMember.objects.get(
                    user_id=user.id, organization=self.organization
                )
            assert getattr(persisted_om.flags, "sso:linked")
            assert getattr(persisted_om.flags, "member-limit:restricted")
            assert not getattr(persisted_om.flags, "sso:invalid")
            with assume_test_silo_mode(SiloMode.REGION):
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
            with assume_test_silo_mode(SiloMode.REGION):
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

        with assume_test_silo_mode(SiloMode.REGION):
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
        with assume_test_silo_mode(SiloMode.REGION):
            existing_om = OrganizationMember.objects.create(
                user_id=user.id, organization=self.organization
            )

        auth_identity = self.handler.handle_attach_identity()
        assert auth_identity.ident == self.identity["id"]
        assert auth_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.REGION):
            persisted_om = OrganizationMember.objects.get(id=existing_om.id)
            assert getattr(persisted_om.flags, "sso:linked")
            assert not getattr(persisted_om.flags, "sso:invalid")

        mock_messages.add_message.assert_called_with(
            self.request, mock_messages.SUCCESS, OK_LINK_IDENTITY
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_new_identity_with_existing_om_idp_flags(self, mock_messages: mock.MagicMock) -> None:
        user = self.set_up_user()
        with assume_test_silo_mode(SiloMode.REGION):
            with (
                assume_test_silo_mode(SiloMode.REGION),
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

        with assume_test_silo_mode(SiloMode.REGION):
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

        with assume_test_silo_mode(SiloMode.REGION):
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
        with assume_test_silo_mode(SiloMode.REGION):
            OrganizationMember.objects.create(user_id=other_user.id, organization=self.organization)

        returned_identity = self.handler.handle_attach_identity()
        assert returned_identity.user == request_user
        assert returned_identity.ident == self.identity["id"]
        assert returned_identity.data == self.identity["data"]

        with assume_test_silo_mode(SiloMode.REGION):
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

        with assume_test_silo_mode(SiloMode.REGION):
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
    def test_unauthenticated_with_existing_user(
        self, mock_create_key: mock.MagicMock, mock_render: mock.MagicMock
    ) -> None:
        existing_user = self.create_user(email=self.email)
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

    # TODO: More test cases for various values of request.POST.get("op")


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

    def test_deleted_auth_provider(self) -> None:
        """Test that get_for_request returns None when AuthProvider is deleted."""
        initial_state = {
            "org_id": self.organization.id,
            "flow": FLOW_LOGIN,
            "provider_model_id": self.auth_provider_inst.id,
            "provider_key": self.provider,
            "referrer": None,
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        # Delete the AuthProvider after session state was created
        self.auth_provider_inst.delete()

        # Should return None instead of raising DoesNotExist
        helper = AuthHelper.get_for_request(self.request)
        assert helper is None


@control_silo_test
class HasVerifiedAccountTest(AuthIdentityHandlerTest):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
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
