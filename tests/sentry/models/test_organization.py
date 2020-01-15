from __future__ import absolute_import

import copy
from sentry.utils.compat import mock

from sentry.models import (
    ApiKey,
    AuditLogEntry,
    AuditLogEntryEvent,
    Commit,
    File,
    Integration,
    OrganizationAvatar,
    OrganizationMember,
    OrganizationIntegration,
    OrganizationMemberTeam,
    OrganizationOption,
    Project,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    ReleaseFile,
    Team,
    TotpInterface,
    User,
)
from sentry.testutils import TestCase
from django.core import mail
from uuid import uuid4


class OrganizationTest(TestCase):
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
            release=from_release,
            organization=from_org,
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
        assert ReleaseFile.objects.get(id=from_release_file.id).organization == to_org
        assert ReleaseFile.objects.get(id=from_release_file.id).release == to_release
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
            integration=integration, organization=to_org
        ).exists()

    def test_get_default_owner(self):
        user = self.create_user("foo@example.com")
        org = self.create_organization(owner=user)
        assert org.get_default_owner() == user

    def test_flags_have_changed(self):
        org = self.create_organization()
        org.flags.early_adopter = True
        org.flags.require_2fa = True
        assert org.flag_has_changed("early_adopter")
        assert org.flag_has_changed("allow_joinleave") is False
        assert org.flag_has_changed("require_2fa") is True

    def test_has_changed(self):
        org = self.create_organization()

        org.name = "Bizzy"
        assert org.has_changed("name") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:require_scrub_ip_address", value=False
        )
        o = OrganizationOption.objects.get(organization=org, key="sentry:require_scrub_ip_address")
        o.value = True
        assert o.has_changed("value") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:account-rate-limit", value=0
        )
        p = OrganizationOption.objects.get(organization=org, key="sentry:account-rate-limit")
        p.value = 50000
        assert p.has_changed("value") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:project-rate-limit", value=85
        )
        r = OrganizationOption.objects.get(organization=org, key="sentry:project-rate-limit")
        r.value = 85
        assert r.has_changed("value") is False

        OrganizationOption.objects.create(organization=org, key="sentry:sensitive_fields", value=[])
        s = OrganizationOption.objects.get(organization=org, key="sentry:sensitive_fields")
        s.value = ["email"]
        assert s.has_changed("value") is True

        OrganizationOption.objects.create(
            organization=org, key="sentry:safe_fields", value=["email"]
        )
        f = OrganizationOption.objects.get(organization=org, key="sentry:safe_fields")
        f.value = ["email"]
        assert f.has_changed("value") is False

        OrganizationOption.objects.create(
            organization=org, key="sentry:store_crash_reports", value=0
        )
        p = OrganizationOption.objects.get(organization=org, key="sentry:store_crash_reports")
        p.value = 10
        assert p.has_changed("value") is True


