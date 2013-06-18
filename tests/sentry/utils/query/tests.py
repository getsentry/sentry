from __future__ import absolute_import

from sentry.models import User, Team, Project, AccessGroup
from sentry.testutils import TestCase
from sentry.utils.query import merge_into


class MergeIntoTest(TestCase):
    def test_all_the_things(self):
        user_1 = User.objects.create(username='original')
        user_2 = User.objects.create(username='new')
        team_1 = Team.objects.create(owner=user_1)
        team_2 = Team.objects.create(owner=user_2)
        project_1 = Project.objects.create(owner=user_1, team=team_1)
        project_2 = Project.objects.create(owner=user_2, team=team_2)
        ag = AccessGroup.objects.create(team=team_2)
        ag.members.add(user_1)
        ag.members.add(user_2)

        merge_into(user_1, user_2)

        assert Team.objects.get(id=team_1.id).owner == user_2
        assert Team.objects.get(id=team_2.id).owner == user_2
        assert Project.objects.get(id=project_1.id).owner == user_2
        assert Project.objects.get(id=project_2.id).owner == user_2
        assert list(ag.members.all()) == [user_2]

        # make sure we didnt remove the instance
        assert User.objects.filter(id=user_1.id).exists()
