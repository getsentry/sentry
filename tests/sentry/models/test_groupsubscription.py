from __future__ import annotations

from typing import Mapping

from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.notificationsetting import NotificationSetting
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingOptionValues,
    NotificationSettingsOptionEnum,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.integrations import ExternalProviderEnum, ExternalProviders


@region_silo_test(stable=True)
class SubscribeTest(TestCase):
    def test_simple(self):
        group = self.create_group()
        user = self.create_user()
        team = self.create_team()

        GroupSubscription.objects.subscribe(group=group, subscriber=user)

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

        # should not error
        GroupSubscription.objects.subscribe(group=group, subscriber=user)

        GroupSubscription.objects.subscribe(group=group, subscriber=team)

        assert GroupSubscription.objects.filter(group=group, team=team).exists()

        # should not error
        GroupSubscription.objects.subscribe(group=group, subscriber=team)

    def test_bulk(self):
        group = self.create_group()

        user_ids = []
        for _ in range(20):
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

    @with_feature("organizations:team-workflow-notifications")
    def test_bulk_teams(self):
        group = self.create_group()

        team_ids = []
        for _ in range(20):
            team = self.create_team()
            team_ids.append(team.id)

        GroupSubscription.objects.bulk_subscribe(group=group, team_ids=team_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 20

        one_more = self.create_team()
        team_ids.append(one_more.id)

        # should not error
        GroupSubscription.objects.bulk_subscribe(group=group, team_ids=team_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 21

    @with_feature("organizations:team-workflow-notifications")
    def test_bulk_teams_dupes(self):
        group = self.create_group()

        team_ids = []

        team = self.create_team()
        team_ids.append(team.id)
        team_ids.append(team.id)

        GroupSubscription.objects.bulk_subscribe(group=group, team_ids=team_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 1

    @with_feature("organizations:team-workflow-notifications")
    def test_bulk_users_and_teams(self):
        group = self.create_group()

        user_ids = []
        team_ids = []

        for _ in range(10):
            user = self.create_user()
            user_ids.append(user.id)
            team = self.create_team()
            team_ids.append(team.id)

        GroupSubscription.objects.bulk_subscribe(group=group, user_ids=user_ids, team_ids=team_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 20

    @with_feature("organizations:team-workflow-notifications")
    def test_bulk_user_on_team(self):
        """
        Test that ensures bulk_subscribe subscribes users and teams individually, even if one of those users is part of one of those teams.
        """
        group = self.create_group()
        team = self.create_team()
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="member", teams=[team])

        team_ids = [team.id]
        user_ids = [user.id]

        GroupSubscription.objects.bulk_subscribe(group=group, user_ids=user_ids, team_ids=team_ids)

        assert len(GroupSubscription.objects.filter(group=group)) == 2

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
        user = self.create_user(email="bar@example.com")
        team = self.create_team(organization=org)
        self.create_member(user=user, organization=org, role="owner", teams=[team])
        self.create_member(email="test@email.com", organization=org, role="owner", teams=[team])

        GroupSubscription.objects.subscribe_actor(group=group, actor=team)

        assert GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

        # should not error
        GroupSubscription.objects.subscribe_actor(group=group, actor=team)

    @with_feature("organizations:team-workflow-notifications")
    def test_subscribe_team(self):
        org = self.create_organization()
        group = self.create_group()
        user = self.create_user(email="foo@example.com")
        team = self.create_team(organization=org)
        self.create_member(user=user, organization=org, role="owner", teams=[team])

        GroupSubscription.objects.subscribe_actor(group=group, actor=team)

        assert not GroupSubscription.objects.filter(group=group, user_id=user.id).exists()

        assert GroupSubscription.objects.filter(group=group, team=team).exists()

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

    @assume_test_silo_mode(SiloMode.CONTROL)
    def update_user_settings_always(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
        )
        NotificationSettingOption.objects.update_or_create(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            defaults={"value": NotificationSettingsOptionEnum.ALWAYS.value},
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def update_user_setting_subscribe_only(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )
        NotificationSettingOption.objects.update_or_create(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            defaults={"value": NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value},
        )
        NotificationSettingProvider.objects.update_or_create(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            provider=ExternalProviderEnum.EMAIL.value,
            defaults={"value": NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value},
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def update_user_setting_never(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.NEVER,
            user_id=self.user.id,
        )
        NotificationSettingOption.objects.update_or_create(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
        )
        NotificationSettingProvider.objects.update_or_create(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            provider=ExternalProviderEnum.EMAIL.value,
            defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def update_project_setting_always(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
            project=self.group.project,
        )
        NotificationSettingOption.objects.update_or_create(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.group.project_id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            defaults={"value": NotificationSettingsOptionEnum.ALWAYS.value},
        )
        NotificationSettingProvider.objects.update_or_create(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.group.project_id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            provider=ExternalProviderEnum.EMAIL.value,
            defaults={"value": NotificationSettingsOptionEnum.ALWAYS.value},
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def update_project_setting_subscribe_only(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            user_id=self.user.id,
            project=self.group.project,
        )
        NotificationSettingOption.objects.update_or_create(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.group.project_id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            defaults={"value": NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value},
        )
        NotificationSettingProvider.objects.update_or_create(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.group.project_id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            provider=ExternalProviderEnum.EMAIL.value,
            defaults={"value": NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value},
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def update_project_setting_never(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.NEVER,
            user_id=self.user.id,
            project=self.project,
        )
        NotificationSettingOption.objects.update_or_create(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.group.project_id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
        )
        NotificationSettingProvider.objects.update_or_create(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.group.project_id,
            type=NotificationSettingEnum.WORKFLOW.value,
            user_id=self.user.id,
            provider=ExternalProviderEnum.EMAIL.value,
            defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
        )

    def _assert_subscribers_are(
        self,
        group: Group | None = None,
        *,
        email: Mapping[User, int] | None = None,
        slack: Mapping[User, int] | None = None,
    ):
        all_participants = GroupSubscription.objects.get_participants(group or self.group)

        all_expected = {ExternalProviders.EMAIL: email, ExternalProviders.SLACK: slack}
        for provider in ExternalProviders:
            actual = dict(all_participants.get_participants_by_provider(provider))
            expected = {
                RpcActor.from_orm_user(user): reason
                for (user, reason) in (all_expected.get(provider) or {}).items()
            }
            assert actual == expected

    def test_simple(self):
        # Include an extra team here to prove the subquery works
        team_2 = self.create_team(organization=self.org)
        project = self.create_project(teams=[self.team, team_2], organization=self.org)
        group = self.create_group(project=project)
        user2 = self.create_user("bar@example.com")
        self.create_member(user=user2, organization=self.org)

        # implicit membership
        self._assert_subscribers_are(
            group,
            email={self.user: GroupSubscriptionReason.implicit},
        )

        # unsubscribed
        GroupSubscription.objects.create(
            user_id=self.user.id, group=group, project=project, is_active=False
        )

        self._assert_subscribers_are(group)

        # not participating by default
        GroupSubscription.objects.filter(user_id=self.user.id, group=group).delete()

        self.update_user_setting_subscribe_only()

        self._assert_subscribers_are(group)

        # explicitly participating
        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        self._assert_subscribers_are(
            group,
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

    @with_feature("organizations:notification-settings-v2")
    def test_simple_v2(self):
        # Include an extra team here to prove the subquery works
        team_2 = self.create_team(organization=self.org)
        project = self.create_project(teams=[self.team, team_2], organization=self.org)
        group = self.create_group(project=project)
        user2 = self.create_user("bar@example.com")
        self.create_member(user=user2, organization=self.org)

        # implicit membership
        self._assert_subscribers_are(
            group,
            email={self.user: GroupSubscriptionReason.implicit},
            slack={self.user: GroupSubscriptionReason.implicit},
        )

        # unsubscribed
        GroupSubscription.objects.create(
            user_id=self.user.id, group=group, project=project, is_active=False
        )

        self._assert_subscribers_are(group)

        # not participating by default
        GroupSubscription.objects.filter(user_id=self.user.id, group=group).delete()

        self.update_user_setting_subscribe_only()

        self._assert_subscribers_are(group)

        # explicitly participating
        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        self._assert_subscribers_are(
            group,
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

    def test_no_conversations(self):
        # Implicit subscription, ensure the project setting overrides the
        # default global option.

        self._assert_subscribers_are(email={self.user: GroupSubscriptionReason.implicit})
        self.update_project_setting_never()
        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        self.update_user_settings_always()

        self._assert_subscribers_are(email={self.user: GroupSubscriptionReason.implicit})
        self.update_project_setting_never()
        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
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

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )
        self.update_user_setting_never()
        self._assert_subscribers_are(slack={self.user: GroupSubscriptionReason.comment})

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Explicit subscription, overridden by the project option.

        self.update_user_setting_subscribe_only()

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )
        self.update_project_setting_never()
        self._assert_subscribers_are(slack={self.user: GroupSubscriptionReason.comment})

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Explicit subscription, overridden by the project option which also
        # overrides the default option.

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )
        self.update_project_setting_never()
        self._assert_subscribers_are(slack={self.user: GroupSubscriptionReason.comment})

    @with_feature("organizations:notification-settings-v2")
    def test_no_conversations_v2(self):
        # Implicit subscription, ensure the project setting overrides the
        # default global option.
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.implicit},
            slack={self.user: GroupSubscriptionReason.implicit},
        )
        self.update_project_setting_never()
        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.

        self.update_user_settings_always()

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.implicit},
            slack={self.user: GroupSubscriptionReason.implicit},
        )
        self.update_project_setting_never()
        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Explicit subscription, overridden by the global option.

        GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.update_or_create(
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
                user_id=self.user.id,
                provider=ExternalProviderEnum.EMAIL.value,
                defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
            )
        self._assert_subscribers_are(slack={self.user: GroupSubscriptionReason.comment})

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Explicit subscription, overridden by the project option.

        self.update_user_setting_subscribe_only()

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.update_or_create(
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier=self.group.project_id,
                type=NotificationSettingEnum.WORKFLOW.value,
                provider=ExternalProviderEnum.EMAIL.value,
                user_id=self.user.id,
                defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
            )
        self._assert_subscribers_are(slack={self.user: GroupSubscriptionReason.comment})

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Explicit subscription, overridden by the project option which also
        # overrides the default option.

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.update_or_create(
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier=self.group.project_id,
                type=NotificationSettingEnum.WORKFLOW.value,
                provider=ExternalProviderEnum.EMAIL.value,
                user_id=self.user.id,
                defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
            )
        self._assert_subscribers_are(slack={self.user: GroupSubscriptionReason.comment})

    def test_participating_only(self):
        # Implicit subscription, ensure the project setting overrides the default global option.

        self._assert_subscribers_are(email={self.user: GroupSubscriptionReason.implicit})

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                user_id=self.user.id,
                project=self.project,
            )
        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.
        self.update_user_settings_always()

        self._assert_subscribers_are(email={self.user: GroupSubscriptionReason.implicit})
        self.update_project_setting_never()
        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Ensure the global default is applied.
        self.update_user_setting_subscribe_only()

        self._assert_subscribers_are()
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        subscription.delete()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )

        # Ensure the project setting overrides the global default.
        self.update_project_setting_subscribe_only()

        self._assert_subscribers_are()
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        subscription.delete()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Ensure the project setting overrides the global setting.

        self.update_user_settings_always()
        self.update_project_setting_subscribe_only()

        self._assert_subscribers_are()
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        subscription.delete()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.remove_for_user(
                self.user, NotificationSettingTypes.WORKFLOW
            )
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        self.update_user_setting_subscribe_only()
        self.update_project_setting_always()

        self._assert_subscribers_are(email={self.user: GroupSubscriptionReason.implicit})
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

    @with_feature("organizations:notification-settings-v2")
    def test_participating_only_v2(self):
        # Implicit subscription, ensure the project setting overrides the default global option.
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.implicit},
            slack={self.user: GroupSubscriptionReason.implicit},
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.update_or_create(
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier=self.project.id,
                type=NotificationSettingEnum.WORKFLOW.value,
                user_id=self.user.id,
                defaults={"value": NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value},
            )
            NotificationSettingProvider.objects.update_or_create(
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier=self.project.id,
                type=NotificationSettingEnum.WORKFLOW.value,
                user_id=self.user.id,
                provider=ExternalProviderEnum.EMAIL.value,
                defaults={"value": NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value},
            )

        self._assert_subscribers_are()

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Implicit subscription, ensure the project setting overrides the
        # explicit global option.
        self.update_user_settings_always()

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.implicit},
            slack={self.user: GroupSubscriptionReason.implicit},
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingProvider.objects.update_or_create(
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier=self.project.id,
                type=NotificationSettingEnum.WORKFLOW.value,
                provider=ExternalProviderEnum.EMAIL.value,
                user_id=self.user.id,
                defaults={"value": NotificationSettingsOptionEnum.NEVER.value},
            )
        self._assert_subscribers_are(
            slack={self.user: GroupSubscriptionReason.implicit},
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Ensure the global default is applied.
        self.update_user_setting_subscribe_only()

        self._assert_subscribers_are()
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        subscription.delete()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Ensure the project setting overrides the global default.
        self.update_project_setting_subscribe_only()

        self._assert_subscribers_are()
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        subscription.delete()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        # Ensure the project setting overrides the global setting.

        self.update_user_settings_always()
        self.update_project_setting_subscribe_only()

        self._assert_subscribers_are()
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

        subscription.delete()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()
            NotificationSettingProvider.objects.filter(
                user_id=self.user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
            ).delete()

        self.update_user_setting_subscribe_only()
        self.update_project_setting_always()

        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.implicit},
            slack={self.user: GroupSubscriptionReason.implicit},
        )
        subscription = GroupSubscription.objects.create(
            user_id=self.user.id,
            group=self.group,
            project=self.project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )
        self._assert_subscribers_are(
            email={self.user: GroupSubscriptionReason.comment},
            slack={self.user: GroupSubscriptionReason.comment},
        )

    def test_does_not_include_nonmember(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        group = self.create_group(project=project)
        user = self.create_user("foo@example.com")

        # implicit participation, included by default
        self._assert_subscribers_are(group)

        GroupSubscription.objects.create(
            user_id=user.id,
            group=group,
            project=project,
            is_active=True,
            reason=GroupSubscriptionReason.comment,
        )

        # explicit participation, included by default
        self._assert_subscribers_are(group)

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                user_id=user.id,
                project=project,
            )

        # explicit participation, participating only
        self._assert_subscribers_are(group)

        GroupSubscription.objects.filter(user_id=user.id, group=group).delete()

        # implicit participation, participating only
        self._assert_subscribers_are(group)

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                NotificationSettingOptionValues.ALWAYS,
                user_id=user.id,
                project=project,
            )

        # explicit participation, explicit participating only
        self._assert_subscribers_are(group)

        GroupSubscription.objects.filter(user_id=user.id, group=group).update(
            reason=GroupSubscriptionReason.implicit
        )

        # implicit participation, explicit participating only
        self._assert_subscribers_are(group)
