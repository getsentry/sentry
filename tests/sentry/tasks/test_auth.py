from django.core import mail

from sentry.models import AuthProvider, OrganizationMember
from sentry.silo import SiloMode
from sentry.tasks.auth import email_missing_links, email_unlink_notifications
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test(stable=True)
class TasksAuthTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="bar@example.com")
        self.organization = self.create_organization(name="Test")
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.provider = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
        om = OrganizationMember.objects.create(
            user_id=self.user.id,
            organization=self.organization,
            flags=OrganizationMember.flags["sso:linked"],
        )
        assert om.flags["sso:linked"]
        self.user2 = self.create_user(email="baz@example.com")
        om2 = OrganizationMember.objects.create(
            user_id=self.user2.id, organization=self.organization, flags=0
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
