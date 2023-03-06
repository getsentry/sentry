from datetime import timedelta
from unittest.mock import patch

import pytz
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializerSnuba
from sentry.issues.grouptype import (
    PerformanceRenderBlockingAssetSpanGroupType,
    ProfileFileIOGroupType,
)
from sentry.models import (
    Group,
    GroupEnvironment,
    GroupLink,
    GroupResolution,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    NotificationSetting,
    UserOption,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.types.integrations import ExternalProviders
from tests.sentry.issues.test_utils import SearchIssueTestMixin


@region_silo_test(stable=True)
class GroupSerializerSnubaTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)
        self.week_ago = before_now(days=7)

    def test_permalink(self):
        group = self.create_group()
        result = serialize(group, self.user, serializer=GroupSerializerSnuba())
        assert "http://" in result["permalink"]
        assert f"{group.organization.slug}/issues/{group.id}" in result["permalink"]

    def test_permalink_outside_org(self):
        outside_user = self.create_user()
        group = self.create_group()
        result = serialize(group, outside_user, serializer=GroupSerializerSnuba())
        assert result["permalink"] is None

    def test_is_ignored_with_expired_snooze(self):
        now = timezone.now()

        user = self.create_user()
        group = self.create_group(status=GroupStatus.IGNORED)
        GroupSnooze.objects.create(group=group, until=now - timedelta(minutes=1))

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "unresolved"
        assert result["statusDetails"] == {}

    def test_is_ignored_with_valid_snooze(self):
        now = timezone.now()

        user = self.create_user()
        group = self.create_group(status=GroupStatus.IGNORED)
        snooze = GroupSnooze.objects.create(group=group, until=now + timedelta(minutes=1))

        result = serialize(group, user, serializer=GroupSerializerSnuba())
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

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "ignored"
        assert result["statusDetails"]["actor"]["id"] == str(user.id)

    def test_resolved_in_next_release(self):
        release = self.create_release(project=self.project, version="a")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=group, release=release, type=GroupResolution.Type.in_next_release
        )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"inNextRelease": True, "actor": None}

    def test_resolved_in_release(self):
        release = self.create_release(project=self.project, version="a")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=group, release=release, type=GroupResolution.Type.in_release
        )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"inRelease": "a", "actor": None}

    def test_resolved_with_actor(self):
        release = self.create_release(project=self.project, version="a")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.RESOLVED)
        GroupResolution.objects.create(
            group=group, release=release, type=GroupResolution.Type.in_release, actor_id=user.id
        )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
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

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "resolved"
        assert result["statusDetails"]["inCommit"]["id"] == commit.key

    @patch("sentry.analytics.record")
    @patch("sentry.models.Group.is_over_resolve_age")
    def test_auto_resolved(self, mock_is_over_resolve_age, mock_record):
        mock_is_over_resolve_age.return_value = True

        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"autoResolved": True}
        mock_record.assert_called_with(
            "issue.resolved",
            default_user_id=self.project.organization.get_default_owner().id,
            project_id=self.project.id,
            organization_id=self.project.organization_id,
            group_id=group.id,
            resolution_type="automatic",
        )

    def test_subscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=True
        )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["isSubscribed"]
        assert result["subscriptionDetails"] == {"reason": "unknown"}

    def test_explicit_unsubscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=False
        )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
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
            with exempt_from_silo_limits():
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

                NotificationSetting.objects.update_settings(
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.WORKFLOW,
                    default_value,
                    user=user,
                )
                NotificationSetting.objects.update_settings(
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.WORKFLOW,
                    project_value,
                    user=user,
                    project=group.project,
                )

            result = serialize(group, user, serializer=GroupSerializerSnuba())
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

        with exempt_from_silo_limits():
            for provider in [ExternalProviders.EMAIL, ExternalProviders.SLACK]:
                NotificationSetting.objects.update_settings(
                    provider,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationSettingOptionValues.NEVER,
                    user=user,
                )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert not result["isSubscribed"]
        assert result["subscriptionDetails"] == {"disabled": True}

    def test_project_no_conversations_overrides_group_subscription(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user_id=user.id, group=group, project=group.project, is_active=True
        )

        for provider in [ExternalProviders.EMAIL, ExternalProviders.SLACK]:
            with exempt_from_silo_limits():
                NotificationSetting.objects.update_settings(
                    provider,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationSettingOptionValues.NEVER,
                    user=user,
                    project=group.project,
                )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert not result["isSubscribed"]
        assert result["subscriptionDetails"] == {"disabled": True}

    def test_no_user_unsubscribed(self):
        group = self.create_group()

        result = serialize(group, serializer=GroupSerializerSnuba())
        assert not result["isSubscribed"]

    def test_seen_stats(self):
        environment = self.create_environment(project=self.project)
        environment2 = self.create_environment(project=self.project)

        events = []

        for event_id, env, user_id, timestamp in [
            ("a" * 32, environment, 1, iso_format(self.min_ago)),
            ("b" * 32, environment, 2, iso_format(self.min_ago)),
            ("c" * 32, environment2, 3, iso_format(self.week_ago)),
        ]:
            events.append(
                self.store_event(
                    data={
                        "event_id": event_id,
                        "fingerprint": ["put-me-in-group1"],
                        "timestamp": timestamp,
                        "environment": env.name,
                        "user": {"id": user_id},
                    },
                    project_id=self.project.id,
                )
            )

        # Assert all events are in the same group
        (group_id,) = {e.group.id for e in events}

        group = Group.objects.get(id=group_id)
        group.times_seen = 3
        group.first_seen = self.week_ago - timedelta(days=5)
        group.last_seen = self.week_ago
        group.save()

        # should use group columns when no environments arg passed
        result = serialize(group, serializer=GroupSerializerSnuba(environment_ids=[]))
        assert result["count"] == "3"
        assert iso_format(result["lastSeen"]) == iso_format(self.min_ago)
        assert result["firstSeen"] == group.first_seen

        # update this to something different to make sure it's being used
        group_env = GroupEnvironment.objects.get(group_id=group_id, environment_id=environment.id)
        group_env.first_seen = self.day_ago - timedelta(days=3)
        group_env.save()

        group_env2 = GroupEnvironment.objects.get(group_id=group_id, environment_id=environment2.id)

        result = serialize(
            group,
            serializer=GroupSerializerSnuba(environment_ids=[environment.id, environment2.id]),
        )
        assert result["count"] == "3"
        # result is rounded down to nearest second
        assert iso_format(result["lastSeen"]) == iso_format(self.min_ago)
        assert iso_format(result["firstSeen"]) == iso_format(group_env.first_seen)
        assert iso_format(group_env2.first_seen) > iso_format(group_env.first_seen)
        assert result["userCount"] == 3

        result = serialize(
            group,
            serializer=GroupSerializerSnuba(
                environment_ids=[environment.id, environment2.id],
                start=self.week_ago - timedelta(hours=1),
                end=self.week_ago + timedelta(hours=1),
            ),
        )
        assert result["userCount"] == 1
        assert iso_format(result["lastSeen"]) == iso_format(self.week_ago)
        assert iso_format(result["firstSeen"]) == iso_format(self.week_ago)
        assert result["count"] == "1"

    def test_get_start_from_seen_stats(self):
        for days, expected in [(None, 30), (0, 14), (1000, 90)]:
            last_seen = None if days is None else before_now(days=days).replace(tzinfo=pytz.UTC)
            start = GroupSerializerSnuba._get_start_from_seen_stats({"": {"last_seen": last_seen}})

            assert iso_format(start) == iso_format(before_now(days=expected))