class Require2fa(TestCase):
    def setUp(self):
        self.owner = self.create_user("foo@example.com")
        TotpInterface().enroll(self.owner)
        self.org = self.create_organization(owner=self.owner)
        self.request = self.make_request(user=self.owner)

    def _create_user(self, has_email=True):
        if not has_email:
            return self.create_user("")
        return self.create_user()

    def _create_user_and_member(self, has_2fa=False, has_user_email=True, has_member_email=False):
        user = self._create_user(has_email=has_user_email)
        if has_2fa:
            TotpInterface().enroll(user)
        if has_member_email:
            email = uuid4().hex
            member = self.create_member(organization=self.org, user=user, email=email)
        else:
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
        assert User.objects.filter(id=user_id).exists()
        assert member.is_pending
        assert member.email
        if was_booted:
            assert member.token
            assert member.token_expires_at
        else:
            assert member.token is None
            assert member.token_expires_at is None

    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__compliant_and_non_compliant_members(self, email_log):
        compliant_user, compliant_member = self._create_user_and_member(has_2fa=True)
        non_compliant_user, non_compliant_member = self._create_user_and_member()

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)

        self.is_organization_member(compliant_user.id, compliant_member.id)
        self.is_pending_organization_member(non_compliant_user.id, non_compliant_member.id)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [non_compliant_user.email]
        assert email_log.info.call_count == 2  # mail.queued, mail.sent

        audit_logs = AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.MEMBER_PENDING, organization=self.org, actor=self.owner
        )
        assert audit_logs.count() == 1
        assert audit_logs[0].data["email"] == non_compliant_user.email
        assert audit_logs[0].target_user_id == non_compliant_user.id

    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__compliant_members(self, email_log):
        compliant = []
        for num in range(0, 4):
            user, member = self._create_user_and_member(has_2fa=True)
            compliant.append((user, member))

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)

        for user, member in compliant:
            self.is_organization_member(user.id, member.id)

        assert len(mail.outbox) == email_log.info.call_count == 0
        assert not AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.MEMBER_PENDING, organization=self.org, actor=self.owner
        ).exists()

    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__non_compliant_members(self, email_log):
        non_compliant = []
        for num in range(0, 4):
            user, member = self._create_user_and_member()
            non_compliant.append((user, member))

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)

        for user, member in non_compliant:
            self.is_pending_organization_member(user.id, member.id)

        assert len(mail.outbox) == len(non_compliant)
        assert email_log.info.call_count == len(non_compliant) * 2  # mail.queued, mail.sent
        assert AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.MEMBER_PENDING, organization=self.org, actor=self.owner
        ).count() == len(non_compliant)

    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__pending_member__ok(self, email_log):
        user, member = self._create_user_and_member(has_member_email=True)
        member.user = None
        member.save()

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)
        self.is_pending_organization_member(user.id, member.id, was_booted=False)

        assert len(mail.outbox) == email_log.info.call_count == 0
        assert not AuditLogEntry.objects.filter(
            event=AuditLogEntryEvent.MEMBER_PENDING, organization=self.org, actor=self.owner
        ).exists()

    @mock.patch("sentry.tasks.auth.logger")
    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__no_user_email__ok(self, email_log, auth_log):
        user, member = self._create_user_and_member(has_user_email=False, has_member_email=True)
        assert not user.email
        assert member.email

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            self.org.handle_2fa_required(self.request)

        self.is_pending_organization_member(user.id, member.id)

        assert email_log.info.call_count == 2  # mail.queued, mail.sent
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [member.email]

        assert not auth_log.warning.called
        auth_log.info.assert_called_with(
            "2FA noncompliant user removed from org",
            extra={"organization_id": self.org.id, "user_id": user.id, "member_id": member.id},
        )

    @mock.patch("sentry.tasks.auth.logger")
    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__no_email__warning(self, email_log, auth_log):
        user, member = self._create_user_and_member(has_user_email=False)
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
    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__no_actor_and_api_key__ok(self, email_log, auth_log):
        user, member = self._create_user_and_member()

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            api_key = ApiKey.objects.create(
                organization=self.org,
                scope_list=["org:read", "org:write", "member:read", "member:write"],
            )
            request = copy.deepcopy(self.request)
            request.user = None
            request.auth = api_key
            self.org.handle_2fa_required(request)
        self.is_pending_organization_member(user.id, member.id)

        assert len(mail.outbox) == 1
        assert email_log.info.call_count == 2  # mail.queued, mail.sent
        assert (
            AuditLogEntry.objects.filter(
                event=AuditLogEntryEvent.MEMBER_PENDING,
                organization=self.org,
                actor=None,
                actor_key=api_key,
            ).count()
            == 1
        )

    @mock.patch("sentry.tasks.auth.logger")
    @mock.patch("sentry.utils.email.logger")
    def test_handle_2fa_required__no_ip_address__ok(self, email_log, auth_log):
        user, member = self._create_user_and_member()

        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            request = copy.deepcopy(self.request)
            request.META["REMOTE_ADDR"] = None
            self.org.handle_2fa_required(request)
        self.is_pending_organization_member(user.id, member.id)

        assert len(mail.outbox) == 1
        assert email_log.info.call_count == 2  # mail.queued, mail.sent
        assert (
            AuditLogEntry.objects.filter(
                event=AuditLogEntryEvent.MEMBER_PENDING,
                organization=self.org,
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
