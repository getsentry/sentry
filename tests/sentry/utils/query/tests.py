from __future__ import absolute_import

from sentry.models import User, Team, AccessGroup
from sentry.testutils import TestCase
from sentry.utils.query import merge_into


class MergeIntoTest(TestCase):
    def test_all_the_things(self):
        user_1 = self.create_user('foo@example.com')
        user_2 = self.create_user('bar@example.com')
        team_1 = self.create_team(owner=user_1, name='foo')
        team_2 = self.create_team(owner=user_2, name='bar')
        ag = AccessGroup.objects.create(team=team_2)
        ag.members.add(user_1)
        ag.members.add(user_2)

        merge_into(user_1, user_2)

        assert Team.objects.get(id=team_1.id).owner == user_2
        assert Team.objects.get(id=team_2.id).owner == user_2
        assert list(ag.members.all()) == [user_2]

        # make sure we didn't remove the instance
        assert User.objects.filter(id=user_1.id).exists()