@region_silo_test
class PerformanceGroupSerializerSnubaTest(
    APITestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
):
    def test_perf_seen_stats(self):
        proj = self.create_project()
        environment = self.create_environment(project=proj)

        first_group_fingerprint = f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"
        timestamp = timezone.now() - timedelta(days=5)
        times = 5
        for _ in range(0, times):
            self.store_transaction(
                proj.id,
                "user1",
                [first_group_fingerprint],
                environment.name,
                timestamp=timestamp + timedelta(minutes=1),
            )

        event = self.store_transaction(
            proj.id,
            "user2",
            [first_group_fingerprint],
            environment.name,
            timestamp=timestamp + timedelta(minutes=2),
        )

        first_group = event.groups[0]

        result = serialize(
            first_group,
            serializer=GroupSerializerSnuba(
                environment_ids=[environment.id],
                start=timestamp - timedelta(hours=1),
                end=timestamp + timedelta(hours=1),
            ),
        )

        assert result["userCount"] == 2
        assert iso_format(result["lastSeen"]) == iso_format(timestamp + timedelta(minutes=2))
        assert iso_format(result["firstSeen"]) == iso_format(timestamp + timedelta(minutes=1))
        assert result["count"] == str(times + 1)


@region_silo_test
class ProfilingGroupSerializerSnubaTest(
    APITestCase,
    SnubaTestCase,
    SearchIssueTestMixin,
):
    def test_profiling_seen_stats(self):
        proj = self.create_project()
        environment = self.create_environment(project=proj)

        first_group_fingerprint = f"{ProfileFileIOGroupType.type_id}-group1"
        timestamp = timezone.now().replace(hour=0, minute=0, second=0)
        times = 5
        for incr in range(0, times):
            # for user_0 - user_4, first_group
            self.store_search_issue(
                proj.id,
                incr,
                [first_group_fingerprint],
                environment.name,
                timestamp + timedelta(minutes=incr),
            )

        # user_5, another_group
        event, issue_occurrence, group_info = self.store_search_issue(
            proj.id,
            5,
            [first_group_fingerprint],
            environment.name,
            timestamp + timedelta(minutes=5),
        )

        first_group = group_info.group

        result = serialize(
            first_group,
            serializer=GroupSerializerSnuba(
                environment_ids=[environment.id],
                start=timestamp - timedelta(days=1),
                end=timestamp + timedelta(days=1),
            ),
        )

        assert result["userCount"] == 6
        assert iso_format(result["lastSeen"]) == iso_format(timestamp + timedelta(minutes=5))
        assert iso_format(result["firstSeen"]) == iso_format(timestamp)
        assert result["count"] == str(times + 1)
