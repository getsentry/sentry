from __future__ import absolute_import

from sentry.models import Team
from sentry.testutils import TestCase


class UserTest(TestCase):
    def test_merge_to(self):
        from_user = self.create_user('foo@example.com')
        from_team = self.create_team(name='foobar', owner=from_user)

        to_user = self.create_user('bar@example.com')
        to_team = self.create_team(name='foobaz', owner=to_user)

        from_user.merge_to(to_user)

        assert Team.objects.filter(owner=from_user).count() == 0
        assert Team.objects.filter(owner=to_user).count() == 2
