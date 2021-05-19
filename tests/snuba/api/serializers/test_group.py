import time
from datetime import timedelta

import pytz
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import (
    GroupSerializerSnuba,
    StreamGroupSerializerSnuba,
    snuba_tsdb,
)
from sentry.models import (
    Environment,
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
from sentry.types.integrations import ExternalProviders
from sentry.utils.cache import cache
from sentry.utils.compat import mock
from sentry.utils.compat.mock import patch


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

    @patch("sentry.models.Group.is_over_resolve_age")
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
            user=user, group=group, project=group.project, is_active=True
        )

        result = serialize(group, user, serializer=GroupSerializerSnuba())
        assert result["isSubscribed"]
        assert result["subscriptionDetails"] == {"reason": "unknown"}

    def test_explicit_unsubscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user=user, group=group, project=group.project, is_active=False
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
            user=user, group=group, project=group.project, is_active=True
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
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
            user=user, group=group, project=group.project, is_active=True
        )

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
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


class StreamGroupSerializerTestCase(APITestCase, SnubaTestCase):
    def test_environment(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "production")

        with mock.patch(
            "sentry.api.serializers.models.group.snuba_tsdb.get_range",
            side_effect=snuba_tsdb.get_range,
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializerSnuba(
                    environment_ids=[environment.id], stats_period="14d"
                ),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        with mock.patch(
            "sentry.api.serializers.models.group.snuba_tsdb.get_range",
            side_effect=snuba_tsdb.get_range,
        ) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializerSnuba(environment_ids=None, stats_period="14d"),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] is None

    def test_session_count(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "prod")
        dev_environment = Environment.get_or_create(group.project, "dev")
        no_sessions_environment = Environment.get_or_create(group.project, "no_sessions")

        self.received = time.time()
        self.session_started = time.time() // 60 * 60
        self.session_release = "foo@1.0.0"
        self.session_crashed_release = "foo@2.0.0"
        self.store_session(
            {
                "session_id": "5d52fd05-fcc9-4bf3-9dc9-267783670341",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "dev",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": None,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "5e910c1a-6941-460e-9843-24103fb6a63c",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "exited",
                "seq": 1,
                "release": self.session_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 30.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf82",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102666",
                "status": "crashed",
                "seq": 0,
                "release": self.session_crashed_release,
                "environment": "prod",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started,
                "received": self.received,
            }
        )

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(stats_period="14d"),
        )
        assert "sessionCount" not in result[0]
        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(stats_period="14d", expand=["sessions"]),
        )
        assert result[0]["sessionCount"] == 3
        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[environment.id], stats_period="14d", expand=["sessions"]
            ),
        )
        assert result[0]["sessionCount"] == 2

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[no_sessions_environment.id],
                stats_period="14d",
                expand=["sessions"],
            ),
        )
        assert result[0]["sessionCount"] is None

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[dev_environment.id], stats_period="14d", expand=["sessions"]
            ),
        )
        assert result[0]["sessionCount"] == 1

        self.store_session(
            {
                "session_id": "a148c0c5-06a2-423b-8901-6b43b812cf83",
                "distinct_id": "39887d89-13b2-4c84-8c23-5d13d2102667",
                "status": "ok",
                "seq": 0,
                "release": self.session_release,
                "environment": "dev",
                "retention_days": 90,
                "org_id": self.project.organization_id,
                "project_id": self.project.id,
                "duration": 60.0,
                "errors": 0,
                "started": self.session_started - 1590061,  # approximately 18 days
                "received": self.received - 1590061,  # approximately 18 days
            }
        )

        result = serialize(
            [group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[dev_environment.id],
                stats_period="14d",
                expand=["sessions"],
                start=timezone.now() - timedelta(days=30),
                end=timezone.now() - timedelta(days=15),
            ),
        )
        assert result[0]["sessionCount"] == 1

        # Delete the cache from the query we did above, else this result comes back as 1 instead of 0.5
        cache.delete(f"w-s:{group.project.id}-{dev_environment.id}")
        project2 = self.create_project(
            organization=self.organization, teams=[self.team], name="Another project"
        )
        data = {
            "fingerprint": ["meow"],
            "timestamp": iso_format(timezone.now()),
            "type": "error",
            "exception": [{"type": "Foo"}],
        }
        event = self.store_event(data=data, project_id=project2.id)
        self.store_event(data=data, project_id=project2.id)
        self.store_event(data=data, project_id=project2.id)

        result = serialize(
            [group, event.group],
            serializer=StreamGroupSerializerSnuba(
                environment_ids=[dev_environment.id],
                stats_period="14d",
                expand=["sessions"],
            ),
        )
        assert result[0]["sessionCount"] == 2
        # No sessions in project2
        assert result[1]["sessionCount"] is None
