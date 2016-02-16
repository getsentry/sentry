from __future__ import absolute_import, print_function

from django.core import mail

from sentry.models import AuthProvider, OrganizationMember
from sentry.testutils import TestCase
from sentry.tasks.auth import email_missing_links


class EmailMissingLinksTest(TestCase):
    def test_simple(self):
        user = self.create_user(email='bar@example.com')
        organization = self.create_organization(owner=user, name='Test')
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        OrganizationMember.objects.create_or_update(
            user=user,
            organization=organization,
            values={
                'flags': getattr(OrganizationMember.flags, 'sso:linked'),
            },
        )
        user2 = self.create_user(email='baz@example.com')
        OrganizationMember.objects.create(
            user=user2,
            organization=organization,
            flags=0,
        )
        with self.tasks():
            email_missing_links(organization.id)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user2.email]
