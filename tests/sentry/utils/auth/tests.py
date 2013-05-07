from __future__ import absolute_import

from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.auth import EmailAuthBackend


class EmailAuthBackendTest(TestCase):
    def setUp(self):
        self.user = User(username="foo", email="baz@example.com")
        self.user.set_password("bar")
        self.user.save()

    @property
    def backend(self):
        return EmailAuthBackend()

    def test_can_authenticate_with_username(self):
        result = self.backend.authenticate(username='foo', password='bar')
        self.assertEquals(result, self.user)

    def test_can_authenticate_with_email(self):
        result = self.backend.authenticate(username='baz@example.com', password='bar')
        self.assertEquals(result, self.user)

    def test_does_not_authenticate_with_invalid_password(self):
        result = self.backend.authenticate(username='foo', password='pizza')
        self.assertEquals(result, None)
