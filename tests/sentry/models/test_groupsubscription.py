import functools

from sentry.models import GroupSubscription, NotificationSetting
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.user import user_service
from sentry.testutils import TestCase
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.types.integrations import ExternalProviders


@region_silo_test(stable=True)
class SubscribeTest(TestCase):
    def test_simple(self):
        group = self.create_group()
        user = self.create_user()

        GroupSubscription.objects.subscribe(group=group, user=user)

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

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

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

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

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

        # should not error
        GroupSubscription.objects.subscribe_actor(group=group, actor=team)


@region_silo_test(stable=True)
class GetParticipantsTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(teams=[self.team], organization=self.org)
        self.group = self.create_group(project=self.project)
        self.user = self.create_user()
        self.create_member(user=self.user, organization=self.org, teams=[self.team])
        self.update_user_settings_always()
        self.user = user_service.get_user(self.user.id)  # Redo the serialization for diffs

    @exempt_from_silo_limits()
    def update_user_settings_always(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

    @exempt_from_silo_limits()
    def update_user_setting_subscribe_only(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
        )

    @exempt_from_silo_limits()
    def update_user_setting_never(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
        )

    @exempt_from_silo_limits()
    def update_project_setting_always(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            project=self.group.project,
        )

    @exempt_from_silo_limits()
    def update_project_setting_subscribe_only(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user=self.user,
            project=self.group.project,
        )

    @exempt_from_silo_limits()
    def update_project_setting_never(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.NEVER,
            user=self.user,
            project=self.project,
        )

    def test_simple(self):
        # Include an extra team here to prove the subquery works
        team_2 = self.create_team(organization=self.org)
        project = self.create_project(teams=[self.team, team_2], organization=self.org)
        group = self.create_group(project=project)
        user2 = self.create_user("bar@example.com")
        self.create_member(user=user2, organization=self.org)

        # implicit membership
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.implicit}}

        # unsubscribed
        GroupSubscription.objects.create(
            user_id=self.user.id, group=group, project=project, is_active=False
        )

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        # not participating by default
        GroupSubscription.objects.filter(user_id=self.user.id, group=group).delete()

        self.update_user_setting_subscribe_only()

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        # explicitly participating
        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }

    def test_no_conversations(self):
        get_participants = functools.partial(GroupSubscription.objects.get_participants, self.group)
        # Implicit subscription, ensure the project setting overrides the
        # default global option.

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.implicit}
        }
        self.update_project_setting_never()
        assert get_participants() == {}

        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        self.update_user_settings_always()

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.implicit}
        }
        self.update_project_setting_never()
        assert get_participants() == {}

        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Explicit subscription, overridden by the global option.

        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }
        self.update_user_setting_never()
        assert get_participants() == {
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment}
        }

        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Explicit subscription, overridden by the project option.

        self.update_user_setting_subscribe_only()

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }
        self.update_project_setting_never()
        assert get_participants() == {
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment}
        }

        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Explicit subscription, overridden by the project option which also
        # overrides the default option.

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }
        self.update_project_setting_never()
        assert get_participants() == {
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment}
        }

    def test_participating_only(self):
        get_participants = functools.partial(GroupSubscription.objects.get_participants, self.group)

        # Implicit subscription, ensure the project setting overrides the default global option.

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.implicit},
        }

        with exempt_from_silo_limits():
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                user=self.user,
                project=self.project,
            )
        assert get_participants() == {}

        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.
        self.update_user_settings_always()

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.implicit}
        }
        self.update_project_setting_never()
        assert get_participants() == {}

        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Ensure the global default is applied.
        self.update_user_setting_subscribe_only()

        assert get_participants() == {}
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }

        subscription.delete()
        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Ensure the project setting overrides the global default.
        self.update_project_setting_subscribe_only()

        assert get_participants() == {}
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }

        subscription.delete()
        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Ensure the project setting overrides the global setting.

        self.update_user_settings_always()
        self.update_project_setting_subscribe_only()

        assert get_participants() == {}
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }

        subscription.delete()
        with exempt_from_silo_limits():
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        self.update_user_setting_subscribe_only()
        self.update_project_setting_always()

        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.implicit}
        }
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        assert get_participants() == {
            ExternalProviders.EMAIL: {self.user: GroupSubscriptionReason.comment},
            ExternalProviders.SLACK: {self.user: GroupSubscriptionReason.comment},
        }

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
            user_id=user.id,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        # explicit participation, included by default
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        with exempt_from_silo_limits():
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

        GroupSubscription.objects.filter(user_id=user.id, group=group).delete()

        # implicit participation, participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}

        with exempt_from_silo_limits():
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

        GroupSubscription.objects.filter(user_id=user.id, group=group).update(
            reason=GroupSubscriptionReason.implicit
        )

        # implicit participation, explicit participating only
        users = GroupSubscription.objects.get_participants(group=group)

        assert users == {}
