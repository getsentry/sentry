from __future__ import absolute_import

from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.query import merge_into, RangeQuerySetWrapper

from six.moves import xrange


class MergeIntoTest(TestCase):
    def test_all_the_things(self):
        user_1 = self.create_user('foo@example.com')
        user_2 = self.create_user('bar@example.com')

        merge_into(user_1, user_2)

        # make sure we didn't remove the instance
        assert User.objects.filter(id=user_1.id).exists()


class RangeQuerySetWrapperTest(TestCase):
    def test_basic(self):
        total = 10

        for _ in xrange(total):
            self.create_user()

        qs = User.objects.all()

        assert len(list(RangeQuerySetWrapper(qs, step=2))) == total
        assert len(list(RangeQuerySetWrapper(qs, limit=5))) == 5

    def test_loop_and_delete(self):
        total = 10
        for _ in xrange(total):
            self.create_user()

        qs = User.objects.all()

        for user in RangeQuerySetWrapper(qs, step=2):
            user.delete()

        assert User.objects.all().count() == 0
