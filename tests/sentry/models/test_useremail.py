from sentry.models.useremail import UserEmail
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserEmailTest(TestCase):
    def test_hash_does_not_reset(self):
        user = self.create_user("foo@example.com")
        email = UserEmail.objects.get_or_create(user=user)[0]
        email2 = UserEmail.objects.get(id=email.id)

        assert email.validation_hash
        assert email.validation_hash == email2.validation_hash

    def test_find_billing_emails_for(self):
        user1 = self.create_user()
        user2 = self.create_user()
        email1 = self.create_useremail(user=user1, is_billing_notification_verified=True)
        email2 = self.create_useremail(user=user1, is_billing_notification_verified=True)
        email3 = self.create_useremail(user=user2, is_billing_notification_verified=True)
        email4 = self.create_useremail(user=user2, is_billing_notification_verified=True)

        org1 = self.create_organization()
        org2 = self.create_organization()

        member1 = self.create_member(organization=org1, user=user1, role="admin")
        self.create_member(organization=org2, user=user1, role="owner")
        self.create_member(organization=org1, user=user2, role="admin")
        self.create_member(organization=org2, user=user2, role="owner")

        assert set(UserEmail.find_billing_emails_for(organization_id=org1.id)) == {
            email1,
            email2,
            email3,
            email4,
        }
        assert set(UserEmail.find_billing_emails_for(organization_id=org2.id)) == {
            email1,
            email2,
            email3,
            email4,
        }

        # emails 1 and 2 in the context of org1 depend on having an admin or owner role for that org
        member1.update(role="member")
        assert set(UserEmail.find_billing_emails_for(organization_id=org1.id)) == {email3, email4}
        assert set(UserEmail.find_billing_emails_for(organization_id=org2.id)) == {
            email1,
            email2,
            email3,
            email4,
        }

        # email 3 is dependent on having billing notifications verified.
        email3.update(is_billing_notification_verified=False)
        assert set(UserEmail.find_billing_emails_for(organization_id=org1.id)) == {email4}
        assert set(UserEmail.find_billing_emails_for(organization_id=org2.id)) == {
            email1,
            email2,
            email4,
        }
