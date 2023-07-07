import copy
from unittest import mock

import pytest
from django.core import mail
from django.db import ProgrammingError, models, transaction

from sentry import audit_log
from sentry.api.base import ONE_DAY
from sentry.api.endpoints.organization_details import (
    flag_has_changed,
    has_changed,
    old_value,
    update_tracked_data,
)
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models import (
    ApiKey,
    AuditLogEntry,
    InvalidRegionalSlugTargetException,
    Organization,
    OrganizationMember,
    OrganizationOption,
    User,
    UserOption,
)
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test, region_silo_test
from sentry.utils.audit import create_system_audit_entry


@region_silo_test(stable=True)
class OrganizationTest(TestCase, HybridCloudTestMixin):
    def test_slugify_on_new_orgs(self):
        if SiloMode.get_current_mode() != SiloMode.MONOLITH:
            return

        org = Organization.objects.create(name="name", slug="---downtown_canada---")
        assert org.slug == "downtown-canada"

        # Only slugify on new instances of Organization
        org.slug = "---downtown_canada---"
        org.save()
        org.refresh_from_db()
        assert org.slug.startswith("downtown-canada")

        org = Organization.objects.create(name="---foo_bar---")
        assert org.slug == "foo-bar"

    def test_slugify_on_new_orgs_in_region_silo(self):
        if SiloMode.get_current_mode() != SiloMode.REGION:
            return

        org = Organization.objects.create(name="name", slug="---downtown_canada---")
        assert org.slug == "r-na-downtown-canada"

        # Only slugify on new instances of Organization
        org.slug = "---downtown_canada---"
        org.save()
        org.refresh_from_db()
        assert org.slug.startswith("r-na-downtown-canada")

        org = Organization.objects.create(name="---foo_bar---")
        assert org.slug == "r-na-foo-bar"

    def test_slugify_long_org_names(self):
        if SiloMode.get_current_mode() != SiloMode.MONOLITH:
            return

        # Org name is longer than allowed org slug, and should be trimmed when slugified.
        org = Organization.objects.create(name="Stove, Electrical, and Catering Stuff")
        assert org.slug == "stove-electrical-and-catering"

        # Ensure org slugs are unique
        org2 = Organization.objects.create(name="Stove, Electrical, and Catering Stuff")
        assert org2.slug.startswith("stove-electrical-and-cateri-")
        assert len(org2.slug) > len("stove-electrical-and-cateri-")
        assert org.slug != org2.slug

    def test_slugify_long_org_names_within_region(self):
        if SiloMode.get_current_mode() != SiloMode.REGION:
            return

        org = Organization.objects.create(name="Stove, Electrical, and Catering Stuff")
        assert org.slug == "r-na-stove-electrical-and-cate"

        # Ensure org slugs are unique
        org2 = Organization.objects.create(name="Stove, Electrical, and Catering Stuff")
        assert org2.slug.startswith("r-na-stove-electrical-and-")
        assert len(org2.slug) > len("r-na-stove-electrical-and-")
        assert org.slug != org2.slug

    def test_slugify_on_slug_update_in_region_silo(self):
        if SiloMode.get_current_mode() != SiloMode.REGION:
            return

        org = Organization.objects.create(name="santry")
        assert org.slug == "r-na-santry"

        org.slug = "Sand Tree"
        org.save()
        assert org.slug == "r-na-sand-tree"

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

    def test_default_owner_id_only_owner_through_team(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization()
        owner_team = self.create_team(organization=org, org_role="owner")
        self.create_member(organization=org, user=user, teams=[owner_team])
        assert org.default_owner_id == user.id

    @mock.patch.object(
        Organization, "get_owners", side_effect=Organization.get_owners, autospec=True
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
        org.flags.early_adopter = True
        org.flags.codecov_access = True
        org.flags.require_2fa = True
        assert flag_has_changed(org, "early_adopter")
        assert flag_has_changed(org, "codecov_access")
        assert flag_has_changed(org, "allow_joinleave") is False
        assert flag_has_changed(org, "require_2fa") is True

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


@control_silo_test
class Require2fa(TestCase, HybridCloudTestMixin):
    def setUp(self):
        self.owner = self.create_user("foo@example.com")
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
            TotpInterface().enroll(user)
        member = self.create_member(organization=self.org, user=user)
        return user, member

    def is_organization_member(self, user_id, member_id):
        member = OrganizationMember.objects.get(id=member_id)
        user = User.objects.get(id=user_id)
        assert not member.is_pending
        assert not member.email
        assert member.user_id == user.id

    def is_pending_organization_member(self, user_id, member_id, was_booted=True):
        member = OrganizationMember.objects.get(id=member_id)
        if user_id:
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

        with self.options(
            {"system.url-prefix": "http://example.com"}
        ), self.tasks(), outbox_runner():
            self.org.handle_2fa_required(self.request)

        self.is_organization_member(compliant_user.id, compliant_member.id)
        self.is_pending_organization_member(non_compliant_user.id, non_compliant_member.id)

        self.assert_org_member_mapping(org_member=compliant_member)
        self.assert_org_member_mapping(org_member=non_compliant_member)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [non_compliant_user.email]

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

        with self.options(
            {"system.url-prefix": "http://example.com"}
        ), self.tasks(), outbox_runner():
            self.org.handle_2fa_required(self.request)

        for user, member in non_compliant:
            self.is_pending_organization_member(user.id, member.id)
            self.assert_org_member_mapping(org_member=member)

        assert len(mail.outbox) == len(non_compliant)
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
        assert not AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("MEMBER_PENDING"),
            organization_id=self.org.id,
            actor=self.owner,
        ).exists()

    @mock.patch("sentry.tasks.auth.logger")
    def test_handle_2fa_required__no_email__warning(self, auth_log):
        user, member = self._create_user_and_member(has_user_email=False)
        assert not user.has_2fa()
        assert not user.email
        assert not member.email

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)
        self.is_organization_member(user.id, member.id)

        auth_log.warning.assert_called_with(
            "Could not remove 2FA noncompliant user from org",
            extra={"organization_id": self.org.id, "user_id": user.id, "member_id": member.id},
        )

    @mock.patch("sentry.tasks.auth.logger")
    def test_handle_2fa_required__no_actor_and_api_key__ok(self, auth_log):
        user, member = self._create_user_and_member()

        self.assert_org_member_mapping(org_member=member)

        with self.options(
            {"system.url-prefix": "http://example.com"}
        ), self.tasks(), outbox_runner():
            api_key = ApiKey.objects.create(
                organization_id=self.org.id,
                scope_list=["org:read", "org:write", "member:read", "member:write"],
            )
            request = copy.deepcopy(self.request)
            request.user = None
            request.auth = api_key
            self.org.handle_2fa_required(request)
        self.is_pending_organization_member(user.id, member.id)
        self.assert_org_member_mapping(org_member=member)

        assert len(mail.outbox) == 1
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

        with self.options(
            {"system.url-prefix": "http://example.com"}
        ), self.tasks(), outbox_runner():
            request = copy.deepcopy(self.request)
            request.META["REMOTE_ADDR"] = None
            self.org.handle_2fa_required(request)
        self.is_pending_organization_member(user.id, member.id)
        self.assert_org_member_mapping(org_member=member)

        assert len(mail.outbox) == 1
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

    def test_send_delete_confirmation_system_audit(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user("bar@example.com")
        owner_team = self.create_team(organization=org, org_role="owner")
        self.create_member(organization=org, user=user, teams=[owner_team])
        audit_entry = create_system_audit_entry(
            organization=org,
            target_object=org.id,
            event=audit_log.get_event_id("ORG_REMOVE"),
            data=org.get_audit_log_data(),
        )
        with self.tasks():
            org.send_delete_confirmation(audit_entry, ONE_DAY)
        assert len(mail.outbox) == 2
        assert "User: Sentry" in mail.outbox[0].body
        assert "User: Sentry" in mail.outbox[1].body

    def test_absolute_url_no_customer_domain(self):
        org = self.create_organization(owner=self.user, slug="acme")
        url = org.absolute_url("/organizations/acme/restore/")
        assert url == "http://testserver/organizations/acme/restore/"

        url = org.absolute_url("/organizations/acme/issues/", query="project=123", fragment="ref")
        assert url == "http://testserver/organizations/acme/issues/?project=123#ref"

    @with_feature("organizations:customer-domains")
    def test_absolute_url_with_customer_domain(self):
        org = self.create_organization(owner=self.user, slug="acme")
        url = org.absolute_url("/organizations/acme/restore/")
        assert url == "http://acme.testserver/restore/"

        url = org.absolute_url("/organizations/acme/issues/", query="project=123", fragment="ref")
        assert url == "http://acme.testserver/issues/?project=123#ref"

        url = org.absolute_url("/organizations/acme/issues/", query="?project=123", fragment="#ref")
        assert url == "http://acme.testserver/issues/?project=123#ref"


@region_silo_test(stable=True)
class OrganizationUpdateOverrideTest(TestCase):
    def test_slug_change_on_org_update_in_monolith_mode(self):
        if SiloMode.get_current_mode() != SiloMode.MONOLITH:
            return

        org = self.create_organization(name="santry", slug="santry_slug")
        assert org.slug == "santry-slug"
        update_params = dict(slug="new santry")
        org.update(**update_params)
        assert org.slug == "new-santry"
        org.refresh_from_db()
        assert org.slug == "new-santry"

    def test_slug_change_on_org_update_in_region_silo(self):
        if SiloMode.get_current_mode() != SiloMode.REGION:
            return

        org = Organization.objects.create(name="santry", slug="santry_slug")
        assert org.slug == "r-na-santry-slug"
        update_params = dict(slug="new santry")
        org.update(**update_params)
        assert org.slug == "r-na-new-santry"
        org.refresh_from_db()
        assert org.slug == "r-na-new-santry"

    def test_slug_provided_but_matching_for_update(self):
        org = self.create_organization(name="santry", slug="santry_slug")
        update_params = dict(slug=org.slug)
        org_pre_update = Organization.objects.get(id=org.id)
        org.update(**update_params)

        assert org.slug == org_pre_update.slug
        org.refresh_from_db()
        assert org.slug == org_pre_update.slug


@region_silo_test
class OrganizationDeletionTest(TestCase):
    def test_cannot_delete_with_queryset(self):
        org = self.create_organization()
        assert Organization.objects.exists()
        with pytest.raises(ProgrammingError), transaction.atomic():
            Organization.objects.filter(id=org.id).delete()
        assert Organization.objects.exists()

    def test_hybrid_cloud_deletion(self):
        org = self.create_organization()
        user = self.create_user()
        UserOption.objects.set_value(user, "cool_key", "Hello!", organization_id=org.id)
        org_id = org.id

        with outbox_runner():
            org.delete()

        assert not Organization.objects.filter(id=org_id).exists()

        # cascade is asynchronous, ensure there is still related search,
        assert UserOption.objects.filter(organization_id=org_id).exists()
        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        # Ensure they are all now gone.
        assert not UserOption.objects.filter(organization_id=org_id).exists()


@region_silo_test(stable=True)
class TestOrganizationRegionalSlugGeneration(TestCase):
    def test_normal_slug_in_region_mode(self):
        slug = Organization.generate_regional_slug(slugify_target="Hello World")

        if SiloMode.get_current_mode() == SiloMode.REGION:
            assert slug == "r-na-hello-world"
        else:
            assert slug == "hello-world"

    def test_slug_with_only_region_prefix(self):
        slug = Organization.generate_regional_slug(
            slugify_target="r-na", truncate_region_prefix_collisions=True
        )

        if SiloMode.get_current_mode() == SiloMode.REGION:
            assert slug == "r-na-r-na"
        else:
            # Ensure that we've replaced "r-na" itself as it should be reserved
            assert "r-na" not in slug

    def test_slug_with_region_prefix_and_no_truncation(self):
        with pytest.raises(InvalidRegionalSlugTargetException):
            Organization.generate_regional_slug(
                slugify_target="r-na-santry", truncate_region_prefix_collisions=False
            )

    def test_slug_with_region_prefix_and_truncation(self):
        slug = Organization.generate_regional_slug(
            slugify_target="r-de-santry", truncate_region_prefix_collisions=True
        )
        if SiloMode.get_current_mode() == SiloMode.REGION:
            assert slug == "r-na-santry"
        else:
            assert slug == "santry"

    def test_slug_with_nested_prefixes_only_with_truncation(self):
        slug = Organization.generate_regional_slug(slugify_target="r-de-r na r_ja_r-us")
        if SiloMode.get_current_mode() == SiloMode.REGION:
            assert slug == "r-na-r-us"
        else:
            assert "r-us" not in slug
            assert "r-de" not in slug
            assert "r-ja" not in slug
            assert "r-na" not in slug

    def test_slug_with_nested_prefixes_only_without_truncation(self):
        with pytest.raises(InvalidRegionalSlugTargetException):
            Organization.generate_regional_slug(
                slugify_target="r-de-r-na-r-us", truncate_region_prefix_collisions=False
            )

    def test_slug_with_sequence_that_resolves_to_region_prefix(self):
        with pytest.raises(InvalidRegionalSlugTargetException):
            Organization.generate_regional_slug(
                slugify_target="r de sluggy", truncate_region_prefix_collisions=False
            )
