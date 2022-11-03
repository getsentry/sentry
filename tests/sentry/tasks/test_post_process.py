from __future__ import annotations

import abc
from datetime import timedelta
from unittest import mock
from unittest.mock import Mock, patch

import pytz
from django.test import override_settings
from django.utils import timezone

from sentry import buffer
from sentry.buffer.redis import RedisBuffer
from sentry.eventstore.processing import event_processing_store
from sentry.models import (
    Activity,
    Group,
    GroupAssignee,
    GroupInbox,
    GroupInboxReason,
    GroupOwner,
    GroupOwnerType,
    GroupSnooze,
    GroupStatus,
    ProjectOwnership,
    ProjectTeam,
)
from sentry.models.activity import ActivityIntegration
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.rules import init_registry
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import post_process_group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers import apply_feature_flag_on_cls, with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.issues import GroupType
from sentry.utils.cache import cache


class EventMatcher:
    def __init__(self, expected, group=None):
        self.expected = expected
        self.expected_group = group

    def __eq__(self, other):
        matching_id = other.event_id == self.expected.event_id
        if self.expected_group:
            return (
                matching_id
                and self.expected_group == other.group
                and self.expected_group.id == other.group_id
            )
        return matching_id


class BasePostProgressGroupMixin(BaseTestCase, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def create_event(self, data, project_id):
        pass

    @abc.abstractmethod
    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, cache_key, group_id
    ):
        pass


class CorePostProcessGroupTestMixin(BasePostProgressGroupMixin):
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
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=None,
        )

        assert mock_processor.call_count == 0
        assert mock_process_service_hook.call_count == 0
        assert mock_process_resource_change_bound.call_count == 0

        # transaction events do not call event.processed
        assert mock_signal.call_count == 0

    @patch("sentry.rules.processor.RuleProcessor")
    def test_no_cache_abort(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key="total-rubbish",
            group_id=event.group_id,
        )

        assert mock_processor.call_count == 0

    def test_processing_cache_cleared(self):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert event_processing_store.get(cache_key) is None

    def test_processing_cache_cleared_with_commits(self):
        # Regression test to guard against suspect commit calculations breaking the
        # cache
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        self.create_commit(repo=self.create_repo())
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert event_processing_store.get(cache_key) is None


class RuleProcessorTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor_backwards_compat(self, mock_processor):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            group_id=event.group_id,
            cache_key=cache_key,
        )

        mock_processor.assert_called_once_with(EventMatcher(event), True, False, True, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor(self, mock_processor):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_once_with(EventMatcher(event), True, False, True, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    def test_rule_processor_buffer_values(self):
        # Test that pending buffer values for `times_seen` are applied to the group and that alerts
        # fire as expected
        from sentry.models import Rule

        MOCK_RULES = ("sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",)

        redis_buffer = RedisBuffer()
        with mock.patch("sentry.buffer.get", redis_buffer.get), mock.patch(
            "sentry.buffer.incr", redis_buffer.incr
        ), patch("sentry.constants._SENTRY_RULES", MOCK_RULES), patch(
            "sentry.rules.processor.rules", init_registry()
        ) as rules:
            MockAction = mock.Mock()
            MockAction.rule_type = "action/event"
            MockAction.id = "tests.sentry.tasks.post_process.tests.MockAction"
            MockAction.return_value.after.return_value = []
            rules.add(MockAction)

            conditions = [
                {
                    "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
                    "value": 10,
                },
            ]
            actions = [{"id": "tests.sentry.tasks.post_process.tests.MockAction"}]
            Rule.objects.filter(project=self.project).delete()
            Rule.objects.create(
                project=self.project, data={"conditions": conditions, "actions": actions}
            )

            event = self.store_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            event_2 = self.store_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            cache_key = write_event_to_cache(event)
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                cache_key=cache_key,
                group_id=event.group_id,
            )
            event.group.update(times_seen=2)
            assert MockAction.return_value.after.call_count == 0

            cache_key = write_event_to_cache(event_2)
            buffer.incr(Group, {"times_seen": 15}, filters={"pk": event.group.id})
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                cache_key=cache_key,
                group_id=event_2.group_id,
            )
            assert MockAction.return_value.after.call_count == 1

    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_refresh(self, mock_processor):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        group1 = event.group
        group2 = self.create_group(project=self.project)

        assert event.group_id == group1.id
        assert event.group == group1

        with self.tasks():
            merge_groups([group1.id], group2.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        # Ensure that rule processing sees the merged group.
        mock_processor.assert_called_with(
            EventMatcher(event, group=group2), True, False, True, False
        )


class ServiceHooksTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_fires_on_new_event(self, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)
        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.created"],
        )

        with self.feature("projects:servicehooks"):
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id, event=EventMatcher(event)
        )

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_fires_on_alert(self, mock_processor, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

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
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id, event=EventMatcher(event)
        )

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_does_not_fire_without_alert(
        self, mock_processor, mock_process_service_hook
    ):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        mock_processor.return_value.apply.return_value = []

        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        with self.feature("projects:servicehooks"):
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_does_not_fire_without_event(self, mock_process_service_hook):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        with self.feature("projects:servicehooks"):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=cache_key,
                group_id=event.group_id,
            )

        assert not mock_process_service_hook.delay.mock_calls


class ResourceChangeBoundsTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_new_group(self, delay):
        event = self.store_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)
        group = event.group
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        delay.assert_called_once_with(action="created", sender="Group", instance_id=group.id)

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_error_events(self, delay):
        event = self.store_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["error.created"],
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        delay.assert_called_once_with(
            action="created",
            sender="Error",
            instance_id=event.event_id,
            instance=EventMatcher(event),
        )

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_for_non_errors(self, delay):
        event = self.store_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        assert not delay.called

    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_feature_flag(self, delay):
        event = self.store_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        assert not delay.called

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_error_created(self, delay):
        event = self.store_event(
            data={
                "message": "Foo bar",
                "level": "error",
                "exception": {"type": "Foo", "value": "oh no"},
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        cache_key = write_event_to_cache(event)

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        assert not delay.called


class InboxTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_inbox_regression(self, mock_processor):
        event = self.store_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        group = event.group

        self.call_post_process_group(
            is_new=True,
            is_regression=True,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        # assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        # GroupInbox.objects.filter(
        #     group=group
        # ).delete()  # Delete so it creates the .REGRESSION entry.

        mock_processor.assert_called_with(EventMatcher(event), True, True, False, False)

        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, True, False, False)

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED
        # assert GroupInbox.objects.filter(
        #     group=group, reason=GroupInboxReason.REGRESSION.value
        # ).exists()


class AssignmentTestMixin(BasePostProgressGroupMixin):
    def make_ownership(self, extra_rules=None):
        self.user_2 = self.create_user()
        self.create_team_membership(team=self.team, user=self.user_2)
        rules = [
            Rule(Matcher("path", "src/app/*"), [Owner("team", self.team.name)]),
            Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)]),
            Rule(Matcher("path", "tests/*"), [Owner("user", self.user_2.email)]),
        ]

        if extra_rules:
            rules.extend(extra_rules)

        self.prj_ownership = ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(rules),
            fallthrough=True,
            auto_assignment=True,
        )

    def test_owner_assignment_order_precedence(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == self.user
        assert assignee.team is None

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert len(owners) == 2
        assert {(self.user.id, None), (None, self.team.id)} == {
            (o.user_id, o.team_id) for o in owners
        }
        activity = Activity.objects.filter(group=event.group).first()
        assert activity.data == {
            "assignee": str(self.user.id),
            "assigneeEmail": self.user.email,
            "assigneeType": "user",
            "integration": ActivityIntegration.PROJECT_OWNERSHIP.value,
            "rule": str(Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])),
        }

    def test_owner_assignment_extra_groups(self):
        extra_user = self.create_user()
        self.create_team_membership(self.team, user=extra_user)
        self.make_ownership(
            [Rule(Matcher("path", "src/app/things/in/*"), [Owner("user", extra_user.email)])],
        )
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == extra_user
        assert assignee.team is None

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert len(owners) == 2
        assert {(extra_user.id, None), (self.user.id, None)} == {
            (o.user_id, o.team_id) for o in owners
        }

    def test_owner_assignment_existing_owners(self):
        extra_team = self.create_team()
        ProjectTeam.objects.create(team=extra_team, project=self.project)

        self.make_ownership(
            [Rule(Matcher("path", "src/app/things/in/*"), [Owner("team", extra_team.slug)])],
        )
        GroupOwner.objects.create(
            group=self.group,
            project=self.project,
            organization=self.organization,
            user=self.user,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
        )
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user is None
        assert assignee.team == extra_team

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert {(None, extra_team.id), (self.user.id, None)} == {
            (o.user_id, o.team_id) for o in owners
        }

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
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
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
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
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
        cache_key = write_event_to_cache(event)
        event.group.assignee_set.create(team=self.team, project=self.project)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user is None
        assert assignee.team == self.team

    def test_only_first_assignment_works(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == self.user
        assert assignee.team is None

        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "tests/src/app/test_example.py"}]},
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        # Assignment shouldn't change.
        assert assignee.user == self.user
        assert assignee.team is None

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
        cache_key = write_event_to_cache(event)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee is None

    def test_owner_assignment_when_owners_have_been_unassigned(self):
        """
        Test that ensures that if certain assignees get unassigned, and project rules are changed
        then the new group assignees should be re-calculated and re-assigned
        """
        # Create rules and check assignees
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        event_2 = self.store_event(
            data={
                "message": "Exception",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/integration.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)
        cache_key_2 = write_event_to_cache(event_2)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key_2,
            group_id=event_2.group_id,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user == self.user

        user_3 = self.create_user()
        self.create_team_membership(self.team, user=user_3)

        # De-assign group assignees
        GroupAssignee.objects.deassign(event.group, self.user)
        assert event.group.assignee_set.first() is None

        # Change ProjectOwnership rules
        rules = [
            Rule(Matcher("path", "src/*"), [Owner("user", user_3.email)]),
        ]
        self.prj_ownership.schema = dump_schema(rules)
        self.prj_ownership.save()

        cache_key = write_event_to_cache(event)
        cache_key_2 = write_event_to_cache(event_2)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key_2,
            group_id=event_2.group_id,
        )

        # Group should be re-assigned to the new group owner
        assignee = event.group.assignee_set.first()
        assert assignee.user == user_3

        # De-assign group assignees
        GroupAssignee.objects.deassign(event.group, assignee.user)
        assert event.group.assignee_set.first() is None

        user_4 = self.create_user()
        self.create_team_membership(self.team, user=user_4)
        self.prj_ownership.schema = dump_schema([])
        self.prj_ownership.save()

        code_owners_rule = Rule(
            Matcher("codeowners", "*.py"),
            [Owner("user", user_4.email)],
        )

        self.code_mapping = self.create_code_mapping(project=self.project)
        self.code_owners = self.create_codeowners(
            self.project,
            self.code_mapping,
            schema=dump_schema([code_owners_rule]),
        )

        cache_key = write_event_to_cache(event)
        cache_key_2 = write_event_to_cache(event_2)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key_2,
            group_id=event_2.group_id,
        )

        # Group should be re-assigned to the new group owner
        assignee = event.group.assignee_set.first()
        assert assignee.user == user_4

    def test_ensure_when_assignees_and_owners_are_cached_does_not_cause_unbound_errors(self):
        self.make_ownership()
        event = self.store_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        cache_key = write_event_to_cache(event)

        assignee_cache_key = "assignee_exists:1:%s" % event.group.id
        owner_cache_key = "owner_exists:1:%s" % event.group.id

        for key in [assignee_cache_key, owner_cache_key]:
            cache.set(key, True)

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=event.group_id,
        )


class SnoozeTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_invalidates_snooze(self, mock_processor, send_robust):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)

        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(hours=1))

        # Check for has_reappeared=False if is_new=True
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        GroupInbox.objects.filter(group=group).delete()  # Delete so it creates the UNIGNORED entry.
        Activity.objects.filter(group=group).delete()

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False)

        cache_key = write_event_to_cache(event)
        # Check for has_reappeared=True if is_new=False
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, False, True, True)

        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.UNIGNORED.value
        ).exists()
        assert Activity.objects.filter(
            group=group, project=group.project, type=ActivityType.SET_UNRESOLVED.value
        ).exists()
        assert send_robust.called

    @override_settings(SENTRY_BUFFER="sentry.buffer.redis.RedisBuffer")
    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_invalidates_snooze_with_buffers(self, mock_processor, send_robust):
        redis_buffer = RedisBuffer()
        with mock.patch("sentry.buffer.get", redis_buffer.get), mock.patch(
            "sentry.buffer.incr", redis_buffer.incr
        ):
            event = self.create_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            event_2 = self.create_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            group = event.group
            group.update(times_seen=50)
            snooze = GroupSnooze.objects.create(group=group, count=100, state={"times_seen": 0})

            cache_key = write_event_to_cache(event)
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                cache_key=cache_key,
                group_id=event.group_id,
            )
            assert GroupSnooze.objects.filter(id=snooze.id).exists()
            cache_key = write_event_to_cache(event_2)

            buffer.incr(Group, {"times_seen": 60}, filters={"pk": event.group.id})
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                cache_key=cache_key,
                group_id=event.group_id,
            )
            assert not GroupSnooze.objects.filter(id=snooze.id).exists()

    @patch("sentry.rules.processor.RuleProcessor")
    def test_maintains_valid_snooze(self, mock_processor):
        event = self.create_event(data={}, project_id=self.project.id)
        cache_key = write_event_to_cache(event)
        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() + timedelta(hours=1))

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key=cache_key,
            group_id=event.group_id,
        )

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False)

        assert GroupSnooze.objects.filter(id=snooze.id).exists()


