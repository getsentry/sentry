from django.core import mail
from django.urls import reverse

from sentry.models.lostpasswordhash import LostPasswordHash
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class LostPasswordTest(TestCase):
    def test_send_recover_mail(self):
        password_hash = LostPasswordHash.objects.create(user=self.user)

        with self.options({"system.url-prefix": "http://testserver"}), self.tasks():
            LostPasswordHash.send_recover_password_email(self.user, password_hash.hash, "1.1.1.1")

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [self.user.email]
        assert msg.subject == "[Sentry]Password Recovery"
        url = "http://testserver" + reverse(
            "sentry-account-recover-confirm",
            args=[password_hash.user_id, password_hash.hash],
        )
        assert url in msg.body

    def test_send_relocation_mail(self):
        password_hash = LostPasswordHash.objects.create(user=self.user)

        with self.options({"system.url-prefix": "http://testserver"}), self.tasks():
            LostPasswordHash.send_relocate_account_email(self.user, password_hash.hash, ["testorg"])

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [self.user.email]
        assert (
            msg.subject == "[Sentry]Set Username and Password for Your Relocated Sentry.io Account"
        )
        url = "http://testserver" + reverse(
            "sentry-account-relocate-confirm",
            args=[password_hash.user_id, password_hash.hash],
        )
        assert msg.body.startswith(
            "The following Sentry organizations that you are a member of have been migrated onto sentry.io:\n\n* testorg\n\n\nTo continue with using these accounts at their new location, please claim your account with sentry.io.\n\nClaim Account"
        )
        assert url in msg.body
