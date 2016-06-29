from __future__ import absolute_import

from sentry.models import GroupSubscription
from sentry.testutils import TestCase


class SubscribeTest(TestCase):
    def test_simple(self):
        group = self.create_group()
        user = self.create_user()

        GroupSubscription.objects.subscribe(group=group, user=user)

        assert GroupSubscription.objects.filter(
            group=group,
            user=user,
        ).exists()

        # should not error
        GroupSubscription.objects.subscribe(group=group, user=user)


class GetParticipantsTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(team=team, organization=org)
        group = self.create_group(project=project)
        user = self.create_user('foo@example.com')
        user2 = self.create_user('bar@example.com')
        self.create_member(user=user, organization=org, teams=[team])
        self.create_member(user=user2, organization=org)

        # implicit membership
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == [user]

        # unsubscribed
        GroupSubscription.objects.create(
            user=user,
            group=group,
            project=project,
            is_active=False,
        )

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == []
