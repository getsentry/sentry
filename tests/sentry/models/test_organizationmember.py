# coding: utf-8

from __future__ import absolute_import

from datetime import timedelta
from django.core import mail
from django.utils import timezone
from mock import patch

from sentry.auth import manager
from sentry.models import OrganizationMember, INVITE_DAYS_VALID
from sentry.testutils import TestCase


class OrganizationMemberTest(TestCase):
    def test_legacy_token_generation(self):
        member = OrganizationMember(id=1, organization_id=1, email='foo@example.com')
        with self.settings(SECRET_KEY='a'):
            assert member.legacy_token == 'f3f2aa3e57f4b936dfd4f42c38db003e'

    def test_legacy_token_generation_unicode_key(self):
        member = OrganizationMember(id=1, organization_id=1, email='foo@example.com')
        with self.settings(
            SECRET_KEY=(
                "\xfc]C\x8a\xd2\x93\x04\x00\x81\xeak\x94\x02H"
                "\x1d\xcc&P'q\x12\xa2\xc0\xf2v\x7f\xbb*lX"
            )
        ):
            assert member.legacy_token == 'df41d9dfd4ba25d745321e654e15b5d0'

    def test_send_invite_email(self):
        organization = self.create_organization()
        member = OrganizationMember(id=1, organization=organization, email='foo@example.com')
        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            member.send_invite_email()

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.to == ['foo@example.com']

    def test_send_sso_link_email(self):
        organization = self.create_organization()
        member = OrganizationMember(id=1, organization=organization, email='foo@example.com')
        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            member.send_invite_email()

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.to == ['foo@example.com']

    @patch('sentry.utils.email.MessageBuilder')
    def test_send_sso_unlink_email(self, builder):
        user = self.create_user(email='foo@example.com')
        user.password = ''
        user.save()

        organization = self.create_organization()
        member = self.create_member(user=user, organization=organization)
        provider = manager.get('dummy')

        with self.options({'system.url-prefix': 'http://example.com'}), self.tasks():
            member.send_sso_unlink_email(user, provider)

        context = builder.call_args[1]['context']

        assert context['organization'] == organization
        assert context['provider'] == provider

        assert not context['has_password']
        assert 'set_password_url' in context

    def test_token_expires_at_set_on_save(self):
        organization = self.create_organization()
        member = OrganizationMember(
            organization=organization,
            email='foo@example.com')
        member.token = member.generate_token()
        member.save()

        expires_at = timezone.now() + timedelta(days=INVITE_DAYS_VALID)
        assert member.token_expires_at
        assert member.token_expires_at.date() == expires_at.date()

    def test_token_expiration(self):
        organization = self.create_organization()
        member = OrganizationMember(
            organization=organization,
            email='foo@example.com')
        member.token = member.generate_token()
        member.save()

        assert member.is_pending
        assert member.token_expired is False

        member.token_expires_at = timezone.now() - timedelta(minutes=1)
        assert member.token_expired

    def test_set_user(self):
        organization = self.create_organization()
        member = OrganizationMember(
            organization=organization,
            email='foo@example.com')
        member.token = member.generate_token()
        member.save()

        user = self.create_user(email='foo@example.com')
        member.set_user(user)

        assert member.is_pending is False
        assert member.token_expires_at is None
        assert member.token is None
        assert member.email is None

    def test_regenerate_token(self):
        organization = self.create_organization()
        member = OrganizationMember(
            organization=organization,
            email='foo@example.com')
        assert member.token is None
        assert member.token_expires_at is None

        member.regenerate_token()
        assert member.token
        assert member.token_expires_at
        expires_at = timezone.now() + timedelta(days=INVITE_DAYS_VALID)
        assert member.token_expires_at.date() == expires_at.date()
