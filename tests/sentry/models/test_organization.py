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
from sentry.auth.authenticators import TotpInterface
from sentry.models import (
    ApiKey,
    AuditLogEntry,
    Commit,
    File,
    Integration,
    Organization,
    OrganizationAvatar,
    OrganizationIntegration,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationOption,
    Project,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    ReleaseFile,
    Team,
    User,
    UserOption,
)
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test, region_silo_test
from sentry.utils.audit import create_system_audit_entry


@region_silo_test
class OrganizationTest(TestCase):
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

    def test_merge_to(self):
        from_owner = self.create_user("foo@example.com")
        from_org = self.create_organization(owner=from_owner)
        from_team = self.create_team(organization=from_org)
        from_team_two = self.create_team(organization=from_org, slug="bizzy")
        from_project_two = self.create_project(
            organization=from_org, teams=[from_team_two], slug="bizzy"
        )
        from_release = Release.objects.create(version="abcabcabc", organization=from_org)
        from_release_file = ReleaseFile.objects.create(
            release_id=from_release.id,
            organization_id=from_org.id,
            file=File.objects.create(name="foo.py", type=".py"),
            ident="abcdefg",
            name="foo.py",
        )
        from_commit = Commit.objects.create(
            organization_id=from_org.id, repository_id=1, key="abcdefg"
        )
        from_release_commit = ReleaseCommit.objects.create(
            release=from_release, commit=from_commit, order=1, organization_id=from_org.id
        )
        from_release_environment = ReleaseEnvironment.objects.create(
            release_id=from_release.id,
            project_id=from_project_two.id,
            organization_id=from_org.id,
            environment_id=1,
        )
        from_avatar = OrganizationAvatar.objects.create(organization=from_org)
        integration = Integration.objects.create(
            provider="slack",
            external_id="some_slack",
            name="Test Slack",
            metadata={"domain_name": "slack-test.slack.com"},
        )

        integration.add_organization(from_org, from_owner)

        from_user = self.create_user("baz@example.com")
        other_user = self.create_user("bizbaz@example.com")
        self.create_member(organization=from_org, user=from_user)
        other_member = self.create_member(organization=from_org, user=other_user)

        OrganizationMemberTeam.objects.create(organizationmember=other_member, team=from_team)

        to_owner = self.create_user("bar@example.com")
        to_org = self.create_organization(owner=to_owner)
        to_team = self.create_team(organization=to_org)
        to_team_two = self.create_team(organization=to_org, slug="bizzy")
        to_project_two = self.create_project(organization=to_org, teams=[to_team_two], slug="bizzy")
        to_member = self.create_member(organization=to_org, user=other_user)
        to_release = Release.objects.create(version="abcabcabc", organization=to_org)

        OrganizationMemberTeam.objects.create(organizationmember=to_member, team=to_team)

        from_org.merge_to(to_org)

        assert OrganizationMember.objects.filter(
            organization=to_org, user=from_owner, role="owner"
        ).exists()

        team = Team.objects.get(id=from_team.id)
        assert team.organization == to_org

        member = OrganizationMember.objects.get(user=other_user, organization=to_org)
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=to_team
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member, team=from_team
        ).exists()

        from_team_two = Team.objects.get(id=from_team_two.id)
        assert from_team_two.slug != "bizzy"
        assert from_team_two.organization == to_org

        from_project_two = Project.objects.get(id=from_project_two.id)
        assert from_project_two.slug != "bizzy"
        assert from_project_two.organization == to_org
        assert from_project_two.teams.first() == from_team_two

        to_team_two = Team.objects.get(id=to_team_two.id)
        assert to_team_two.slug == "bizzy"
        assert to_team_two.organization == to_org

        to_project_two = Project.objects.get(id=to_project_two.id)
        assert to_project_two.slug == "bizzy"
        assert to_project_two.organization == to_org
        assert to_project_two.teams.first() == to_team_two

        assert not Release.objects.filter(id=from_release.id).exists()
        assert ReleaseFile.objects.get(id=from_release_file.id).organization_id == to_org.id
        assert ReleaseFile.objects.get(id=from_release_file.id).release_id == to_release.id
        assert Commit.objects.get(id=from_commit.id).organization_id == to_org.id
        assert ReleaseCommit.objects.get(id=from_release_commit.id).organization_id == to_org.id
        assert ReleaseCommit.objects.get(id=from_release_commit.id).release == to_release
        assert (
            ReleaseEnvironment.objects.get(id=from_release_environment.id).organization_id
            == to_org.id
        )
        assert (
            ReleaseEnvironment.objects.get(id=from_release_environment.id).release_id
            == to_release.id
        )

        assert OrganizationAvatar.objects.filter(id=from_avatar.id, organization=to_org).exists()
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=to_org.id
        ).exists()

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
        assert member.user == user

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

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
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

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
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
        assert not member.user

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

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
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

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
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
