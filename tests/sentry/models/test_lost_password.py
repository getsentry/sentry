from django.core import mail
from django.urls import reverse

from sentry.models import LostPasswordHash
from sentry.notifications.notifications.membership.lost_password import LostPasswordNotification
from sentry.testutils import TestCase


class LostPasswordTest(TestCase):
    def test_send_recover_mail(self):
        password_hash = LostPasswordHash.objects.create(user=self.user)

        with self.options({"system.url-prefix": "http://testserver"}), self.tasks():
            LostPasswordNotification(password_hash, "1.1.1.1")

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [self.user.email]
        assert msg.subject == "[Sentry] Password Recovery"
        url = "http://testserver" + reverse(
            "sentry-account-recover-confirm",
            args=[self.password_hash.user_id, self.password_hash.hash],
        )
        assert url in msg.body
