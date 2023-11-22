from django.core import mail

from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmember import OrganizationMember
from sentry.silo import SiloMode
from sentry.tasks.auth import (
    email_missing_links,
    email_missing_links_control,
    email_unlink_notifications,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, region_silo_test


@control_silo_test
class EmailMissingLinksControlTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="bar@example.com")
        self.organization = self.create_organization(name="Test")
        self.provider = AuthProvider.objects.create(
            organization_id=self.organization.id, provider="dummy"
        )
        om = self.create_member(
            user_id=self.user.id,
            organization=self.organization,
            flags=OrganizationMember.flags["sso:linked"],
        )

        assert om.flags["sso:linked"]
        self.user2 = self.create_user(email="baz@example.com")

        om2 = self.create_member(user_id=self.user2.id, organization=self.organization, flags=0)
        assert not om2.flags["sso:linked"]

    def test_email_missing_links(self):
        with self.tasks():
            email_missing_links_control(self.organization.id, self.user.id, self.provider.provider)

        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == [self.user2.email]
        assert "to enable signing on with your Dummy account" in message.body
        assert "SSO link request invoked by bar@example.com" in message.body


@region_silo_test
class EmailMissingLinksTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="bar@example.com")
        self.organization = self.create_organization(name="Test")
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.provider = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
        om = self.create_member(
            user_id=self.user.id,
            organization=self.organization,
            flags=OrganizationMember.flags["sso:linked"],
        )

        assert om.flags["sso:linked"]
        self.user2 = self.create_user(email="baz@example.com")

        om2 = self.create_member(user_id=self.user2.id, organization=self.organization, flags=0)
        assert not om2.flags["sso:linked"]

    def test_email_missing_links(self):
        with self.tasks():
            email_missing_links(self.organization.id, self.user.id, self.provider.provider)

        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == [self.user2.email]
        assert "to enable signing on with your Dummy account" in message.body
        assert "SSO link request invoked by bar@example.com" in message.body


@region_silo_test
class EmailUnlinkNotificationsTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="bar@example.com")
        self.organization = self.create_organization(name="Test")
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.provider = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
        om = self.create_member(
            user_id=self.user.id,
            organization=self.organization,
            flags=OrganizationMember.flags["sso:linked"],
        )

        assert om.flags["sso:linked"]
        self.user2 = self.create_user(email="baz@example.com")

        om2 = self.create_member(user_id=self.user2.id, organization=self.organization, flags=0)
        assert not om2.flags["sso:linked"]

        # Invited members don't get emails
        self.create_member(organization=self.organization, email="invited@example.com")

    def test_email_unlink_notifications_with_password(self):
        with self.tasks():
            email_unlink_notifications(self.organization.id, self.user.id, self.provider.provider)

        emails = sorted(message.body for message in mail.outbox)
        assert len(emails) == 2
        assert f"can now login using your email {self.user.email}, and password" in emails[0]
        assert "you'll first have to set a password" not in emails[0]

    def test_email_unlink_notifications_without_password(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.password = ""
            self.user.save()

        with self.tasks():
            email_unlink_notifications(self.organization.id, self.user.id, self.provider.provider)

        emails = sorted(message.body for message in mail.outbox)
        assert len(emails) == 2
        assert "you'll first have to set a password" in emails[0]
        assert f"can now login using your email {self.user.email}, and password" not in emails[0]
        assert f"can now login using your email {self.user2.email}, and password" in emails[1]
