from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models.group import Group, GroupStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.options.user_option import UserOption
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.integrations import ExternalProviderEnum

pytestmark = [requires_snuba]


@region_silo_test
class GroupSerializerTest(TestCase, PerformanceIssueTestCase):
    def test_project(self):
        user = self.create_user()
        group = self.create_group()

        result = serialize(group, user)
        assert result["project"]
        assert "id" in result["project"]
        assert "name" in result["project"]
        assert "slug" in result["project"]
        assert "platform" in result["project"]

    def test_is_ignored_with_expired_snooze(self):
        now = timezone.now()

        user = self.create_user()
        group = self.create_group(status=GroupStatus.IGNORED)
        GroupSnooze.objects.create(group=group, until=now - timedelta(minutes=1))

        result = serialize(group, user)
        assert result["status"] == "unresolved"
        assert result["statusDetails"] == {}

    def test_is_ignored_with_valid_snooze(self):
        now = timezone.now()

        user = self.create_user()
        group = self.create_group(status=GroupStatus.IGNORED)
        snooze = GroupSnooze.objects.create(group=group, until=now + timedelta(minutes=1))

        result = serialize(group, user)
        assert result["status"] == "ignored"
        assert result["statusDetails"]["ignoreCount"] == snooze.count
        assert result["statusDetails"]["ignoreWindow"] == snooze.window
        assert result["statusDetails"]["ignoreUserCount"] == snooze.user_count
        assert result["statusDetails"]["ignoreUserWindow"] == snooze.user_window
        assert result["statusDetails"]["ignoreUntil"] == snooze.until
        assert result["statusDetails"]["actor"] is None

    def test_is_ignored_with_valid_snooze_and_actor(self):
        now = timezone.now()

        user = self.create_user()
        group = self.create_group(status=GroupStatus.IGNORED)
        GroupSnooze.objects.create(group=group, until=now + timedelta(minutes=1), actor_id=user.id)

        result = serialize(group, user)
        assert result["status"] == "ignored"
        assert result["statusDetails"]["actor"]["id"] == str(user.id)

    def test_resolved_in_next_release(self):
        release = self.create_release(project=self.project, version="a")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=group, release=release, type=GroupResolution.Type.in_next_release
        )

        result = serialize(group, user)
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"inNextRelease": True, "actor": None}

    def test_resolved_in_release(self):
        release = self.create_release(project=self.project, version="a")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=group, release=release, type=GroupResolution.Type.in_release
        )

        result = serialize(group, user)
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"inRelease": "a", "actor": None}

    def test_resolved_with_actor(self):
        release = self.create_release(project=self.project, version="a")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=group, release=release, type=GroupResolution.Type.in_release, actor_id=user.id
        )

        result = serialize(group, user)
        assert result["status"] == "resolved"
        assert result["statusDetails"]["actor"]["id"] == str(user.id)

    def test_resolved_in_commit(self):
        repo = self.create_repo(project=self.project)
        commit = self.create_commit(repo=repo)
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_id=commit.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )

        result = serialize(group, user)
        assert result["status"] == "resolved"
        assert result["statusDetails"]["inCommit"]["id"] == commit.key

    @patch("sentry.models.Group.is_over_resolve_age")
    def test_auto_resolved(self, mock_is_over_resolve_age):
        mock_is_over_resolve_age.return_value = True

        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        result = serialize(group, user)
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"autoResolved": True}

    def test_subscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=True
        )

        result = serialize(group, user)
        assert result["isSubscribed"]
        assert result["subscriptionDetails"] == {"reason": "unknown"}

    def test_explicit_unsubscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=False
        )

        result = serialize(group, user)
        assert not result["isSubscribed"]
        assert not result["subscriptionDetails"]

    def test_implicit_subscribed(self):
        user = self.create_user()
        group = self.create_group()

        combinations = (
            # (default, project, subscribed, has_details)
            (
                NotificationSettingsOptionEnum.ALWAYS,
                None,
                True,
                False,
            ),
            (
                NotificationSettingsOptionEnum.ALWAYS,
                NotificationSettingsOptionEnum.ALWAYS,
                True,
                False,
            ),
            (
                NotificationSettingsOptionEnum.ALWAYS,
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                False,
                False,
            ),
            (
                NotificationSettingsOptionEnum.ALWAYS,
                NotificationSettingsOptionEnum.NEVER,
                False,
                True,
            ),
            (
                None,
                None,
                False,
                False,
            ),
            (
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                None,
                False,
                False,
            ),
            (
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                NotificationSettingsOptionEnum.ALWAYS,
                True,
                False,
            ),
            (
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                False,
                False,
            ),
            (
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                NotificationSettingsOptionEnum.NEVER,
                False,
                True,
            ),
            (
                NotificationSettingsOptionEnum.NEVER,
                None,
                False,
                True,
            ),
            (
                NotificationSettingsOptionEnum.NEVER,
                NotificationSettingsOptionEnum.ALWAYS,
                True,
                False,
            ),
            (
                NotificationSettingsOptionEnum.NEVER,
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                False,
                False,
            ),
            (
                NotificationSettingsOptionEnum.NEVER,
                NotificationSettingsOptionEnum.NEVER,
                False,
                True,
            ),
        )

        for default_value, project_value, is_subscribed, has_details in combinations:
            UserOption.objects.clear_local_cache()

            with assume_test_silo_mode(SiloMode.CONTROL):
                for provider in [
                    ExternalProviderEnum.EMAIL.value,
                    ExternalProviderEnum.SLACK.value,
                ]:
                    if default_value is None:
                        NotificationSettingOption.objects.filter(
                            scope_type=NotificationScopeEnum.USER.value,
                            scope_identifier=user.id,
                            user_id=user.id,
                            type=NotificationSettingEnum.WORKFLOW.value,
                        ).delete()
                        NotificationSettingProvider.objects.filter(
                            type=NotificationSettingEnum.WORKFLOW.value,
                            user_id=user.id,
                            scope_type=NotificationScopeEnum.USER.value,
                            scope_identifier=user.id,
                            provider=provider,
                        ).delete()
                    else:
                        NotificationSettingOption.objects.update_or_create(
                            scope_type=NotificationScopeEnum.USER.value,
                            scope_identifier=user.id,
                            user_id=user.id,
                            type=NotificationSettingEnum.WORKFLOW.value,
                            defaults={"value": default_value.value},
                        )
                        NotificationSettingProvider.objects.update_or_create(
                            provider=provider,
                            type=NotificationSettingEnum.WORKFLOW.value,
                            user_id=user.id,
                            scope_type=NotificationScopeEnum.USER.value,
                            scope_identifier=user.id,
                            defaults={"value": NotificationSettingsOptionEnum.ALWAYS.value},
                        )

                    if project_value is None:
                        NotificationSettingOption.objects.filter(
                            scope_type=NotificationScopeEnum.PROJECT.value,
                            scope_identifier=group.project.id,
                            type=NotificationSettingEnum.WORKFLOW.value,
                            user_id=user.id,
                        ).delete()
                        NotificationSettingProvider.objects.filter(
                            scope_type=NotificationScopeEnum.PROJECT.value,
                            scope_identifier=group.project.id,
                            type=NotificationSettingEnum.WORKFLOW.value,
                            user_id=user.id,
                            provider=provider,
                        ).delete()
                    else:
                        NotificationSettingOption.objects.update_or_create(
                            scope_type=NotificationScopeEnum.PROJECT.value,
                            scope_identifier=group.project.id,
                            user_id=user.id,
                            type=NotificationSettingEnum.WORKFLOW.value,
                            defaults={"value": project_value.value},
                        )
                        NotificationSettingProvider.objects.update_or_create(
                            provider=provider,
                            type=NotificationSettingEnum.WORKFLOW.value,
                            user_id=user.id,
                            scope_type=NotificationScopeEnum.PROJECT.value,
                            scope_identifier=group.project.id,
                            defaults={"value": NotificationSettingsOptionEnum.ALWAYS.value},
                        )

            result = serialize(group, user)
            subscription_details = result.get("subscriptionDetails")

            assert result["isSubscribed"] is is_subscribed
            assert (
                subscription_details == {"disabled": True}
                if has_details
                else subscription_details is None
            )

    def test_global_no_conversations_overrides_group_subscription(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=True
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create_or_update(
                scope_type=NotificationScopeEnum.USER.value,
                scope_identifier=user.id,
                type=NotificationSettingEnum.WORKFLOW.value,
                value=NotificationSettingsOptionEnum.NEVER.value,
                user_id=user.id,
            )

        result = serialize(group, user)
        assert not result["isSubscribed"]
        assert result["subscriptionDetails"] == {"disabled": True}

    def test_project_no_conversations_overrides_group_subscription(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=True
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create_or_update(
                scope_type=NotificationScopeEnum.PROJECT.value,
                scope_identifier=group.project.id,
                type=NotificationSettingEnum.WORKFLOW.value,
                value=NotificationSettingsOptionEnum.NEVER.value,
                user_id=user.id,
            )

        result = serialize(group, user)
        assert not result["isSubscribed"]
        assert result["subscriptionDetails"] == {"disabled": True}

    def test_no_user_unsubscribed(self):
        group = self.create_group()
        result = serialize(group)
        assert not result["isSubscribed"]

    def test_reprocessing(self):
        from sentry.reprocessing2 import start_group_reprocessing

        group = self.create_group()
        start_group_reprocessing(
            project_id=group.project_id, group_id=group.id, remaining_events="delete"
        )

        result = serialize(Group.objects.get(id=group.id))

        assert result["status"] == "reprocessing"
        assert result["statusDetails"] == {
            "pendingEvents": 0,
            "info": {
                "syncCount": 0,
                "totalEvents": 0,
                "dateCreated": result["statusDetails"]["info"]["dateCreated"],
            },
        }

    def test_perf_issue(self):
        event = self.create_performance_issue()
        perf_group = event.group
        serialized = serialize(perf_group)
        assert serialized["count"] == "1"
        assert serialized["issueCategory"] == "performance"
        assert serialized["issueType"] == "performance_n_plus_one_db_queries"
