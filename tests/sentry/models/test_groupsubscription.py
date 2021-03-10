import functools

from sentry.models import (
    GroupSubscription,
    GroupSubscriptionReason,
    NotificationSetting,
)
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.testutils import TestCase


def clear_workflow_options(user):
    NotificationSetting.objects.remove_settings_for_user(user, NotificationSettingTypes.WORKFLOW)


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

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
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

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
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

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )

        get_participants = functools.partial(GroupSubscription.objects.get_participants, group)

        # Implicit subscription, ensure the project setting overrides the
        # default global option.

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.NEVER,
                user=user,
                project=project,
            )

        clear_workflow_options(user)

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.NEVER,
                user=user,
                project=project,
            )

        clear_workflow_options(user)

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
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.NEVER,
                user=user,
            )

        clear_workflow_options(user)

        # Explicit subscription, overridden by the project option.

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.comment}, after={}
        ):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.NEVER,
                user=user,
                project=project,
            )

        clear_workflow_options(user)

        # Explicit subscription, overridden by the project option which also
        # overrides the default option.

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.comment}, after={}
        ):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.NEVER,
                user=user,
                project=project,
            )

    def test_participating_only(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        group = self.create_group(project=project)
        user = self.create_user()
        self.create_member(user=user, organization=org, teams=[team])
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )

        get_participants = functools.partial(GroupSubscription.objects.get_participants, group)

        # Implicit subscription, ensure the project setting overrides the
        # default global option.

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                user=user,
                project=project,
            )

        clear_workflow_options(user)

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )

        with self.assertChanges(
            get_participants, before={user: GroupSubscriptionReason.implicit}, after={}
        ):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.NEVER,
                user=user,
                project=project,
            )

        clear_workflow_options(user)

        # Ensure the global default is applied.

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
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
        clear_workflow_options(user)

        # Ensure the project setting overrides the global default.

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
            project=group.project,
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
        clear_workflow_options(user)

        # Ensure the project setting overrides the global setting.

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
            project=group.project,
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
        clear_workflow_options(user)

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
            project=group.project,
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

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=user,
            project=project,
        )

        # explicit participation, participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        GroupSubscription.objects.filter(user=user, group=group).delete()

        # implicit participation, participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=user,
            project=project,
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
