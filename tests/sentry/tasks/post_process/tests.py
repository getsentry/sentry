# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from sentry.utils.compat.mock import Mock, patch, ANY

from sentry.models import Group, GroupSnooze, GroupStatus, ProjectOwnership
from sentry.ownership.grammar import Rule, Matcher, Owner, dump_schema
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import post_process_group


class PostProcessGroupTest(TestCase):
    @patch("sentry.rules.processor.RuleProcessor")
    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    @patch("sentry.signals.event_processed.send_robust")
    def test_issueless(
        self,
        mock_signal,
        mock_process_resource_change_bound,
        mock_process_service_hook,
        mock_processor,
    ):
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "type": "transaction",
                "timestamp": min_ago,
                "start_timestamp": min_ago,
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        post_process_group(
            event=event, is_new=True, is_regression=False, is_new_group_environment=True
        )

        mock_processor.assert_not_called()  # NOQA
        mock_process_service_hook.assert_not_called()  # NOQA
        mock_process_resource_change_bound.assert_not_called()  # NOQA

        mock_signal.assert_called_once_with(
            sender=ANY, project=self.project, event=event, primary_hash=None
        )

    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        post_process_group(
            event=event, is_new=True, is_regression=False, is_new_group_environment=True
        )

        mock_processor.assert_called_once_with(event, True, False, True, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(event, mock_futures)

    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_refresh(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)
        group1 = event.group
        group2 = self.create_group(project=self.project)

        assert event.group_id == group1.id
        assert event.group == group1

        with self.tasks():
            merge_groups([group1.id], group2.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        post_process_group(
            event=event, is_new=True, is_regression=False, is_new_group_environment=True
        )

        assert event.group == group2
        assert event.group_id == group2.id

    @patch("sentry.rules.processor.RuleProcessor")
    def test_invalidates_snooze(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)
        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(hours=1))

        # Check for has_reappeared=False if is_new=True
        post_process_group(
            event=event, is_new=True, is_regression=False, is_new_group_environment=True
        )

        mock_processor.assert_called_with(event, True, False, True, False)

        # Check for has_reappeared=True if is_new=False
        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=True
        )

        mock_processor.assert_called_with(event, False, False, True, True)

        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED

    @patch("sentry.rules.processor.RuleProcessor")
    def test_maintains_valid_snooze(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)
        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() + timedelta(hours=1))

        post_process_group(
            event=event, is_new=True, is_regression=False, is_new_group_environment=True
        )

        mock_processor.assert_called_with(event, True, False, True, False)

        assert GroupSnooze.objects.filter(id=snooze.id).exists()

    def make_ownership(self):
        rule_a = Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])
        rule_b = Rule(Matcher("path", "tests/*"), [Owner("team", self.team.name)])
        rule_c = Rule(Matcher("path", "src/app/*"), [Owner("team", self.team.name)])

        ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema([rule_a, rule_b, rule_c]),
            fallthrough=True,
            auto_assignment=True,
        )

    def test_owner_assignment_path_precedence(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user is None
        assert assignee.team == self.team

    def test_owner_assignment_assign_user(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == self.user
        assert assignee.team is None

    def test_owner_assignment_ownership_no_matching_owners(self):
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )
        assert not event.group.assignee_set.exists()

    def test_owner_assignment_existing_assignment(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        event.group.assignee_set.create(team=self.team, project=self.project)
        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user is None
        assert assignee.team == self.team

    def test_owner_assignment_owner_is_gone(self):
        self.make_ownership()
        # Remove the team so the rule match will fail to resolve
        self.team.delete()

        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )
        assignee = event.group.assignee_set.first()
        assert assignee is None

    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_fires_on_new_event(self, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.created"],
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                event=event, is_new=False, is_regression=False, is_new_group_environment=False
            )

        mock_process_service_hook.delay.assert_called_once_with(servicehook_id=hook.id, event=event)

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_fires_on_alert(self, mock_processor, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                event=event, is_new=False, is_regression=False, is_new_group_environment=False
            )

        mock_process_service_hook.delay.assert_called_once_with(servicehook_id=hook.id, event=event)

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_does_not_fire_without_alert(
        self, mock_processor, mock_process_service_hook
    ):
        event = self.store_event(data={}, project_id=self.project.id)

        mock_processor.return_value.apply.return_value = []

        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                event=event, is_new=False, is_regression=False, is_new_group_environment=False
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_does_not_fire_without_event(self, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        with self.feature("projects:servicehooks"):
            post_process_group(
                event=event, is_new=True, is_regression=False, is_new_group_environment=False
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_new_group(self, delay):
        event = self.store_event(data={}, project_id=self.project.id)
        group = event.group
        post_process_group(
            event=event, is_new=True, is_regression=False, is_new_group_environment=False
        )

        delay.assert_called_once_with(action="created", sender="Group", instance_id=group.id)

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_error_events(self, delay):
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "shits on fiah yo"},
                "level": "error",
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["error.created"],
        )

        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )

        kwargs = {"instance": event}
        delay.assert_called_once_with(
            action="created", sender="Error", instance_id=event.event_id, **kwargs
        )

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_for_non_errors(self, delay):
        event = self.store_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )

        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )

        assert not delay.called

    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_feature_flag(self, delay):
        event = self.store_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )

        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )

        assert not delay.called

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_error_created(self, delay):
        event = self.store_event(
            data={
                "message": "Foo bar",
                "level": "error",
                "exception": {"type": "Foo", "value": "shits on fiah yo"},
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        post_process_group(
            event=event, is_new=False, is_regression=False, is_new_group_environment=False
        )

        assert not delay.called
