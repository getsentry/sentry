# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from mock import Mock, patch

from sentry import tagstore
from sentry.models import Group, GroupSnooze, GroupStatus, ServiceHook
from sentry.testutils import TestCase
from sentry.tasks.merge import merge_group
from sentry.tasks.post_process import index_event_tags, post_process_group


class PostProcessGroupTest(TestCase):
    @patch('sentry.rules.processor.RuleProcessor')
    def test_rule_processor(self, mock_processor):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [
            (mock_callback, mock_futures),
        ]

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
            is_new_group_environment=True,
        )

        mock_processor.assert_called_once_with(event, True, False, True)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(event, mock_futures)

    @patch('sentry.rules.processor.RuleProcessor')
    def test_group_refresh(self, mock_processor):
        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        event = self.create_event(group=group1)

        assert event.group_id == group1.id
        assert event.group == group1

        with self.tasks():
            merge_group(group1.id, group2.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [
            (mock_callback, mock_futures),
        ]

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
            is_new_group_environment=True,
        )

        assert event.group == group2
        assert event.group_id == group2.id

    def test_invalidates_snooze(self):
        group = self.create_group(
            project=self.project, status=GroupStatus.IGNORED)
        event = self.create_event(group=group)
        snooze = GroupSnooze.objects.create(
            group=group,
            until=timezone.now() - timedelta(hours=1),
        )

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
            is_new_group_environment=True,
        )

        assert not GroupSnooze.objects.filter(
            id=snooze.id,
        ).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

    def test_maintains_valid_snooze(self):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)
        snooze = GroupSnooze.objects.create(
            group=group,
            until=timezone.now() + timedelta(hours=1),
        )

        post_process_group(
            event=event,
            is_new=True,
            is_regression=False,
            is_sample=False,
            is_new_group_environment=True,
        )

        assert GroupSnooze.objects.filter(
            id=snooze.id,
        ).exists()

    @patch('sentry.tasks.servicehooks.process_service_hook')
    def test_service_hook_fires_on_new_event(self, mock_process_service_hook):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        hook = ServiceHook.objects.create(
            project_id=self.project.id,
            actor_id=self.user.id,
            events=['event.created'],
        )

        with self.feature('projects:servicehooks'):
            post_process_group(
                event=event,
                is_new=False,
                is_regression=False,
                is_sample=False,
                is_new_group_environment=False,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id,
            event=event,
        )

    @patch('sentry.tasks.servicehooks.process_service_hook')
    @patch('sentry.rules.processor.RuleProcessor')
    def test_service_hook_fires_on_alert(self, mock_processor, mock_process_service_hook):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [
            (mock_callback, mock_futures),
        ]

        hook = ServiceHook.objects.create(
            project_id=self.project.id,
            actor_id=self.user.id,
            events=['event.alert'],
        )

        with self.feature('projects:servicehooks'):
            post_process_group(
                event=event,
                is_new=False,
                is_regression=False,
                is_sample=False,
                is_new_group_environment=False,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id,
            event=event,
        )

    @patch('sentry.tasks.servicehooks.process_service_hook')
    @patch('sentry.rules.processor.RuleProcessor')
    def test_service_hook_does_not_fire_without_alert(
            self, mock_processor, mock_process_service_hook):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        mock_processor.return_value.apply.return_value = []

        ServiceHook.objects.create(
            project_id=self.project.id,
            actor_id=self.user.id,
            events=['event.alert'],
        )

        with self.feature('projects:servicehooks'):
            post_process_group(
                event=event,
                is_new=False,
                is_regression=False,
                is_sample=False,
                is_new_group_environment=False,
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch('sentry.tasks.servicehooks.process_service_hook')
    def test_service_hook_does_not_fire_without_event(self, mock_process_service_hook):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        ServiceHook.objects.create(
            project_id=self.project.id,
            actor_id=self.user.id,
            events=[],
        )

        with self.feature('projects:servicehooks'):
            post_process_group(
                event=event,
                is_new=True,
                is_regression=False,
                is_sample=False,
                is_new_group_environment=False,
            )

        assert not mock_process_service_hook.delay.mock_calls


class IndexEventTagsTest(TestCase):
    def test_simple(self):
        group = self.create_group(project=self.project)
        event = self.create_event(group=group)

        with self.tasks():
            index_event_tags.delay(
                event_id=event.id,
                group_id=group.id,
                project_id=self.project.id,
                environment_id=self.environment.id,
                organization_id=self.project.organization_id,
                tags=[('foo', 'bar'), ('biz', 'baz')],
            )

        assert tagstore.get_group_event_ids(
            self.project.id,
            group.id,
            self.environment.id,
            {'foo': 'bar', 'biz': 'baz'},
        ) == [event.id]

        # ensure it safely handles repeat runs
        with self.tasks():
            index_event_tags.delay(
                event_id=event.id,
                group_id=group.id,
                project_id=self.project.id,
                environment_id=self.environment.id,
                organization_id=self.project.organization_id,
                tags=[('foo', 'bar'), ('biz', 'baz')],
            )

        assert tagstore.get_group_event_ids(
            self.project.id,
            group.id,
            self.environment.id,
            {'foo': 'bar', 'biz': 'baz'},
        ) == [event.id]
