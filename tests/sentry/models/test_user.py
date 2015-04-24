from __future__ import absolute_import

from sentry.testutils import TestCase


class UserTest(TestCase):
    def test_merge_to(self):
        from_user = self.create_user('foo@example.com')

        to_user = self.create_user('bar@example.com')

        from_user.merge_to(to_user)
