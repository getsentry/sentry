from __future__ import absolute_import, print_function

from django.core import mail

from sentry.models import AuthProvider, OrganizationMember
from sentry.testutils import TestCase
from sentry.tasks.auth import email_missing_links, email_unlink_notifications


class EmailMissingLinksTest(TestCase):
    def setUp(self):
        super(EmailMissingLinksTest, self).setUp()
        self.user = self.create_user(email="bar@example.com")
        self.organization = self.create_organization(name="Test")
        self.provider = AuthProvider.objects.create(
            organization=self.organization, provider="dummy"
        )
        om = OrganizationMember.objects.create(
            user=self.user,
            organization=self.organization,
            flags=OrganizationMember.flags["sso:linked"],
        )
        assert om.flags["sso:linked"]
        self.user2 = self.create_user(email="baz@example.com")
        om2 = OrganizationMember.objects.create(
            user=self.user2, organization=self.organization, flags=0
        )
        assert not om2.flags["sso:linked"]

    def test_email_missing_links(self):
        with self.tasks():
            email_missing_links(self.organization.id, self.user.id, self.provider.provider)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [self.user2.email]

    def test_email_unlink_notifications(self):
        with self.tasks():
            email_unlink_notifications(self.organization.id, self.user.id, self.provider.provider)

        assert len(mail.outbox) == 2
