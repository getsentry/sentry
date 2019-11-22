from __future__ import absolute_import

import functools
import itertools

from sentry.models import GroupSubscription, GroupSubscriptionReason, UserOption, UserOptionValue
from sentry.testutils import TestCase


class SubscribeTest(TestCase):
    def test_simple(self):
        group = self.create_group()
        user = self.create_user()

        GroupSubscription.objects.subscribe(group=group, user=user)

        assert GroupSubscription.objects.filter(group=group, user=user).exists()

        # should not error
        GroupSubscription.objects.subscribe(group=group, user=user)

    def test_bulk(self):
        group = self.create_group()

        user_ids = []
        for i in range(20):
            user = self.create_user()
            user_ids.append(user.id)

        GroupSubscription.objects.bulk_subscribe(group=group, user_ids=user_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 20

        one_more = self.create_user()
        user_ids.append(one_more.id)

        # should not error
        GroupSubscription.objects.bulk_subscribe(group=group, user_ids=user_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 21

    def test_bulk_dupes(self):
        group = self.create_group()

        user_ids = []

        user = self.create_user()
        user_ids.append(user.id)
        user_ids.append(user.id)

        GroupSubscription.objects.bulk_subscribe(group=group, user_ids=user_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 1

    def test_actor_user(self):
        group = self.create_group()
        user = self.create_user()

        GroupSubscription.objects.subscribe_actor(group=group, actor=user)

        assert GroupSubscription.objects.filter(group=group, user=user).exists()

        # should not error
        GroupSubscription.objects.subscribe_actor(group=group, actor=user)

    def test_actor_team(self):
        org = self.create_organization()
        group = self.create_group()
        user = self.create_user()
        team = self.create_team(organization=org)
        self.create_member(
            user=user, email="bar@example.com", organization=org, role="owner", teams=[team]
        )

        GroupSubscription.objects.subscribe_actor(group=group, actor=team)

        assert GroupSubscription.objects.filter(group=group, user=user).exists()

        # should not error
        GroupSubscription.objects.subscribe_actor(group=group, actor=team)


class GetParticipantsTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        # Include an extra team here to prove the subquery works
        team_2 = self.create_team(organization=org)
        project = self.create_project(teams=[team, team_2], organization=org)
        group = self.create_group(project=project)
        user = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        self.create_member(user=user, organization=org, teams=[team])
        self.create_member(user=user2, organization=org)

        UserOption.objects.set_value(
            user=user, key="workflow:notifications", value=UserOptionValue.all_conversations
        )

        # implicit membership
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {user: GroupSubscriptionReason.implicit}

        # unsubscribed
        GroupSubscription.objects.create(user=user, group=group, project=project, is_active=False)

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        # not participating by default
        GroupSubscription.objects.filter(user=user, group=group).delete()

        UserOption.objects.set_value(
            user=user, key="workflow:notifications", value=UserOptionValue.participating_only
        )

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        # explicitly participating
        GroupSubscription.objects.create(
            user=user,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {user: GroupSubscriptionReason.comment}

    def test_no_conversations(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(user=user, organization=org, teams=[team])

        user_option_sequence = itertools.count(300)  # prevent accidental overlap with user id
        UserOption.objects.set_value(
            user=user, key="workflow:notifications", value=UserOptionValue.all_conversations
        )

        def clear_workflow_options():
            UserOption.objects.filter(user=user, key="workflow:notifications").delete()

        get_participants = functools.partial(GroupSubscription.objects.get_participants, group)

        # Implicit subscription, ensure the project setting overrides the
        # default global option.

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=project,
                key="workflow:notifications",
                value=UserOptionValue.no_conversations,
            )

        clear_workflow_options()

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.all_conversations,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=project,
                key="workflow:notifications",
                value=UserOptionValue.no_conversations,
            )

        clear_workflow_options()

        # Explicit subscription, overridden by the global option.

        GroupSubscription.objects.create(
            user=user,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.comment}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=None,
                key="workflow:notifications",
                value=UserOptionValue.no_conversations,
            )

        clear_workflow_options()

        # Explicit subscription, overridden by the project option.

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.participating_only,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.comment}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=project,
                key="workflow:notifications",
                value=UserOptionValue.no_conversations,
            )

        clear_workflow_options()

        # Explicit subscription, overridden by the project option which also
        # overrides the default option.

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.comment}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=project,
                key="workflow:notifications",
                value=UserOptionValue.no_conversations,
            )

    def test_participating_only(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(user=user, organization=org, teams=[team])
        UserOption.objects.set_value(
            user=user, key="workflow:notifications", value=UserOptionValue.all_conversations
        )

        user_option_sequence = itertools.count(300)  # prevent accidental overlap with user id

        def clear_workflow_options():
            UserOption.objects.filter(user=user, key="workflow:notifications").delete()

        get_participants = functools.partial(GroupSubscription.objects.get_participants, group)

        # Implicit subscription, ensure the project setting overrides the
        # default global option.

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=project,
                key="workflow:notifications",
                value=UserOptionValue.participating_only,
            )

        clear_workflow_options()

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.all_conversations,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            UserOption.objects.create(
                id=next(user_option_sequence),
                user=user,
                project=project,
                key="workflow:notifications",
                value=UserOptionValue.no_conversations,
            )

        clear_workflow_options()

        # Ensure the global default is applied.

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.participating_only,
        )

        with self.assertChanges(
            get_participants, before={}, after={user: GroupSubscriptionReason.comment}
        ):
            subscription = GroupSubscription.objects.create(
                user=user,
                group=group,
                project=project,
                is_active=True,
                reason=GroupSubscriptionReason.comment,
            )

        subscription.delete()
        clear_workflow_options()

        # Ensure the project setting overrides the global default.

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=group.project,
            key="workflow:notifications",
            value=UserOptionValue.participating_only,
        )

        with self.assertChanges(
            get_participants, before={}, after={user: GroupSubscriptionReason.comment}
        ):
            subscription = GroupSubscription.objects.create(
                user=user,
                group=group,
                project=project,
                is_active=True,
                reason=GroupSubscriptionReason.comment,
            )

        subscription.delete()
        clear_workflow_options()

        # Ensure the project setting overrides the global setting.

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.all_conversations,
        )

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=group.project,
            key="workflow:notifications",
            value=UserOptionValue.participating_only,
        )

        with self.assertChanges(
            get_participants, before={}, after={user: GroupSubscriptionReason.comment}
        ):
            subscription = GroupSubscription.objects.create(
                user=user,
                group=group,
                project=project,
                is_active=True,
                reason=GroupSubscriptionReason.comment,
            )

        subscription.delete()
        clear_workflow_options()

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.participating_only,
        )

        UserOption.objects.create(
            id=next(user_option_sequence),
            user=user,
            project=group.project,
            key="workflow:notifications",
            value=UserOptionValue.all_conversations,
        )

        with self.assertChanges(
            get_participants,
            before={user: GroupSubscriptionReason.implicit},
            after={user: GroupSubscriptionReason.comment},
        ):
            subscription = GroupSubscription.objects.create(
                user=user,
                group=group,
                project=project,
                is_active=True,
                reason=GroupSubscriptionReason.comment,
            )

    def test_does_not_include_nonmember(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        group = self.create_group(project=project)
        user = self.create_user("foo@example.com")

        # implicit participation, included by default
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        GroupSubscription.objects.create(
            user=user,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        # explicit participation, included by default
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        UserOption.objects.set_value(
            user=user,
            project=project,
            key="workflow:notifications",
            value=UserOptionValue.participating_only,
        )

        # explicit participation, participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        GroupSubscription.objects.filter(user=user, group=group).delete()

        # implicit participation, participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        UserOption.objects.set_value(
            user=user,
            project=project,
            key="workflow:notifications",
            value=UserOptionValue.all_conversations,
        )

        # explicit participation, explicit participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        GroupSubscription.objects.filter(user=user, group=group).update(
            reason=GroupSubscriptionReason.implicit
        )

        # implicit participation, explicit participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}
