from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializerSnuba
from sentry.issues.grouptype import PerformanceNPlusOneGroupType, ProfileFileIOGroupType
from sentry.models.group import Group, GroupStatus
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import NotificationSettingsOptionEnum
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.group import PriorityLevel
from sentry.users.models.user_option import UserOption
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin


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

    def test_priority_high(self):
        outside_user = self.create_user()
        group = self.create_group(priority=PriorityLevel.HIGH)
        result = serialize(group, outside_user, serializer=GroupSerializerSnuba())
        assert result["priority"] == "high"

    def test_priority_medium(self):
        outside_user = self.create_user()
        group = self.create_group(priority=PriorityLevel.MEDIUM)
        result = serialize(group, outside_user, serializer=GroupSerializerSnuba())
        assert result["priority"] == "medium"

    def test_priority_none(self):
        outside_user = self.create_user()
        group = self.create_group()
        result = serialize(group, outside_user, serializer=GroupSerializerSnuba())
        assert result["priority"] is None
        assert result["priorityLockedAt"] is None

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

    @mock.patch("sentry.models.Group.is_over_resolve_age")
    def test_auto_resolved(self, mock_is_over_resolve_age):
        mock_is_over_resolve_age.return_value = True

        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["status"] == "resolved"
        assert result["statusDetails"] == {"autoResolved": True}

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
                NotificationSettingsOptionEnum.ALWAYS,
                NotificationSettingsOptionEnum.DEFAULT,
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
                NotificationSettingsOptionEnum.DEFAULT,
                NotificationSettingsOptionEnum.DEFAULT,
                False,
                False,
            ),
            (
                NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                NotificationSettingsOptionEnum.DEFAULT,
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
                NotificationSettingsOptionEnum.DEFAULT,
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
            with assume_test_silo_mode(SiloMode.CONTROL):
                UserOption.objects.clear_local_cache()
                NotificationSettingOption.objects.all().delete()

                if default_value != NotificationSettingsOptionEnum.DEFAULT:
                    NotificationSettingOption.objects.create(
                        user_id=user.id,
                        scope_type="user",
                        scope_identifier=user.id,
                        value=default_value.value,
                        type="workflow",
                    )

                if project_value != NotificationSettingsOptionEnum.DEFAULT:
                    NotificationSettingOption.objects.create(
                        user_id=user.id,
                        scope_type="project",
                        scope_identifier=group.project.id,
                        value=project_value.value,
                        type="workflow",
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

        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=user.id,
                scope_type="user",
                scope_identifier=user.id,
                value="never",
                type="workflow",
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
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=user.id,
                scope_type="project",
                scope_identifier=group.project.id,
                value="never",
                type="workflow",
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
        assert group_env2.first_seen is not None
        assert group_env2.first_seen > group_env.first_seen
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
            last_seen = None if days is None else before_now(days=days)
            start = GroupSerializerSnuba._get_start_from_seen_stats(
                {
                    mock.sentinel.group: {
                        "last_seen": last_seen,
                        "first_seen": None,
                        "times_seen": 0,
                        "user_count": 0,
                    }
                }
            )

            assert iso_format(start) == iso_format(before_now(days=expected))

    def test_skipped_date_timestamp_filters(self):
        group = self.create_group()
        serializer = GroupSerializerSnuba(
            search_filters=[
                SearchFilter(
                    SearchKey("timestamp"),
                    ">",
                    SearchValue(before_now(hours=1)),
                ),
                SearchFilter(
                    SearchKey("timestamp"),
                    "<",
                    SearchValue(before_now(seconds=1)),
                ),
                SearchFilter(
                    SearchKey("date"),
                    ">",
                    SearchValue(before_now(hours=1)),
                ),
                SearchFilter(
                    SearchKey("date"),
                    "<",
                    SearchValue(before_now(seconds=1)),
                ),
            ]
        )
        assert not serializer.conditions
        result = serialize(group, self.user, serializer=serializer)
        assert result["id"] == str(group.id)


class PerformanceGroupSerializerSnubaTest(
    APITestCase,
    SnubaTestCase,
    PerformanceIssueTestCase,
):
    def test_perf_seen_stats(self):
        proj = self.create_project()

        first_group_fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-group1"
        timestamp = timezone.now() - timedelta(days=5)
        times = 5
        for _ in range(0, times):
            event_data = load_data(
                "transaction-n-plus-one",
                timestamp=timestamp + timedelta(minutes=1),
                start_timestamp=timestamp + timedelta(minutes=1),
            )
            event_data["user"] = {"email": "test1@example.com"}

            self.create_performance_issue(
                event_data=event_data, fingerprint=first_group_fingerprint, project_id=proj.id
            )

        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=timestamp + timedelta(minutes=2),
            start_timestamp=timestamp + timedelta(minutes=2),
        )
        event_data["user"] = {"email": "test2@example.com"}

        event = self.create_performance_issue(
            event_data=event_data, fingerprint=first_group_fingerprint, project_id=proj.id
        )

        first_group = event.group

        result = serialize(
            first_group,
            serializer=GroupSerializerSnuba(
                start=timezone.now() - timedelta(days=60),
                end=timezone.now() + timedelta(days=10),
            ),
        )

        assert result["userCount"] == 2
        assert iso_format(result["lastSeen"]) == iso_format(timestamp + timedelta(minutes=2))
        assert iso_format(result["firstSeen"]) == iso_format(timestamp + timedelta(minutes=1))
        assert result["count"] == str(times + 1)


class ProfilingGroupSerializerSnubaTest(
    APITestCase,
    SnubaTestCase,
    SearchIssueTestMixin,
):
    def test_profiling_seen_stats(self):
        proj = self.create_project()
        environment = self.create_environment(project=proj)

        first_group_fingerprint = f"{ProfileFileIOGroupType.type_id}-group1"
        timestamp = (timezone.now() - timedelta(days=5)).replace(hour=0, minute=0, second=0)
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
        assert group_info is not None

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
