# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry import roles
from sentry.testutils import CliTestCase
from sentry.runner.commands.createuser import createuser
from sentry.models import User, OrganizationMember


class CreateUserTest(CliTestCase):
    command = createuser
    default_args = ['--no-input']

    def test_superuser(self):
        rv = self.invoke(
            '--email=you@somewhereawesome.com',
            '--password=awesome',
            '--superuser',
        )
        assert rv.exit_code == 0, rv.output
        assert 'you@somewhereawesome.com' in rv.output
        assert User.objects.count() == 1
        user = User.objects.all()[0]
        assert user.email == 'you@somewhereawesome.com'
        assert user.check_password('awesome')
        assert user.is_superuser
        assert user.is_staff
        assert user.is_active

    def test_no_superuser(self):
        rv = self.invoke(
            '--email=you@somewhereawesome.com',
            '--password=awesome',
        )
        assert rv.exit_code == 0, rv.output
        assert 'you@somewhereawesome.com' in rv.output
        assert User.objects.count() == 1
        user = User.objects.all()[0]
        assert user.email == 'you@somewhereawesome.com'
        assert user.check_password('awesome')
        assert not user.is_superuser
        assert not user.is_staff
        assert user.is_active

    def test_no_password(self):
        rv = self.invoke(
            '--email=you@somewhereawesome.com',
            '--no-password',
        )
        assert rv.exit_code == 0, rv.output
        assert 'you@somewhereawesome.com' in rv.output
        assert User.objects.count() == 1
        user = User.objects.all()[0]
        assert user.email == 'you@somewhereawesome.com'
        assert not user.password
        assert not user.is_superuser
        assert not user.is_staff
        assert user.is_active

    def test_single_org(self):
        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            rv = self.invoke(
                '--email=you@somewhereawesome.com',
                '--no-password',
            )
            assert rv.exit_code == 0, rv.output
            assert 'you@somewhereawesome.com' in rv.output
            assert OrganizationMember.objects.count() == 1
            member = OrganizationMember.objects.all()[0]
            assert member.user.email == 'you@somewhereawesome.com'
            assert member.organization.slug in rv.output
            assert member.role == member.organization.default_role

    def test_single_org_superuser(self):
        with self.settings(SENTRY_SINGLE_ORGANIZATION=True):
            rv = self.invoke(
                '--email=you@somewhereawesome.com',
                '--no-password',
                '--superuser'
            )
            assert rv.exit_code == 0, rv.output
            assert 'you@somewhereawesome.com' in rv.output
            assert OrganizationMember.objects.count() == 1
            member = OrganizationMember.objects.all()[0]
            assert member.user.email == 'you@somewhereawesome.com'
            assert member.organization.slug in rv.output
            assert member.role == roles.get_top_dog().id

    def test_not_single_org(self):
        with self.settings(SENTRY_SINGLE_ORGANIZATION=False):
            rv = self.invoke(
                '--email=you@somewhereawesome.com',
                '--no-password',
            )
            assert rv.exit_code == 0, rv.output
            assert 'you@somewhereawesome.com' in rv.output
            assert OrganizationMember.objects.count() == 0

    def test_no_input(self):
        rv = self.invoke()
        assert rv.exit_code != 0, rv.output

    def test_missing_password(self):
        rv = self.invoke(
            '--email=you@somewhereawesome.com',
        )
        assert rv.exit_code != 0, rv.output
