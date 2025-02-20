from unittest.mock import patch

import pytest
from django.core import mail
from django.db import models
from django.urls import reverse

from sentry import audit_log, auth
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.dummy import (
    PLACEHOLDER_TEMPLATE,
    DummySAML2Provider,
    dummy_provider_config,
)
from sentry.auth.providers.fly.provider import FlyOAuth2Provider
from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider
from sentry.auth.providers.saml2.provider import Attributes
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.organizations.services.organization import organization_service
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.signals import receivers_raise_on_send
from sentry.silo.base import SiloMode
from sentry.testutils.cases import AuthProviderTestCase, PermissionTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.users.models.user import User
from sentry.web.frontend.organization_auth_settings import get_scim_url


@control_silo_test
class OrganizationAuthSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super().setUp()

        self.auth_provider_inst = AuthProvider.objects.create(
            organization_id=self.organization.id, provider="dummy"
        )
        AuthIdentity.objects.create(
            user=self.user, ident="foo", auth_provider=self.auth_provider_inst
        )
        self.login_as(self.user, organization_id=self.organization.id)
        self.path = reverse(
            "sentry-organization-auth-provider-settings", args=[self.organization.slug]
        )

    def create_owner_and_attach_identity(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="owner", teams=[self.team]
        )
        AuthIdentity.objects.create(user=user, ident="foo2", auth_provider=self.auth_provider_inst)
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(user_id=user.id, organization=self.organization)
            setattr(om.flags, "sso:linked", True)
            om.save()
        return user

    def create_manager_and_attach_identity(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="manager", teams=[self.team]
        )
        AuthIdentity.objects.create(user=user, ident="foo3", auth_provider=self.auth_provider_inst)
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(user_id=user.id, organization=self.organization)
            setattr(om.flags, "sso:linked", True)
            om.save()
        return user

    def test_teamless_admin_cannot_load(self):
        with self.feature("organizations:sso-basic"):
            self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_cannot_load(self):
        with self.feature("organizations:sso-basic"):
            self.assert_team_admin_cannot_access(self.path)

    def test_manager_cannot_load(self):
        with self.feature("organizations:sso-basic"):
            self.assert_role_cannot_access(self.path, "manager")

    def test_manager_can_load(self):
        manager = self.create_manager_and_attach_identity()

        self.login_as(manager, organization_id=self.organization.id)
        with self.feature("organizations:sso-basic"):
            resp = self.client.get(self.path)
            assert resp.status_code == 200

    def test_owner_can_load(self):
        owner = self.create_owner_and_attach_identity()

        self.login_as(owner, organization_id=self.organization.id)
        with self.feature("organizations:sso-basic"):
            resp = self.client.get(self.path)
            assert resp.status_code == 200

    def test_load_if_already_set_up(self):
        owner = self.create_owner_and_attach_identity()

        # can load without feature since already set up
        self.login_as(owner, organization_id=self.organization.id)
        with self.feature({"organizations:sso-basic": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200


@control_silo_test
class OrganizationAuthSettingsTest(AuthProviderTestCase):
    def enroll_user_and_require_2fa(self, user, organization):
        TotpInterface().enroll(user)
        with assume_test_silo_mode(SiloMode.REGION):
            organization.update(flags=models.F("flags").bitor(Organization.flags.require_2fa))
        assert organization.flags.require_2fa.is_set

    def assert_require_2fa_disabled(self, user, organization, logger):
        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=organization.id)
            assert not organization.flags.require_2fa.is_set

        event = AuditLogEntry.objects.get(
            target_object=organization.id, event=audit_log.get_event_id("ORG_EDIT"), actor=user
        )
        audit_log_event = audit_log.get(event.event)
        assert "require_2fa to False when enabling SSO" in audit_log_event.render(event)
        logger.info.assert_called_once_with(
            "Require 2fa disabled during sso setup", extra={"organization_id": organization.id}
        )

    def assert_basic_flow(self, user, organization, expect_error=False):
        configure_path = reverse(
            "sentry-organization-auth-provider-settings", args=[organization.slug]
        )

        with self.feature("organizations:sso-basic"):
            with receivers_raise_on_send():
                resp = self.client.post(configure_path, {"provider": "dummy", "init": True})
            assert resp.status_code == 200
            assert PLACEHOLDER_TEMPLATE in resp.content.decode("utf-8")

            path = reverse("sentry-auth-sso")
            resp = self.client.post(path, {"email": user.email})

        settings_path = reverse("sentry-organization-auth-settings", args=[organization.slug])

        if expect_error:
            self.assertRedirects(resp, settings_path)
            return
        else:
            self.assertRedirects(resp, configure_path)

        auth_provider = AuthProvider.objects.get(organization_id=organization.id, provider="dummy")
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert user == auth_identity.user

        with assume_test_silo_mode(SiloMode.REGION):
            member = OrganizationMember.objects.get(organization=organization, user_id=user.id)

            assert getattr(member.flags, "sso:linked")
            assert not getattr(member.flags, "sso:invalid")

    def create_org_and_auth_provider(self, provider_name="dummy"):
        if provider_name == "fly":
            auth.register("fly", FlyOAuth2Provider)
            self.addCleanup(auth.unregister, "fly", FlyOAuth2Provider)

        self.user.update(is_managed=True)
        with assume_test_silo_mode(SiloMode.REGION):
            organization = self.create_organization(name="foo", owner=self.user)

        auth_provider = AuthProvider.objects.create(
            organization_id=organization.id, provider=provider_name
        )
        AuthIdentity.objects.create(user=self.user, ident="foo", auth_provider=auth_provider)
        return organization, auth_provider

    def create_om_and_link_sso(self, organization):
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(user_id=self.user.id, organization=organization)
            setattr(om.flags, "sso:linked", True)
            om.save()
        return om

    def test_can_start_auth_flow(self):
        organization = self.create_organization(name="foo", owner=self.user)

        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        self.login_as(self.user)

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(path, {"provider": "dummy", "init": True})

        assert resp.status_code == 200
        assert resp.content.decode("utf-8") == PLACEHOLDER_TEMPLATE

    def test_cannot_start_auth_flow_feature_missing(self):
        organization = self.create_organization(name="foo", owner=self.user)

        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        self.login_as(self.user)

        with self.feature({"organizations:sso-basic": False}):
            resp = self.client.post(path, {"provider": "dummy", "init": True})

        assert resp.status_code == 401

    @patch("sentry.auth.helper.logger")
    def test_basic_flow(self, logger):
        user = self.create_user("bar@example.com")
        organization = self.create_organization(name="foo", owner=user)

        self.login_as(user)
        self.assert_basic_flow(user, organization)

        # disable require 2fa logs not called
        assert not AuditLogEntry.objects.filter(
            target_object=organization.id, event=audit_log.get_event_id("ORG_EDIT"), actor=user
        ).exists()
        assert not logger.info.called

    @with_feature("system:multi-region")
    @patch("sentry.auth.helper.logger")
    def test_basic_flow_customer_domain(self, logger):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)

        path = reverse("sentry-customer-domain-organization-auth-provider-settings")
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"):
            resp = self.client.get(path, HTTP_HOST=f"{organization.slug}.testserver")

        content = resp.content.decode("utf-8")
        assert f"http://{organization.slug}.testserver" in content
        assert f"http://{organization.slug}.testserver/issues" in content
        assert f"/organziations/{organization.slug}/issues" not in content

    @patch("sentry.auth.helper.logger")
    @patch("sentry.auth.providers.dummy.DummyProvider.build_identity")
    def test_basic_flow_error(self, build_identity, logger):
        build_identity.side_effect = IdentityNotValid()

        user = self.create_user("bar@example.com")
        organization = self.create_organization(name="foo", owner=user)

        self.login_as(user)
        self.assert_basic_flow(user, organization, expect_error=True)

    @patch("sentry.auth.helper.logger")
    def test_basic_flow__disable_require_2fa(self, logger):
        user = self.create_user("bar@example.com")
        organization = self.create_organization(name="foo", owner=user)

        self.login_as(user)
        self.enroll_user_and_require_2fa(user, organization)

        self.assert_basic_flow(user, organization)
        self.assert_require_2fa_disabled(user, organization, logger)

    def test_disable_provider(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        om = self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])
        with assume_test_silo_mode(SiloMode.REGION):
            assert AuthProviderReplica.objects.filter(organization_id=organization.id).exists()

        self.login_as(self.user, organization_id=organization.id)

        with self.tasks(), self.feature("organizations:sso-basic"):
            resp = self.client.post(path, {"op": "disable"})

        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization_id=organization.id).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()
        assert AuditLogEntry.objects.filter(event=audit_log.get_event_id("SSO_DISABLE")).exists()

        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(id=om.id)

        # No more linked members, users are not managed either.
        assert not getattr(om.flags, "sso:linked")
        assert not User.objects.get(id=om.user_id).is_managed

        # Replica record should be removed too
        with assume_test_silo_mode(SiloMode.REGION):
            assert not AuthProviderReplica.objects.filter(organization_id=organization.id).exists()

        # We should send emails about SSO changes
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert "Action Required" in message.subject
        assert "Single Sign-On has been disabled" in message.body

    def test_reinvite_provider(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        # Create an unlinked member
        user_two = self.create_user(email="unlinked@example.com")
        self.create_member(user=user_two, organization=organization)

        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])
        self.login_as(self.user, organization_id=organization.id)
        with self.tasks(), self.feature("organizations:sso-basic"):
            resp = self.client.post(path, {"op": "reinvite"})

        assert resp.status_code == 302
        assert resp["Location"] == path

        # We should send emails about SSO changes
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert "Action Required" in message.subject
        assert "Single Sign-On has been configured" in message.body
        assert message.to == [user_two.email]

    @with_feature("organizations:sso-basic")
    def test_disable_partner_provider(self):
        organization, auth_provider = self.create_org_and_auth_provider("fly")
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])
        assert AuthProvider.objects.filter(organization_id=organization.id).exists()
        assert AuthProvider.objects.filter(id=auth_provider.id).exists()

        self.login_as(self.user, organization_id=organization.id)

        resp = self.client.post(path, {"op": "disable"})
        assert resp.status_code == 405

        # can disable after partner plan end (changes to "non-partner" fly sso)
        auth_provider.update(provider="fly-non-partner")
        assert AuthProvider.objects.filter(id=auth_provider.id, provider="fly-non-partner").exists()

        resp = self.client.post(path, {"op": "disable"})
        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization_id=organization.id).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()
        disable_audit_log = AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SSO_DISABLE")
        ).first()
        assert disable_audit_log
        assert disable_audit_log.data["provider"] == "fly"

    def test_disable__scim_missing(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        auth_provider.flags.scim_enabled = True
        auth_provider.save()

        with assume_test_silo_mode_of(OrganizationMember, Team):
            member = self.create_om_and_link_sso(organization)
            member.flags["idp:provisioned"] = True
            member.save()

            team = self.create_team(organization, members=[self.user])
            team.idp_provisioned = True
            team.save()

        assert not SentryAppInstallationForProvider.objects.filter(provider=auth_provider).exists()

        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])
        self.login_as(self.user, organization_id=organization.id)

        with self.feature({"organizations:sso-basic": True}):
            resp = self.client.post(path, {"op": "disable"}, follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [
            ("/settings/foo/auth/", 302),
        ]
        assert not AuthProvider.objects.filter(organization_id=organization.id).exists()

        with assume_test_silo_mode_of(OrganizationMember, Team):
            member.refresh_from_db()
            assert not member.flags["idp:provisioned"], "member should not be idp controlled now"

            team.refresh_from_db()
            assert not team.idp_provisioned, "team should not be idp controlled now"

    def test_superuser_disable_provider(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        with self.feature("organizations:sso-scim"), assume_test_silo_mode(SiloMode.CONTROL):
            auth_provider.enable_scim(self.user)

        om = self.create_om_and_link_sso(organization)

        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        with self.feature({"organizations:sso-basic": False}), self.tasks():
            resp = self.client.post(path, {"op": "disable"})

        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization_id=organization.id).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()
        assert AuditLogEntry.objects.filter(event=audit_log.get_event_id("SSO_DISABLE")).exists()

        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(id=om.id)

        assert not getattr(om.flags, "sso:linked")
        assert not User.objects.get(id=om.user_id).is_managed

        assert len(mail.outbox)

        with pytest.raises(SentryAppInstallationForProvider.DoesNotExist):
            SentryAppInstallationForProvider.objects.get(
                organization_id=self.organization.id, provider="dummy_scim"
            )

    def test_edit_sso_settings(self):
        # EDITING SSO SETTINGS
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"), outbox_runner():
            resp = self.client.post(
                path, {"op": "settings", "require_link": False, "default_role": "owner"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        assert getattr(auth_provider.flags, "allow_unlinked")

        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=organization.id)
            assert organization.default_role == "owner"

        result = AuditLogEntry.objects.filter(
            organization_id=organization.id,
            target_object=auth_provider.id,
            event=audit_log.get_event_id("SSO_EDIT"),
            actor=self.user,
        ).get()

        assert result.data == {"require_link": "to False", "default_role": "to owner"}

    def test_edit_sso_settings__sso_required(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"), outbox_runner():
            resp = self.client.post(
                path, {"op": "settings", "require_link": False, "default_role": "member"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        assert getattr(auth_provider.flags, "allow_unlinked")
        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=organization.id)
            assert organization.default_role == "member"

        result = AuditLogEntry.objects.filter(
            organization_id=organization.id,
            target_object=auth_provider.id,
            event=audit_log.get_event_id("SSO_EDIT"),
            actor=self.user,
        ).get()

        assert result.data == {"require_link": "to False"}

    def test_edit_sso_settings__default_role(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"), outbox_runner():
            resp = self.client.post(
                path, {"op": "settings", "require_link": True, "default_role": "owner"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        assert not getattr(auth_provider.flags, "allow_unlinked")
        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=organization.id)
            assert organization.default_role == "owner"

        result = AuditLogEntry.objects.filter(
            organization_id=organization.id,
            target_object=auth_provider.id,
            event=audit_log.get_event_id("SSO_EDIT"),
            actor=self.user,
        ).get()
        assert result.data == {"default_role": "to owner"}

    def test_edit_sso_settings__no_change(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"), outbox_runner():
            resp = self.client.post(
                path, {"op": "settings", "require_link": True, "default_role": "member"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        assert not getattr(auth_provider.flags, "allow_unlinked")
        with assume_test_silo_mode(SiloMode.REGION):
            organization = Organization.objects.get(id=organization.id)
            assert organization.default_role == "member"

        assert not AuditLogEntry.objects.filter(
            organization_id=organization.id, event=audit_log.get_event_id("SSO_EDIT")
        ).exists()

    def test_edit_sso_settings__scim(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature({"organizations:sso-basic": True}):
            resp = self.client.post(
                path,
                {
                    "op": "settings",
                    "require_link": True,
                    "enable_scim": True,
                    "default_role": "member",
                },
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        assert getattr(auth_provider.flags, "scim_enabled")
        assert auth_provider.get_scim_token() is not None

        org_member = organization_service.get_organization_by_id(id=auth_provider.organization_id)
        assert org_member is not None
        assert get_scim_url(auth_provider, org_member.organization) is not None

        # "add" some scim users
        u1 = self.create_user()
        u2 = self.create_user()
        u3 = self.create_user()
        with assume_test_silo_mode(SiloMode.REGION):
            not_scim_member = OrganizationMember.objects.create(
                user_id=u1.id, organization=organization
            )
            not_scim_member.save()

            scim_member = OrganizationMember.objects.create(
                user_id=u2.id, organization=organization
            )
            scim_member.flags["idp:provisioned"] = True
            scim_member.save()

            scim_role_restricted_user = OrganizationMember.objects.create(
                user_id=u3.id, organization=organization
            )
            scim_role_restricted_user.flags["idp:provisioned"] = True
            scim_role_restricted_user.flags["idp:role-restricted"] = True
            scim_role_restricted_user.save()

        with self.feature({"organizations:sso-basic": True}):
            resp = self.client.post(
                path,
                {
                    "op": "settings",
                    "require_link": True,
                    "enable_scim": False,
                    "default_role": "member",
                },
            )

        assert resp.status_code == 200
        auth_provider = AuthProvider.objects.get(organization_id=organization.id)

        assert not getattr(auth_provider.flags, "scim_enabled")
        org_member = organization_service.get_organization_by_id(id=auth_provider.organization_id)
        assert org_member is not None
        assert get_scim_url(auth_provider, org_member.organization) is None
        with pytest.raises(SentryAppInstallationForProvider.DoesNotExist):
            SentryAppInstallationForProvider.objects.get(
                organization_id=self.organization.id, provider="dummy_scim"
            )
        with assume_test_silo_mode(SiloMode.REGION):
            not_scim_member.refresh_from_db()
            scim_member.refresh_from_db()
            scim_role_restricted_user.refresh_from_db()
        assert not any(
            (not_scim_member.flags["idp:provisioned"], not_scim_member.flags["idp:role-restricted"])
        )
        assert not any(
            (scim_member.flags["idp:provisioned"], scim_member.flags["idp:role-restricted"])
        )
        assert not any(
            (
                scim_role_restricted_user.flags["idp:provisioned"],
                scim_role_restricted_user.flags["idp:role-restricted"],
            )
        )


@control_silo_test
class OrganizationAuthSettingsSAML2Test(AuthProviderTestCase):
    provider = DummySAML2Provider
    provider_name = "saml2_dummy"

    def setUp(self):
        super().setUp()
        self.user = self.create_user("foobar@sentry.io")

    def create_org_and_auth_provider(self, provider_name="saml2_dummy"):
        self.user.update(is_managed=True)
        with assume_test_silo_mode(SiloMode.REGION):
            organization = self.create_organization(name="foo", owner=self.user)

        auth_provider = AuthProvider.objects.create(
            organization_id=organization.id, provider=provider_name
        )
        AuthIdentity.objects.create(user=self.user, ident="foo", auth_provider=auth_provider)
        return organization, auth_provider

    def create_om_and_link_sso(self, organization):
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(user_id=self.user.id, organization=organization)
            setattr(om.flags, "sso:linked", True)
            om.save()
        return om

    def test_edit_sso_settings(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider, "config")
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"), outbox_runner():
            resp = self.client.post(
                path,
                {
                    "op": "settings",
                    "require_link": False,
                    "default_role": "owner",
                    "x509cert": "bar_x509_cert",
                },
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(
            organization_id=organization.id, id=auth_provider.id
        )
        assert getattr(auth_provider, "config") == {
            "idp": {
                "x509cert": "bar_x509_cert",
            }
        }

        audit_logs = AuditLogEntry.objects.filter(
            organization_id=organization.id,
            target_object=auth_provider.id,
            event=audit_log.get_event_id("SSO_EDIT"),
            actor=self.user,
        ).get()

        assert audit_logs.data == {
            "x509cert": "to bar_x509_cert",
            "default_role": "to owner",
            "require_link": "to False",
        }


dummy_generic_provider_config = {
    "idp": {
        "entity_id": "https://example.com/saml/metadata/1234",
        "x509cert": "foo_x509_cert",
        "sso_url": "http://example.com/sso_url",
        "slo_url": "http://example.com/slo_url",
    },
    "attribute_mapping": {
        Attributes.IDENTIFIER: "user_id",
        Attributes.USER_EMAIL: "email",
        Attributes.FIRST_NAME: "first_name",
        Attributes.LAST_NAME: "last_name",
    },
}


class DummyGenericSAML2Provider(GenericSAML2Provider):
    name = "saml2_generic_dummy"


@control_silo_test
class OrganizationAuthSettingsGenericSAML2Test(AuthProviderTestCase):
    provider = DummyGenericSAML2Provider
    provider_name = "saml2_generic_dummy"

    def setUp(self):
        super().setUp()
        self.user = self.create_user("foobar@sentry.io")
        self.organization = self.create_organization(owner=self.user, name="saml2-org")
        self.auth_provider_inst = AuthProvider.objects.create(
            provider=self.provider_name,
            config=dummy_provider_config,
            organization_id=self.organization.id,
        )

    def test_update_generic_saml2_config(self):
        self.login_as(self.user, organization_id=self.organization.id)

        expected_provider_config = {
            "idp": {
                "entity_id": "https://foobar.com/saml/metadata/4321",
                "x509cert": "bar_x509_cert",
                "sso_url": "http://foobar.com/sso_url",
                "slo_url": "http://foobar.com/slo_url",
            },
            "attribute_mapping": {
                Attributes.IDENTIFIER: "new_user_id",
                Attributes.USER_EMAIL: "new_email",
                Attributes.FIRST_NAME: "new_first_name",
                Attributes.LAST_NAME: "new_last_name",
            },
        }

        configure_path = reverse(
            "sentry-organization-auth-provider-settings", args=[self.organization.slug]
        )
        payload = {
            **expected_provider_config["idp"],
            **expected_provider_config["attribute_mapping"],
        }
        resp = self.client.post(configure_path, payload)
        assert resp.status_code == 200

        actual = AuthProvider.objects.get(id=self.auth_provider_inst.id)
        assert actual.config == expected_provider_config
        assert actual.config != self.auth_provider_inst.config

        assert actual.provider == self.auth_provider_inst.provider
        assert actual.flags == self.auth_provider_inst.flags
