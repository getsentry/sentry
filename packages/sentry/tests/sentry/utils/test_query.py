from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.query import RangeQuerySetWrapper


class RangeQuerySetWrapperTest(TestCase):
    def test_basic(self):
        total = 10

        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        assert len(list(RangeQuerySetWrapper(qs, step=2))) == total
        assert len(list(RangeQuerySetWrapper(qs, limit=5))) == 5

    def test_loop_and_delete(self):
        total = 10
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        for user in RangeQuerySetWrapper(qs, step=2):
            user.delete()

        assert User.objects.all().count() == 0
