from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.test import Client, RequestFactory

from sentry import audit_log
from sentry.auth.helper import (
    OK_LINK_IDENTITY,
    AuthHelper,
    AuthHelperSessionStore,
    AuthIdentityHandler,
)
from sentry.auth.providers.dummy import DummyProvider
from sentry.models import (
    AuditLogEntry,
    AuthIdentity,
    AuthProvider,
    InviteStatus,
    OrganizationMember,
    OrganizationMemberTeam,
    UserEmail,
)
from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test, exempt_from_silo_limits
from sentry.utils import json
from sentry.utils.redis import clusters


def _set_up_request():
    request = RequestFactory().post("/auth/sso/")
    request.user = AnonymousUser()
    request.session = Client().session
    return request


@control_silo_test
class AuthIdentityHandlerTest(TestCase):
    def setUp(self):
        self.provider = "dummy"
        self.request = _set_up_request()

        self.auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider=self.provider
        )
        self.email = "test@example.com"
        self.identity = {
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
        with exempt_from_silo_limits():
            rpc_organization = DatabaseBackedOrganizationService.serialize_organization(
                self.organization
            )
        return AuthIdentityHandler(
            self.auth_provider,
            DummyProvider(self.provider),
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
        auth_identity = AuthIdentity.objects.create(
            user=user, auth_provider=self.auth_provider, ident="test_ident"
        )
        return user, auth_identity


@control_silo_test
class HandleNewUserTest(AuthIdentityHandlerTest):
    @mock.patch("sentry.analytics.record")
    def test_simple(self, mock_record):

        auth_identity = self.handler.handle_new_user()
        user = auth_identity.user

        assert user.email == self.email
        assert OrganizationMember.objects.filter(organization=self.organization, user=user).exists()

        signup_record = [r for r in mock_record.call_args_list if r[0][0] == "user.signup"]
        assert signup_record == [
            mock.call(
                "user.signup",
                user_id=user.id,
                source="sso",
                provider=self.provider,
                referrer="in-app",
            )
        ]

    def test_associated_existing_member_invite_by_email(self):
        with exempt_from_silo_limits():
            member = OrganizationMember.objects.create(
                organization=self.organization, email=self.email
            )

        auth_identity = self.handler.handle_new_user()

        assigned_member = OrganizationMember.objects.get(
            organization=self.organization, user=auth_identity.user
        )

        assert assigned_member.id == member.id

    def test_associated_existing_member_invite_request(self):
        member = self.create_member(
            organization=self.organization,
            email=self.email,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        auth_identity = self.handler.handle_new_user()

        assert OrganizationMember.objects.filter(
            organization=self.organization,
            user=auth_identity.user,
            invite_status=InviteStatus.APPROVED.value,
        ).exists()

        assert not OrganizationMember.objects.filter(id=member.id).exists()

    def test_associate_pending_invite(self):
        # The org member invite should have a non matching email, but the
        # member id and token will match from the session, allowing association
        with exempt_from_silo_limits():
            member = OrganizationMember.objects.create(
                organization=self.organization, email="different.email@example.com", token="abc"
            )

        self.request.session["invite_member_id"] = member.id
        self.request.session["invite_token"] = member.token
        self.save_session()

        auth_identity = self.handler.handle_new_user()

        assigned_member = OrganizationMember.objects.get(
            organization=self.organization, user=auth_identity.user
        )

        assert assigned_member.id == member.id


@control_silo_test
class HandleExistingIdentityTest(AuthIdentityHandlerTest):
    @mock.patch("sentry.auth.helper.auth")
    def test_simple(self, mock_auth):
        mock_auth.get_login_redirect.return_value = "test_login_url"
        user, auth_identity = self.set_up_user_identity()

        redirect = self.handler.handle_existing_identity(self.state, auth_identity)

        assert redirect.url == mock_auth.get_login_redirect.return_value
        mock_auth.get_login_redirect.assert_called_with(self.request)

        persisted_identity = AuthIdentity.objects.get(ident=auth_identity.ident)
        assert persisted_identity.data == self.identity["data"]

        persisted_om = OrganizationMember.objects.get(user=user, organization=self.organization)
        assert getattr(persisted_om.flags, "sso:linked")
        assert not getattr(persisted_om.flags, "member-limit:restricted")
        assert not getattr(persisted_om.flags, "sso:invalid")

        login_request, login_user = mock_auth.login.call_args.args
        assert login_request == self.request
        assert login_user == user

    @mock.patch("sentry.auth.helper.auth")
    def test_no_invite_members_flag(self, mock_auth):
        with mock.patch("sentry.features.has", return_value=False) as features_has:
            mock_auth.get_login_redirect.return_value = "test_login_url"
            user, auth_identity = self.set_up_user_identity()

            redirect = self.handler.handle_existing_identity(self.state, auth_identity)

            assert redirect.url == mock_auth.get_login_redirect.return_value
            mock_auth.get_login_redirect.assert_called_with(self.request)

            persisted_identity = AuthIdentity.objects.get(ident=auth_identity.ident)
            assert persisted_identity.data == self.identity["data"]

            persisted_om = OrganizationMember.objects.get(user=user, organization=self.organization)
            assert getattr(persisted_om.flags, "sso:linked")
            assert getattr(persisted_om.flags, "member-limit:restricted")
            assert not getattr(persisted_om.flags, "sso:invalid")
            features_has.assert_any_call("organizations:invite-members", self.organization)


@control_silo_test
class HandleAttachIdentityTest(AuthIdentityHandlerTest):
    @mock.patch("sentry.auth.helper.messages")
    def test_new_identity(self, mock_messages):
        self.set_up_user()

        auth_identity = self.handler.handle_attach_identity()
        assert auth_identity.ident == self.identity["id"]
        assert auth_identity.data == self.identity["data"]

        assert OrganizationMember.objects.filter(
            organization=self.organization,
            user=self.user,
        ).exists()

        for team in self.auth_provider.default_teams.all():
            assert OrganizationMemberTeam.objects.create(
                team=team, organizationmember__user=self.user
            ).exists()

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
    def test_new_identity_with_existing_om(self, mock_messages):
        user = self.set_up_user()
        with exempt_from_silo_limits():
            existing_om = OrganizationMember.objects.create(
                user=user, organization=self.organization
            )

        auth_identity = self.handler.handle_attach_identity()
        assert auth_identity.ident == self.identity["id"]
        assert auth_identity.data == self.identity["data"]

        with exempt_from_silo_limits():
            persisted_om = OrganizationMember.objects.get(id=existing_om.id)
            assert getattr(persisted_om.flags, "sso:linked")
            assert not getattr(persisted_om.flags, "sso:invalid")

        mock_messages.add_message.assert_called_with(
            self.request, mock_messages.SUCCESS, OK_LINK_IDENTITY
        )

    @mock.patch("sentry.auth.helper.messages")
    def test_existing_identity(self, mock_messages):
        user, existing_identity = self.set_up_user_identity()

        returned_identity = self.handler.handle_attach_identity()
        assert returned_identity == existing_identity
        assert not mock_messages.add_message.called

    def _test_with_identity_belonging_to_another_user(self, request_user):
        other_user = self.create_user()

        # The user logs in with credentials from this other identity
        AuthIdentity.objects.create(
            user=other_user, auth_provider=self.auth_provider, ident=self.identity["id"]
        )
        with exempt_from_silo_limits():
            OrganizationMember.objects.create(user=other_user, organization=self.organization)

        returned_identity = self.handler.handle_attach_identity()
        assert returned_identity.user == request_user
        assert returned_identity.ident == self.identity["id"]
        assert returned_identity.data == self.identity["data"]

        persisted_om = OrganizationMember.objects.get(
            user=other_user, organization=self.organization
        )
        assert not getattr(persisted_om.flags, "sso:linked")
        assert getattr(persisted_om.flags, "sso:invalid")

    def test_login_with_other_identity(self):
        request_user = self.set_up_user()
        self._test_with_identity_belonging_to_another_user(request_user)

    def test_wipe_existing_identity(self):
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

        expected_org = DatabaseBackedOrganizationService.serialize_organization(self.organization)

        assert context["organization"] == expected_org
        assert context["identity"] == self.identity
        assert context["provider"] == self.auth_provider.get_provider().name
        assert context["identity_display_name"] == self.identity["name"]
        assert context["identity_identifier"] == self.email
        return context

    @mock.patch("sentry.auth.helper.render_to_response")
    def test_unauthenticated(self, mock_render):
        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert context["existing_user"] is None
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    def test_authenticated(self, mock_render):
        self.set_up_user()
        context = self._test_simple(mock_render, "sentry/auth-confirm-link.html")
        assert context["existing_user"] is self.request.user
        assert "login_form" not in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_unauthenticated_with_existing_user(self, mock_create_key, mock_render):
        existing_user = self.create_user(email=self.email)
        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert not mock_create_key.called
        assert context["existing_user"] == existing_user
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_automatic_migration(self, mock_create_key, mock_render):
        existing_user = self.create_user(email=self.email)
        existing_user.update(password="")

        context = self._test_simple(mock_render, "sentry/auth-confirm-account.html")
        assert mock_create_key.call_count == 1
        (user, org, provider, email, identity_id) = mock_create_key.call_args.args
        assert user.id == existing_user.id
        assert org.id == self.organization.id
        assert provider.id == self.auth_provider.id
        assert email == self.email
        assert identity_id == self.identity["id"]

        assert context["existing_user"].id == existing_user.id
        assert "login_form" in context

    @mock.patch("sentry.auth.helper.render_to_response")
    @mock.patch("sentry.auth.helper.send_one_time_account_confirm_link")
    def test_does_not_migrate_user_with_password(self, mock_create_key, mock_render):
        existing_user = self.create_user(email=self.email)
        context = self._test_simple(mock_render, "sentry/auth-confirm-identity.html")
        assert not mock_create_key.called
        assert context["existing_user"] == existing_user
        assert "login_form" in context

    # TODO: More test cases for various values of request.POST.get("op")


@control_silo_test
class AuthHelperTest(TestCase):
    def setUp(self):
        self.provider = "dummy"
        self.auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider=self.provider
        )

        self.auth_key = "test_auth_key"
        self.request = _set_up_request()
        self.request.session["auth_key"] = self.auth_key

    def _test_pipeline(self, flow):
        initial_state = {
            "org_id": self.organization.id,
            "flow": flow,
            "provider_model_id": self.auth_provider.id,
            "provider_key": None,
        }
        local_client = clusters.get("default").get_local_client_for_key(self.auth_key)
        local_client.set(self.auth_key, json.dumps(initial_state))

        helper = AuthHelper.get_for_request(self.request)
        helper.initialize()
        assert helper.is_valid()

        first_step = helper.current_step()
        assert first_step.status_code == 200

        next_step = helper.next_step()
        assert next_step.status_code == 302
        return next_step

    @mock.patch("sentry.auth.helper.messages")
    def test_login(self, mock_messages):
        final_step = self._test_pipeline(AuthHelper.FLOW_LOGIN)
        assert final_step.url == f"/auth/login/{self.organization.slug}/"

    @mock.patch("sentry.auth.helper.messages")
    def test_setup_provider(self, mock_messages):
        final_step = self._test_pipeline(AuthHelper.FLOW_SETUP_PROVIDER)
        assert final_step.url == f"/settings/{self.organization.slug}/auth/"


class HasVerifiedAccountTest(AuthIdentityHandlerTest):
    def setUp(self):
        super().setUp()
        member = OrganizationMember.objects.get(organization=self.organization, user=self.user)
        self.identity_id = self.identity["id"]
        self.verification_value = {
            "user_id": self.user.id,
            "email": self.email,
            "member_id": member.id,
            "identity_id": self.identity_id,
        }

    def test_has_verified_account_success(self):
        UserEmail.objects.create(email=self.email, user=self.user)
        assert self.handler.has_verified_account(self.verification_value) is True

    def test_has_verified_account_fail_email(self):
        UserEmail.objects.create(email=self.email, user=self.user)
        identity = {
            "id": "1234",
            "email": "b@test.com",
            "name": "Morty",
            "data": {"foo": "bar"},
        }
        assert self._handler_with(identity).has_verified_account(self.verification_value) is False

    def test_has_verified_account_fail_user_id(self):
        wrong_user = self.create_user()
        UserEmail.objects.create(email=self.email, user=wrong_user)
        assert self.handler.has_verified_account(self.verification_value) is False
