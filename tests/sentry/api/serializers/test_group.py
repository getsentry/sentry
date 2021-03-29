from datetime import timedelta
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (
    Group,
    Environment,
    GroupLink,
    GroupResolution,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    NotificationSetting,
    UserOption,
)
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.testutils import TestCase
from sentry.utils.compat import mock
from sentry.utils.compat.mock import patch


class GroupSerializerTest(TestCase):
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
            user=user, group=group, project=group.project, is_active=True
        )

        result = serialize(group, user)
        assert result["isSubscribed"]
        assert result["subscriptionDetails"] == {"reason": "unknown"}

    def test_explicit_unsubscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user=user, group=group, project=group.project, is_active=False
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
                NotificationSettingOptionValues.ALWAYS,
                NotificationSettingOptionValues.DEFAULT,
                True,
                False,
            ),
            (
                NotificationSettingOptionValues.ALWAYS,
                NotificationSettingOptionValues.ALWAYS,
                True,
                False,
            ),
            (
                NotificationSettingOptionValues.ALWAYS,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                False,
                False,
            ),
            (
                NotificationSettingOptionValues.ALWAYS,
                NotificationSettingOptionValues.NEVER,
                False,
                True,
            ),
            (
                NotificationSettingOptionValues.DEFAULT,
                NotificationSettingOptionValues.DEFAULT,
                False,
                False,
            ),
            (
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                NotificationSettingOptionValues.DEFAULT,
                False,
                False,
            ),
            (
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                NotificationSettingOptionValues.ALWAYS,
                True,
                False,
            ),
            (
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                False,
                False,
            ),
            (
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                NotificationSettingOptionValues.NEVER,
                False,
                True,
            ),
            (
                NotificationSettingOptionValues.NEVER,
                NotificationSettingOptionValues.DEFAULT,
                False,
                True,
            ),
            (
                NotificationSettingOptionValues.NEVER,
                NotificationSettingOptionValues.ALWAYS,
                True,
                False,
            ),
            (
                NotificationSettingOptionValues.NEVER,
                NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                False,
                False,
            ),
            (
                NotificationSettingOptionValues.NEVER,
                NotificationSettingOptionValues.NEVER,
                False,
                True,
            ),
        )

        for default_value, project_value, is_subscribed, has_details in combinations:
            UserOption.objects.clear_local_cache()

            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                default_value,
                user=user,
            )
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.WORKFLOW,
                project_value,
                user=user,
                project=group.project,
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
            user=user, group=group, project=group.project, is_active=True
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.NEVER,
            user=user,
        )

        result = serialize(group, user)
        assert not result["isSubscribed"]
        assert result["subscriptionDetails"] == {"disabled": True}

    def test_project_no_conversations_overrides_group_subscription(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user=user, group=group, project=group.project, is_active=True
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.NEVER,
            user=user,
            project=group.project,
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
                "totalEvents": 0,
                "dateCreated": result["statusDetails"]["info"]["dateCreated"],
            },
        }


class StreamGroupSerializerTestCase(TestCase):
    def test_environment(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "production")

        from sentry.api.serializers.models.group import tsdb

        with mock.patch(
            "sentry.api.serializers.models.group.tsdb.get_range", side_effect=tsdb.get_range
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=lambda: environment, stats_period="14d"
                ),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        def get_invalid_environment():
            raise Environment.DoesNotExist()

        with mock.patch(
            "sentry.api.serializers.models.group.tsdb.make_series", side_effect=tsdb.make_series
        ) as make_series:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=get_invalid_environment, stats_period="14d"
                ),
            )
            assert make_series.call_count == 1
