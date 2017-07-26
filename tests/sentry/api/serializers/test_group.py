# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone
from mock import patch

from sentry.api.serializers import serialize
from sentry.models import (
    GroupResolution, GroupSnooze, GroupSubscription, GroupStatus, UserOption, UserOptionValue
)
from sentry.testutils import TestCase


class GroupSerializerTest(TestCase):
    def test_is_ignored_with_expired_snooze(self):
        now = timezone.now().replace(microsecond=0)

        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.IGNORED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=now - timedelta(minutes=1),
        )

        result = serialize(group, user)
        assert result['status'] == 'unresolved'
        assert result['statusDetails'] == {}

    def test_is_ignored_with_valid_snooze(self):
        now = timezone.now().replace(microsecond=0)

        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.IGNORED,
        )
        snooze = GroupSnooze.objects.create(
            group=group,
            until=now + timedelta(minutes=1),
        )

        result = serialize(group, user)
        assert result['status'] == 'ignored'
        assert result['statusDetails']['ignoreCount'] == snooze.count
        assert result['statusDetails']['ignoreWindow'] == snooze.window
        assert result['statusDetails']['ignoreUserCount'] == snooze.user_count
        assert result['statusDetails']['ignoreUserWindow'] == snooze.user_window
        assert result['statusDetails']['ignoreUntil'] == snooze.until
        assert result['statusDetails']['actor'] is None

    def test_is_ignored_with_valid_snooze_and_actor(self):
        now = timezone.now().replace(microsecond=0)

        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.IGNORED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=now + timedelta(minutes=1),
            actor_id=user.id,
        )

        result = serialize(group, user)
        assert result['status'] == 'ignored'
        assert result['statusDetails']['actor']['id'] == six.text_type(user.id)

    def test_resolved_in_next_release(self):
        release = self.create_release(project=self.project, version='a')
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        GroupResolution.objects.create(
            group=group,
            release=release,
            type=GroupResolution.Type.in_next_release,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails'] == {'inNextRelease': True, 'actor': None}

    def test_resolved_in_release(self):
        release = self.create_release(project=self.project, version='a')
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        GroupResolution.objects.create(
            group=group,
            release=release,
            type=GroupResolution.Type.in_release,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails'] == {'inRelease': 'a', 'actor': None}

    def test_resolved_with_actor(self):
        release = self.create_release(project=self.project, version='a')
        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        GroupResolution.objects.create(
            group=group,
            release=release,
            type=GroupResolution.Type.in_release,
            actor_id=user.id,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails']['actor']['id'] == six.text_type(user.id)

    @patch('sentry.models.Group.is_over_resolve_age')
    def test_auto_resolved(self, mock_is_over_resolve_age):
        mock_is_over_resolve_age.return_value = True

        user = self.create_user()
        group = self.create_group(
            status=GroupStatus.UNRESOLVED,
        )

        result = serialize(group, user)
        assert result['status'] == 'resolved'
        assert result['statusDetails'] == {'autoResolved': True}

    def test_subscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user=user,
            group=group,
            project=group.project,
            is_active=True,
        )

        result = serialize(group, user)
        assert result['isSubscribed']

    def test_explicit_unsubscribed(self):
        user = self.create_user()
        group = self.create_group()

        GroupSubscription.objects.create(
            user=user,
            group=group,
            project=group.project,
            is_active=False,
        )

        result = serialize(group, user)
        assert not result['isSubscribed']

    def test_implicit_subscribed(self):
        user = self.create_user()
        group = self.create_group()

        combinations = (
            ((None, None), True), ((UserOptionValue.all_conversations, None), True),
            ((UserOptionValue.all_conversations, UserOptionValue.all_conversations), True),
            ((UserOptionValue.all_conversations, UserOptionValue.participating_only),
             False), ((UserOptionValue.participating_only, None), False),
            ((UserOptionValue.participating_only, UserOptionValue.all_conversations), True),
            ((UserOptionValue.participating_only, UserOptionValue.participating_only), False),
        )

        def maybe_set_value(project, value):
            if value is not None:
                UserOption.objects.set_value(
                    user=user,
                    project=project,
                    key='workflow:notifications',
                    value=value,
                )
            else:
                UserOption.objects.unset_value(
                    user=user,
                    project=project,
                    key='workflow:notifications',
                )

        for options, expected_result in combinations:
            UserOption.objects.clear_cache()
            default_value, project_value = options
            maybe_set_value(None, default_value)
            maybe_set_value(group.project, project_value)
            assert serialize(group, user
                             )['isSubscribed'] is expected_result, 'expected {!r} for {!r}'.format(
                                 expected_result, options
                             )  # noqa

    def test_no_user_unsubscribed(self):
        group = self.create_group()

        result = serialize(group)
        assert not result['isSubscribed']
