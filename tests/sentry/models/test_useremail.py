from __future__ import absolute_import

from sentry.models import UserEmail
from sentry.testutils import TestCase


class UserEmailTest(TestCase):
    def test_hash_does_not_reset(self):
        user = self.create_user("foo@example.com")
        email = UserEmail.objects.get_or_create(user=user)[0]
        email2 = UserEmail.objects.get(id=email.id)

        assert email.validation_hash
        assert email.validation_hash == email2.validation_hash
