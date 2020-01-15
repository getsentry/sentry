# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.compat import mock
import six

from datetime import timedelta

from django.utils import timezone
from sentry.utils.compat.mock import patch

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (
    Environment,
    GroupLink,
    GroupResolution,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    UserOption,
    UserOptionValue,
)
from sentry.testutils import TestCase


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
        assert result["statusDetails"]["actor"]["id"] == six.text_type(user.id)

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
        assert result["statusDetails"]["actor"]["id"] == six.text_type(user.id)

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
            # ((default, project), (subscribed, details))
            ((UserOptionValue.all_conversations, None), (True, None)),
            ((UserOptionValue.all_conversations, UserOptionValue.all_conversations), (True, None)),
            (
                (UserOptionValue.all_conversations, UserOptionValue.participating_only),
                (False, None),
            ),
            (
                (UserOptionValue.all_conversations, UserOptionValue.no_conversations),
                (False, {"disabled": True}),
            ),
            ((None, None), (False, None)),
            ((UserOptionValue.participating_only, None), (False, None)),
            ((UserOptionValue.participating_only, UserOptionValue.all_conversations), (True, None)),
            (
                (UserOptionValue.participating_only, UserOptionValue.participating_only),
                (False, None),
            ),
            (
                (UserOptionValue.participating_only, UserOptionValue.no_conversations),
                (False, {"disabled": True}),
            ),
            ((UserOptionValue.no_conversations, None), (False, {"disabled": True})),
            ((UserOptionValue.no_conversations, UserOptionValue.all_conversations), (True, None)),
            ((UserOptionValue.no_conversations, UserOptionValue.participating_only), (False, None)),
            (
                (UserOptionValue.no_conversations, UserOptionValue.no_conversations),
                (False, {"disabled": True}),
            ),
        )

        def maybe_set_value(project, value):
            if value is not None:
                UserOption.objects.set_value(
                    user=user, project=project, key="workflow:notifications", value=value
                )
            else:
                UserOption.objects.unset_value(
                    user=user, project=project, key="workflow:notifications"
                )

        for options, (is_subscribed, subscription_details) in combinations:
            default_value, project_value = options
            UserOption.objects.clear_local_cache()
            maybe_set_value(None, default_value)
            maybe_set_value(group.project, project_value)
            result = serialize(group, user)
            assert result["isSubscribed"] is is_subscribed
            assert result.get("subscriptionDetails") == subscription_details

    def test_global_no_conversations_overrides_group_subscription(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user=user, group=group, project=group.project, is_active=True
        )

        UserOption.objects.set_value(
            user=user,
            project=None,
            key="workflow:notifications",
            value=UserOptionValue.no_conversations,
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

        UserOption.objects.set_value(
            user=user,
            project=group.project,
            key="workflow:notifications",
            value=UserOptionValue.no_conversations,
        )

        result = serialize(group, user)
        assert not result["isSubscribed"]
        assert result["subscriptionDetails"] == {"disabled": True}

    def test_no_user_unsubscribed(self):
        group = self.create_group()

        result = serialize(group)
        assert not result["isSubscribed"]


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
