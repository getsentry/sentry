from __future__ import absolute_import

from sentry.models import (
    Commit, File, OrganizationMember, OrganizationMemberTeam, OrganizationOption, Project, Release, ReleaseCommit, ReleaseEnvironment, ReleaseFile, Team, TotpInterface
)
from sentry.testutils import TestCase
from django.core import mail


class OrganizationTest(TestCase):
    def test_merge_to(self):
        from_owner = self.create_user('foo@example.com')
        from_org = self.create_organization(owner=from_owner)
        from_team = self.create_team(organization=from_org)
        from_team_two = self.create_team(organization=from_org, slug='bizzy')
        from_project_two = self.create_project(
            organization=from_org,
            teams=[from_team_two],
            slug='bizzy',
        )
        from_release = Release.objects.create(version='abcabcabc', organization=from_org)
        from_release_file = ReleaseFile.objects.create(
            release=from_release,
            organization=from_org,
            file=File.objects.create(name='foo.py', type='.py'),
            ident='abcdefg',
            name='foo.py'
        )
        from_commit = Commit.objects.create(
            organization_id=from_org.id, repository_id=1, key='abcdefg'
        )
        from_release_commit = ReleaseCommit.objects.create(
            release=from_release,
            commit=from_commit,
            order=1,
            organization_id=from_org.id,
        )
        from_release_environment = ReleaseEnvironment.objects.create(
            release_id=from_release.id,
            project_id=from_project_two.id,
            organization_id=from_org.id,
            environment_id=1
        )
        from_user = self.create_user('baz@example.com')
        other_user = self.create_user('bizbaz@example.com')
        self.create_member(organization=from_org, user=from_user)
        other_member = self.create_member(organization=from_org, user=other_user)

        OrganizationMemberTeam.objects.create(
            organizationmember=other_member,
            team=from_team,
        )

        to_owner = self.create_user('bar@example.com')
        to_org = self.create_organization(owner=to_owner)
        to_team = self.create_team(organization=to_org)
        to_team_two = self.create_team(organization=to_org, slug='bizzy')
        to_project_two = self.create_project(
            organization=to_org,
            teams=[to_team_two],
            slug='bizzy',
        )
        to_member = self.create_member(organization=to_org, user=other_user)
        to_release = Release.objects.create(version='abcabcabc', organization=to_org)

        OrganizationMemberTeam.objects.create(
            organizationmember=to_member,
            team=to_team,
        )

        from_org.merge_to(to_org)

        assert OrganizationMember.objects.filter(
            organization=to_org,
            user=from_owner,
            role='owner',
        ).exists()

        team = Team.objects.get(id=from_team.id)
        assert team.organization == to_org

        member = OrganizationMember.objects.get(
            user=other_user,
            organization=to_org,
        )
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=to_team,
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=from_team,
        ).exists()

        from_team_two = Team.objects.get(id=from_team_two.id)
        assert from_team_two.slug != 'bizzy'
        assert from_team_two.organization == to_org

        from_project_two = Project.objects.get(id=from_project_two.id)
        assert from_project_two.slug != 'bizzy'
        assert from_project_two.organization == to_org
        assert from_project_two.teams.first() == from_team_two

        to_team_two = Team.objects.get(id=to_team_two.id)
        assert to_team_two.slug == 'bizzy'
        assert to_team_two.organization == to_org

        to_project_two = Project.objects.get(id=to_project_two.id)
        assert to_project_two.slug == 'bizzy'
        assert to_project_two.organization == to_org
        assert to_project_two.teams.first() == to_team_two

        assert not Release.objects.filter(id=from_release.id).exists()
        assert ReleaseFile.objects.get(id=from_release_file.id).organization == to_org
        assert ReleaseFile.objects.get(id=from_release_file.id).release == to_release
        assert Commit.objects.get(id=from_commit.id).organization_id == to_org.id
        assert ReleaseCommit.objects.get(id=from_release_commit.id).organization_id == to_org.id
        assert ReleaseCommit.objects.get(id=from_release_commit.id).release == to_release
        assert ReleaseEnvironment.objects.get(
            id=from_release_environment.id
        ).organization_id == to_org.id
        assert ReleaseEnvironment.objects.get(
            id=from_release_environment.id
        ).release_id == to_release.id

    def test_get_default_owner(self):
        user = self.create_user('foo@example.com')
        org = self.create_organization(owner=user)
        assert org.get_default_owner() == user

    def test_flags_have_changed(self):
        org = self.create_organization()
        org.flags.early_adopter = True
        org.flags.require_2fa = True
        assert org.flag_has_changed('early_adopter')
        assert org.flag_has_changed('allow_joinleave') is False
        assert org.flag_has_changed('require_2fa') is True

    def test_send_setup_2fa_emails(self):
        owner = self.create_user('foo@example.com')
        TotpInterface().enroll(owner)
        org = self.create_organization(owner=owner)
        non_compliant_members = []
        for num in range(0, 10):
            user = self.create_user('foo_%s@example.com' % num)
            self.create_member(organization=org, user=user)
            if num % 2:
                TotpInterface().enroll(user)
            else:
                non_compliant_members.append(user.email)

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            org.send_setup_2fa_emails()

        assert len(mail.outbox) == len(non_compliant_members)
        assert sorted([email.to[0] for email in mail.outbox]) == sorted(non_compliant_members)

    def test_send_setup_2fa_emails_no_non_compliant_members(self):
        owner = self.create_user('foo@example.com')
        TotpInterface().enroll(owner)
        org = self.create_organization(owner=owner)

        for num in range(0, 10):
            user = self.create_user('foo_%s@example.com' % num)
            self.create_member(organization=org, user=user)
            TotpInterface().enroll(user)

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            org.send_setup_2fa_emails()

        assert len(mail.outbox) == 0

    def test_has_changed(self):
        org = self.create_organization()

        org.name = 'Bizzy'
        assert org.has_changed('name') is True

        OrganizationOption.objects.create(
            organization=org,
            key='sentry:require_scrub_ip_address',
            value=False
        )
        o = OrganizationOption.objects.get(
            organization=org,
            key='sentry:require_scrub_ip_address')
        o.value = True
        assert o.has_changed('value') is True

        OrganizationOption.objects.create(
            organization=org,
            key='sentry:account-rate-limit',
            value=0
        )
        p = OrganizationOption.objects.get(
            organization=org,
            key='sentry:account-rate-limit')
        p.value = 50000
        assert p.has_changed('value') is True

        OrganizationOption.objects.create(
            organization=org,
            key='sentry:project-rate-limit',
            value=85
        )
        r = OrganizationOption.objects.get(
            organization=org,
            key='sentry:project-rate-limit')
        r.value = 85
        assert r.has_changed('value') is False

        OrganizationOption.objects.create(
            organization=org,
            key='sentry:sensitive_fields',
            value=[]
        )
        s = OrganizationOption.objects.get(
            organization=org,
            key='sentry:sensitive_fields')
        s.value = ['email']
        assert s.has_changed('value') is True

        OrganizationOption.objects.create(
            organization=org,
            key='sentry:safe_fields',
            value=['email']
        )
        f = OrganizationOption.objects.get(
            organization=org,
            key='sentry:safe_fields')
        f.value = ['email']
        assert f.has_changed('value') is False
