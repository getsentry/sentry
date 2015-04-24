from __future__ import absolute_import

from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.query import merge_into


class MergeIntoTest(TestCase):
    def test_all_the_things(self):
        user_1 = self.create_user('foo@example.com')
        user_2 = self.create_user('bar@example.com')

        merge_into(user_1, user_2)

        # make sure we didn't remove the instance
        assert User.objects.filter(id=user_1.id).exists()
