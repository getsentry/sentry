# coding: utf-8

from __future__ import absolute_import

from django.core import mail

from sentry.models import OrganizationMember
from sentry.testutils import TestCase


class OrganizationMemberTest(TestCase):
    def test_counter(self):
        organization = self.create_organization(name='Foo')

        user2 = self.create_user('foo@example.com')
        member2 = self.create_member(user=user2, organization=organization)
        assert member2.counter == 2

        user3 = self.create_user('bar@example.com')
        member3 = self.create_member(user=user3, organization=organization)
        assert member3.counter == 3

        user4 = self.create_user('baz@example.com')
        member4 = self.create_member(user=user4, organization=organization)
        assert member4.counter == 4

        member2.delete()

        member3 = OrganizationMember.objects.get(id=member3.id)
        assert member3.counter == 2

        member4 = OrganizationMember.objects.get(id=member4.id)
        assert member4.counter == 3

    def test_token_generation(self):
        member = OrganizationMember(id=1, organization_id=1, email='foo@example.com')
        with self.settings(SECRET_KEY='a'):
            assert member.token == 'f3f2aa3e57f4b936dfd4f42c38db003e'

    def test_token_generation_unicode_key(self):
        member = OrganizationMember(id=1, organization_id=1, email='foo@example.com')
        with self.settings(SECRET_KEY="\xfc]C\x8a\xd2\x93\x04\x00\x81\xeak\x94\x02H\x1d\xcc&P'q\x12\xa2\xc0\xf2v\x7f\xbb*lX"):
            assert member.token == 'df41d9dfd4ba25d745321e654e15b5d0'

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
