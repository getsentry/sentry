import copy
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.db import models

from sentry import audit_log
from sentry.api.endpoints.organization_details import (
    flag_has_changed,
    has_changed,
    old_value,
    update_tracked_data,
)
from sentry.auth.authenticators.totp import TotpInterface
from sentry.deletions.tasks.hybrid_cloud import (
    schedule_hybrid_cloud_foreign_key_jobs,
    schedule_hybrid_cloud_foreign_key_jobs_control,
)
from sentry.models.apikey import ApiKey
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption


class OrganizationTest(TestCase, HybridCloudTestMixin):
    def test_slugify_on_new_orgs(self):
        org = Organization.objects.create(name="name", slug="---downtown_canada---")
        assert org.slug == "downtown-canada"

        # Only slugify on new instances of Organization
        org.slug = "---downtown_canada---"
        org.save()
        org.refresh_from_db()
        assert org.slug == "---downtown_canada---"

        org = Organization.objects.create(name="---foo_bar---")
        assert org.slug == "foo-bar"

    def test_slugify_long_org_names(self):
        # Org name is longer than allowed org slug, and should be trimmed when slugified.
        org = Organization.objects.create(name="Stove, Electrical, and Catering Stuff")
        assert org.slug == "stove-electrical-and-catering"

        # Ensure org slugs are unique
        org2 = Organization.objects.create(name="Stove, Electrical, and Catering Stuff")
        assert org2.slug.startswith("stove-electrical-and-cateri-")
        assert len(org2.slug) > len("stove-electrical-and-cateri-")
        assert org.slug != org2.slug

    def test_get_default_owner(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization(owner=user)
        assert org.get_default_owner().id == user.id

    def test_default_owner_id(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization(owner=user)
        assert org.default_owner_id == user.id

    def test_default_owner_id_no_owner(self):
        org = self.create_organization()
        assert org.default_owner_id is None

    @mock.patch.object(
        Organization,
        "get_members_with_org_roles",
        side_effect=Organization.get_members_with_org_roles,
        autospec=True,
    )
    def test_default_owner_id_cached(self, mock_get_owners):
        user = self.create_user("foo@example.com")
        org = self.create_organization(owner=user)
        assert org.default_owner_id == user.id
        assert mock_get_owners.call_count == 1
        assert org.default_owner_id == user.id
        assert mock_get_owners.call_count == 1

    def test_flags_have_changed(self):
        org = self.create_organization()
        update_tracked_data(org)
        org.flags.allow_joinleave = True  # Only flag that defaults to True
        org.flags.early_adopter = True
        org.flags.codecov_access = True
        org.flags.require_2fa = True
        org.flags.disable_member_project_creation = True
        org.flags.prevent_superuser_access = True
        org.flags.disable_member_invite = True
        assert flag_has_changed(org, "allow_joinleave") is False
        assert flag_has_changed(org, "early_adopter")
        assert flag_has_changed(org, "codecov_access")
        assert flag_has_changed(org, "require_2fa")
        assert flag_has_changed(org, "disable_member_project_creation")
        assert flag_has_changed(org, "prevent_superuser_access")
        assert flag_has_changed(org, "disable_member_invite")

    def test_has_changed(self):
        org = self.create_organization()
        update_tracked_data(org)

        org.name = "Bizzy"
        assert has_changed(org, "name") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:require_scrub_ip_address", value=False
        )
        o = OrganizationOption.objects.get(organization=org, key="sentry:require_scrub_ip_address")
        update_tracked_data(o)
        o.value = True
        assert has_changed(o, "value") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:account-rate-limit", value=0
        )
        p = OrganizationOption.objects.get(organization=org, key="sentry:account-rate-limit")
        update_tracked_data(p)
        p.value = 50000
        assert has_changed(p, "value") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:project-rate-limit", value=85
        )
        r = OrganizationOption.objects.get(organization=org, key="sentry:project-rate-limit")
        update_tracked_data(r)
        r.value = 85
        assert has_changed(r, "value") is False

        OrganizationOption.objects.create(organization=org, key="sentry:sensitive_fields", value=[])
        s = OrganizationOption.objects.get(organization=org, key="sentry:sensitive_fields")
        update_tracked_data(s)
        s.value = ["email"]
        assert has_changed(s, "value") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:safe_fields", value=["email"]
        )
        f = OrganizationOption.objects.get(organization=org, key="sentry:safe_fields")
        update_tracked_data(f)
        f.value = ["email"]
        assert has_changed(f, "value") is False

        OrganizationOption.objects.create(
            organization=org, key="sentry:store_crash_reports", value=0
        )
        p = OrganizationOption.objects.get(organization=org, key="sentry:store_crash_reports")
        update_tracked_data(p)
        p.value = 10
        assert has_changed(p, "value") is True

    def test_name_hasnt_changed_on_init(self):
        inst = Organization(id=1, name="bar")
        update_tracked_data(inst)
        self.assertFalse(has_changed(inst, "name"))

    def test_name_has_changes_before_save(self):
        inst = Organization(id=1, name="bar")
        update_tracked_data(inst)
        inst.name = "baz"
        self.assertTrue(has_changed(inst, "name"))
        self.assertEqual(old_value(inst, "name"), "bar")

    def test_name_hasnt_changed_after_save(self):
        inst = Organization(id=1, name="bar")
        update_tracked_data(inst)
        inst.name = "baz"
        self.assertTrue(has_changed(inst, "name"))
        self.assertEqual(old_value(inst, "name"), "bar")
        update_tracked_data(inst)
        models.signals.post_save.send(instance=inst, sender=type(inst), created=False)
        self.assertFalse(has_changed(inst, "name"))


