from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.db import models
from sentry.utils.compat.mock import patch

from sentry.auth.authenticators import TotpInterface
from sentry.auth.exceptions import IdentityNotValid
from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    AuthIdentity,
    AuthProvider,
    Organization,
    OrganizationMember,
)
from sentry.testutils import AuthProviderTestCase, PermissionTestCase


class OrganizationAuthSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationAuthSettingsPermissionTest, self).setUp()
        self.auth_provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        AuthIdentity.objects.create(user=self.user, ident="foo", auth_provider=self.auth_provider)
        self.login_as(self.user, organization_id=self.organization.id)
        self.path = reverse(
            "sentry-organization-auth-provider-settings", args=[self.organization.slug]
        )

    def create_owner_and_attach_identity(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="owner", teams=[self.team]
        )
        AuthIdentity.objects.create(user=user, ident="foo2", auth_provider=self.auth_provider)
        om = OrganizationMember.objects.get(user=user, organization=self.organization)
        setattr(om.flags, "sso:linked", True)
        om.save()
        return user

    def create_manager_and_attach_identity(self):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="manager", teams=[self.team]
        )
        AuthIdentity.objects.create(user=user, ident="foo3", auth_provider=self.auth_provider)
        om = OrganizationMember.objects.get(user=user, organization=self.organization)
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

    def test_superuser_can_load(self):
        owner = self.create_owner_and_attach_identity()

        # owner can't load without feature
        self.login_as(owner, organization_id=self.organization.id)
        with self.feature({"organizations:sso-basic": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 302

        # superuser can load without feature
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)
        with self.feature({"organizations:sso-basic": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200


class OrganizationAuthSettingsTest(AuthProviderTestCase):
    def enroll_user_and_require_2fa(self, user, organization):
        TotpInterface().enroll(user)
        organization.update(flags=models.F("flags").bitor(Organization.flags.require_2fa))
        assert organization.flags.require_2fa.is_set

    def assert_require_2fa_disabled(self, user, organization, logger):
        organization = Organization.objects.get(id=organization.id)
        assert not organization.flags.require_2fa.is_set

        event = AuditLogEntry.objects.get(
            target_object=organization.id, event=AuditLogEntryEvent.ORG_EDIT, actor=user
        )
        assert "require_2fa to False when enabling SSO" in event.get_note()
        logger.info.assert_called_once_with(
            "Require 2fa disabled during sso setup", extra={"organization_id": organization.id}
        )

    def assert_basic_flow(self, user, organization, expect_error=False):
        configure_path = reverse(
            "sentry-organization-auth-provider-settings", args=[organization.slug]
        )

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(configure_path, {"provider": "dummy", "init": True})
            assert resp.status_code == 200
            assert self.provider.TEMPLATE in resp.content.decode("utf-8")

            path = reverse("sentry-auth-sso")
            resp = self.client.post(path, {"email": user.email})

        settings_path = reverse("sentry-organization-auth-settings", args=[organization.slug])

        if expect_error:
            self.assertRedirects(resp, settings_path)
            return
        else:
            self.assertRedirects(resp, configure_path)

        auth_provider = AuthProvider.objects.get(organization=organization, provider="dummy")
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider)
        assert user == auth_identity.user

        member = OrganizationMember.objects.get(organization=organization, user=user)

        assert getattr(member.flags, "sso:linked")
        assert not getattr(member.flags, "sso:invalid")

    def create_org_and_auth_provider(self):
        self.user.update(is_managed=True)
        organization = self.create_organization(name="foo", owner=self.user)

        auth_provider = AuthProvider.objects.create(organization=organization, provider="dummy")

        AuthIdentity.objects.create(user=self.user, ident="foo", auth_provider=auth_provider)
        return organization, auth_provider

    def create_om_and_link_sso(self, organization):
        om = OrganizationMember.objects.get(user=self.user, organization=organization)
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
        assert resp.content.decode("utf-8") == self.provider.TEMPLATE

    @patch("sentry.auth.helper.logger")
    def test_basic_flow(self, logger):
        user = self.create_user("bar@example.com")
        organization = self.create_organization(name="foo", owner=user)

        self.login_as(user)
        self.assert_basic_flow(user, organization)

        # disable require 2fa logs not called
        assert not AuditLogEntry.objects.filter(
            target_object=organization.id, event=AuditLogEntryEvent.ORG_EDIT, actor=user
        ).exists()
        assert not logger.info.called

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

    @patch("sentry.web.frontend.organization_auth_settings.email_unlink_notifications")
    def test_disable_provider(self, email_unlink_notifications):
        organization, auth_provider = self.create_org_and_auth_provider()
        om = self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(path, {"op": "disable"})

        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization=organization).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()

        om = OrganizationMember.objects.get(id=om.id)

        assert not getattr(om.flags, "sso:linked")
        assert not om.user.is_managed

        assert email_unlink_notifications.delay.called

    @patch("sentry.web.frontend.organization_auth_settings.email_unlink_notifications")
    def test_superuser_disable_provider(self, email_unlink_notifications):
        organization, auth_provider = self.create_org_and_auth_provider()
        om = self.create_om_and_link_sso(organization)

        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        with self.feature({"organizations:sso-basic": False}):
            resp = self.client.post(path, {"op": "disable"})

        assert resp.status_code == 302

        assert not AuthProvider.objects.filter(organization=organization).exists()
        assert not AuthProvider.objects.filter(id=auth_provider.id).exists()

        om = OrganizationMember.objects.get(id=om.id)

        assert not getattr(om.flags, "sso:linked")
        assert not om.user.is_managed

        assert email_unlink_notifications.delay.called

    def test_edit_sso_settings(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(
                path, {"op": "settings", "require_link": False, "default_role": "owner"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization=organization)
        assert getattr(auth_provider.flags, "allow_unlinked")
        organization = Organization.objects.get(id=organization.id)
        assert organization.default_role == "owner"

        assert AuditLogEntry.objects.filter(
            organization=organization,
            target_object=auth_provider.id,
            event=AuditLogEntryEvent.SSO_EDIT,
            actor=self.user,
            data={"require_link": u"to False", "default_role": u"to owner"},
        ).exists()

    def test_edit_sso_settings__sso_required(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(
                path, {"op": "settings", "require_link": False, "default_role": "member"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization=organization)
        assert getattr(auth_provider.flags, "allow_unlinked")
        organization = Organization.objects.get(id=organization.id)
        assert organization.default_role == "member"

        assert AuditLogEntry.objects.filter(
            organization=organization,
            target_object=auth_provider.id,
            event=AuditLogEntryEvent.SSO_EDIT,
            actor=self.user,
            data={"require_link": u"to False"},
        ).exists()

    def test_edit_sso_settings__default_role(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(
                path, {"op": "settings", "require_link": True, "default_role": "owner"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization=organization)
        assert not getattr(auth_provider.flags, "allow_unlinked")
        organization = Organization.objects.get(id=organization.id)
        assert organization.default_role == "owner"

        assert AuditLogEntry.objects.filter(
            organization=organization,
            target_object=auth_provider.id,
            event=AuditLogEntryEvent.SSO_EDIT,
            actor=self.user,
            data={"default_role": u"to owner"},
        ).exists()

    def test_edit_sso_settings__no_change(self):
        organization, auth_provider = self.create_org_and_auth_provider()
        self.create_om_and_link_sso(organization)
        path = reverse("sentry-organization-auth-provider-settings", args=[organization.slug])

        assert not getattr(auth_provider.flags, "allow_unlinked")
        assert organization.default_role == "member"
        self.login_as(self.user, organization_id=organization.id)

        with self.feature("organizations:sso-basic"):
            resp = self.client.post(
                path, {"op": "settings", "require_link": True, "default_role": "member"}
            )

        assert resp.status_code == 200

        auth_provider = AuthProvider.objects.get(organization=organization)
        assert not getattr(auth_provider.flags, "allow_unlinked")
        organization = Organization.objects.get(id=organization.id)
        assert organization.default_role == "member"

        assert not AuditLogEntry.objects.filter(
            organization=organization, event=AuditLogEntryEvent.SSO_EDIT
        ).exists()