@region_silo_test
class PostProcessGroupErrorTest(
    TestCase,
    AssignmentTestMixin,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    ResourceChangeBoundsTestMixin,
    RuleProcessorTestMixin,
    ServiceHooksTestMixin,
    SnoozeTestMixin,
):
    def create_event(self, data, project_id):
        return self.store_event(data=data, project_id=project_id)

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, cache_key, group_id
    ):
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=cache_key,
            group_id=group_id,
        )


@region_silo_test
@apply_feature_flag_on_cls("organizations:performance-issues-post-process-group")
class PostProcessGroupPerformanceTest(
    TestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    RuleProcessorTestMixin,
    SnoozeTestMixin,
):
    def create_event(self, data, project_id):
        fingerprint = data["fingerprint"][0] if data.get("fingerprint") else "some_group"
        fingerprint = f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-{fingerprint}"
        # Store a performance event
        event = self.store_transaction(
            project_id=project_id,
            user_id="hi",
            fingerprint=[fingerprint],
        )
        return event.for_group(event.groups[0])

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, cache_key, group_id
    ):
        group_states = (
            [
                {
                    "id": group_id,
                    "is_new": is_new,
                    "is_regression": is_regression,
                    "is_new_group_environment": is_new_group_environment,
                }
            ]
            if group_id
            else None
        )
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=cache_key,
            group_states=group_states,
        )

    @patch("sentry.tasks.post_process.run_post_process_job")
    @patch("sentry.rules.processor.RuleProcessor")
    @patch("sentry.signals.transaction_processed.send_robust")
    @patch("sentry.signals.event_processed.send_robust")
    def test_process_transaction_event_with_no_group(
        self,
        event_processed_signal_mock,
        transaction_processed_signal_mock,
        mock_processor,
        run_post_process_job_mock,
    ):
        min_ago = before_now(minutes=1).replace(tzinfo=pytz.utc)
        event = self.store_transaction(
            project_id=self.project.id,
            user_id=self.create_user(name="user1").name,
            fingerprint=[],
            environment=None,
            timestamp=min_ago,
        )
        assert len(event.groups) == 0
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=None,
            group_states=None,
        )

        assert transaction_processed_signal_mock.call_count == 1
        assert event_processed_signal_mock.call_count == 0
        assert mock_processor.call_count == 0
        assert run_post_process_job_mock.call_count == 0

    @with_feature("organizations:performance-issues-post-process-group")
    @patch("sentry.tasks.post_process.run_post_process_job")
    @patch("sentry.rules.processor.RuleProcessor")
    @patch("sentry.signals.transaction_processed.send_robust")
    @patch("sentry.signals.event_processed.send_robust")
    def test_full_pipeline_with_group_states(
        self,
        event_processed_signal_mock,
        transaction_processed_signal_mock,
        mock_processor,
        run_post_process_job_mock,
    ):
        min_ago = before_now(minutes=1).replace(tzinfo=pytz.utc)
        event = self.store_transaction(
            project_id=self.project.id,
            user_id=self.create_user(name="user1").name,
            fingerprint=[
                f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1",
                f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group2",
            ],
            environment=None,
            timestamp=min_ago,
        )
        assert len(event.groups) == 2
        cache_key = write_event_to_cache(event)
        group_state = dict(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
        )
        post_process_group(
            **group_state,
            cache_key=cache_key,
            group_id=event.group_id,
            group_states=[{"id": group.id, **group_state} for group in event.groups],
        )

        assert transaction_processed_signal_mock.call_count == 1
        assert event_processed_signal_mock.call_count == 0
        assert mock_processor.call_count == 0
        assert run_post_process_job_mock.call_count == 2