class Require2fa(TestCase, HybridCloudTestMixin):
    def setUp(self):
        self.owner = self.create_user("foo@example.com")
        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(self.owner)
        self.org = self.create_organization(owner=self.owner)
        self.request = self.make_request(user=self.owner)

    def _create_user(self, has_email=True):
        if not has_email:
            return self.create_user("")
        return self.create_user()

    def _create_user_and_member(self, has_2fa=False, has_user_email=True):
        user = self._create_user(has_email=has_user_email)
        if has_2fa:
            with assume_test_silo_mode(SiloMode.CONTROL):
                TotpInterface().enroll(user)
        member = self.create_member(organization=self.org, user=user)
        return user, member

    def is_organization_member(self, user_id, member_id):
        member = OrganizationMember.objects.get(id=member_id)

        with assume_test_silo_mode(SiloMode.CONTROL):
            user = User.objects.get(id=user_id)
        assert not member.is_pending
        assert not member.email
        assert member.user_id == user.id

    def is_pending_organization_member(self, user_id, member_id, was_booted=True):
        member = OrganizationMember.objects.get(id=member_id)
        if user_id:
            with assume_test_silo_mode(SiloMode.CONTROL):
                assert User.objects.filter(id=user_id).exists()
        assert member.is_pending
        assert member.email
        if was_booted:
            assert member.token
            assert member.token_expires_at
        else:
            assert member.token is None
            assert member.token_expires_at is None

    def test_handle_2fa_required__compliant_and_non_compliant_members(self):
        compliant_user, compliant_member = self._create_user_and_member(has_2fa=True)
        non_compliant_user, non_compliant_member = self._create_user_and_member()

        self.assert_org_member_mapping(org_member=compliant_member)
        self.assert_org_member_mapping(org_member=non_compliant_member)

        with (
            self.options({"system.url-prefix": "http://example.com"}),
            self.tasks(),
            outbox_runner(),
        ):
            self.org.handle_2fa_required(self.request)

        self.is_organization_member(compliant_user.id, compliant_member.id)
        self.is_pending_organization_member(non_compliant_user.id, non_compliant_member.id)

        self.assert_org_member_mapping(org_member=compliant_member)
        self.assert_org_member_mapping(org_member=non_compliant_member)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [non_compliant_user.email]

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_logs = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("MEMBER_PENDING"),
                organization_id=self.org.id,
                actor=self.owner,
            )
        assert audit_logs.count() == 1
        assert audit_logs[0].data["email"] == non_compliant_user.email
        assert audit_logs[0].target_user_id == non_compliant_user.id

    def test_handle_2fa_required__compliant_members(self):
        compliant = []
        for num in range(0, 4):
            user, member = self._create_user_and_member(has_2fa=True)
            compliant.append((user, member))

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)

        for user, member in compliant:
            self.is_organization_member(user.id, member.id)

        assert len(mail.outbox) == 0

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("MEMBER_PENDING"),
                organization_id=self.org.id,
                actor=self.owner,
            ).exists()

    def test_handle_2fa_required__non_compliant_members(self):
        non_compliant = []
        for num in range(0, 4):
            user, member = self._create_user_and_member()
            self.assert_org_member_mapping(org_member=member)
            non_compliant.append((user, member))

        with (
            self.options({"system.url-prefix": "http://example.com"}),
            self.tasks(),
            outbox_runner(),
        ):
            self.org.handle_2fa_required(self.request)

        for user, member in non_compliant:
            self.is_pending_organization_member(user.id, member.id)
            self.assert_org_member_mapping(org_member=member)

        assert len(mail.outbox) == len(non_compliant)
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("MEMBER_PENDING"),
                organization_id=self.org.id,
                actor=self.owner,
            ).count() == len(non_compliant)

    def test_handle_2fa_required__pending_member__ok(self):
        member = self.create_member(organization=self.org, email="bob@zombo.com")
        assert not member.user_id

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)
        self.is_pending_organization_member(user_id=None, member_id=member.id, was_booted=False)

        assert len(mail.outbox) == 0

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("MEMBER_PENDING"),
                organization_id=self.org.id,
                actor=self.owner,
            ).exists()

    @mock.patch("sentry.tasks.auth.logger")
    def test_handle_2fa_required__no_email__warning(self, auth_log):
        user, member = self._create_user_and_member(has_user_email=False)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not user.has_2fa()

        assert not user.email
        assert not member.email

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)
        self.is_organization_member(user.id, member.id)

        auth_log.warning.assert_called_with(
            "Could not remove %s noncompliant user from org",
            "2FA",
            extra={"organization_id": self.org.id, "user_id": user.id, "member_id": member.id},
        )

    @mock.patch("sentry.tasks.auth.logger")
    def test_handle_2fa_required__no_actor_and_api_key__ok(self, auth_log):
        user, member = self._create_user_and_member()

        self.assert_org_member_mapping(org_member=member)

        with (
            self.options({"system.url-prefix": "http://example.com"}),
            self.tasks(),
            outbox_runner(),
        ):
            with assume_test_silo_mode(SiloMode.CONTROL):
                api_key = ApiKey.objects.create(
                    organization_id=self.org.id,
                    scope_list=["org:read", "org:write", "member:read", "member:write"],
                )
            request = copy.deepcopy(self.request)
            request.user = AnonymousUser()
            request.auth = api_key
            self.org.handle_2fa_required(request)
        self.is_pending_organization_member(user.id, member.id)
        self.assert_org_member_mapping(org_member=member)

        assert len(mail.outbox) == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("MEMBER_PENDING"),
                    organization_id=self.org.id,
                    actor=None,
                    actor_key=api_key,
                ).count()
                == 1
            )

    @mock.patch("sentry.tasks.auth.logger")
    def test_handle_2fa_required__no_ip_address__ok(self, auth_log):
        user, member = self._create_user_and_member()
        self.assert_org_member_mapping(org_member=member)

        with (
            self.options({"system.url-prefix": "http://example.com"}),
            self.tasks(),
            outbox_runner(),
        ):
            request = copy.deepcopy(self.request)
            request.META["REMOTE_ADDR"] = None
            self.org.handle_2fa_required(request)
        self.is_pending_organization_member(user.id, member.id)
        self.assert_org_member_mapping(org_member=member)

        assert len(mail.outbox) == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert (
                AuditLogEntry.objects.filter(
                    event=audit_log.get_event_id("MEMBER_PENDING"),
                    organization_id=self.org.id,
                    actor=self.owner,
                    actor_key=None,
                    ip_address=None,
                ).count()
                == 1
            )

    def test_get_audit_log_data(self):
        org = self.create_organization()
        result = org.get_audit_log_data()
        assert result["flags"] == int(org.flags)

    def test_absolute_url_no_customer_domain(self):
        org = self.create_organization(owner=self.user, slug="acme")
        url = org.absolute_url("/organizations/acme/restore/")
        assert url == "http://testserver/organizations/acme/restore/"

        url = org.absolute_url("/organizations/acme/issues/", query="project=123", fragment="ref")
        assert url == "http://testserver/organizations/acme/issues/?project=123#ref"

    @with_feature("system:multi-region")
    def test_absolute_url_with_customer_domain(self):
        org = self.create_organization(owner=self.user, slug="acme")
        url = org.absolute_url("/organizations/acme/restore/")
        assert url == "http://acme.testserver/restore/"

        url = org.absolute_url("/organizations/acme/issues/", query="project=123", fragment="ref")
        assert url == "http://acme.testserver/issues/?project=123#ref"

        url = org.absolute_url("/organizations/acme/issues/", query="?project=123", fragment="#ref")
        assert url == "http://acme.testserver/issues/?project=123#ref"

    def test_get_bulk_owner_profiles(self):
        u1, u2, u3 = (self.create_user() for _ in range(3))
        o1, o2, o3 = (self.create_organization(owner=u) for u in (u1, u2, u3))
        o2.get_default_owner()  # populate _default_owner
        with assume_test_silo_mode_of(User):
            u3.delete()

        bulk_owner_profiles = Organization.get_bulk_owner_profiles([o1, o2, o3])
        assert set(bulk_owner_profiles.keys()) == {o1.id, o2.id}
        assert bulk_owner_profiles[o1.id].id == u1.id
        assert bulk_owner_profiles[o2.id].id == u2.id
        assert bulk_owner_profiles[o2.id].name == u2.name
        assert bulk_owner_profiles[o2.id].email == u2.email


class OrganizationDeletionTest(TestCase):
    def add_org_notification_settings(self, org: Organization, user: User):
        with assume_test_silo_mode(SiloMode.CONTROL):
            args = {
                "scope_type": "organization",
                "scope_identifier": org.id,
                "type": "deploy",
                "user_id": user.id,
                "value": "never",
            }
            NotificationSettingOption.objects.create(**args)
            NotificationSettingProvider.objects.create(**args, provider="slack")

    def test_hybrid_cloud_deletion(self):
        org = self.create_organization()
        user = self.create_user()
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserOption.objects.set_value(user, "cool_key", "Hello!", organization_id=org.id)
        org_id = org.id

        self.add_org_notification_settings(org, user)

        # Set up another org + notification settings to validate that this is unaffected by org deletion
        unaffected_user = self.create_user()
        unaffected_org = self.create_organization(owner=unaffected_user)
        self.add_org_notification_settings(unaffected_org, unaffected_user)

        with outbox_runner():
            org.delete()

        assert not Organization.objects.filter(id=org_id).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            # cascade is asynchronous, ensure there is still related search,
            assert UserOption.objects.filter(organization_id=org_id).exists()

        # Run cascades in the region, and then in control
        with self.tasks(), assume_test_silo_mode(SiloMode.REGION):
            schedule_hybrid_cloud_foreign_key_jobs()
        with self.tasks(), assume_test_silo_mode(SiloMode.CONTROL):
            schedule_hybrid_cloud_foreign_key_jobs_control()

        with assume_test_silo_mode(SiloMode.CONTROL):
            # Ensure they are all now gone.
            assert not UserOption.objects.filter(organization_id=org_id).exists()

            assert NotificationSettingOption.objects.filter(
                scope_type="organization",
                scope_identifier=unaffected_org.id,
            ).exists()

            assert not NotificationSettingOption.objects.filter(
                scope_type="organization",
                scope_identifier=org_id,
            ).exists()
