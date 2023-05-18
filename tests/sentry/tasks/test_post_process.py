from __future__ import annotations

import abc
import time
from datetime import datetime, timedelta
from typing import Any
from unittest import mock
from unittest.mock import Mock, patch

import pytz
from django.test import override_settings
from django.utils import timezone

from sentry import buffer
from sentry.buffer.redis import RedisBuffer
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.issues.escalating import manage_issue_states
from sentry.issues.grouptype import (
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
    ProfileFileIOGroupType,
)
from sentry.issues.ingest import save_issue_occurrence
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
    Integration,
    ProjectOwnership,
    ProjectTeam,
)
from sentry.models.activity import ActivityIntegration
from sentry.models.groupowner import (
    ASSIGNEE_EXISTS_DURATION,
    ASSIGNEE_EXISTS_KEY,
    ISSUE_OWNERS_DEBOUNCE_DURATION,
    ISSUE_OWNERS_DEBOUNCE_KEY,
)
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.rules import init_registry
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.tasks.derive_code_mappings import SUPPORTED_LANGUAGES
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import (
    ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT,
    post_process_group,
    process_event,
)
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.cache import cache
from tests.sentry.issues.test_utils import OccurrenceTestMixin


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
    def create_event(self, data, project_id, assert_no_errors=True):
        pass

    @abc.abstractmethod
    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
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
            event=event,
            cache_key=cache_key,
        )

        assert mock_processor.call_count == 0
        assert mock_process_service_hook.call_count == 0
        assert mock_process_resource_change_bound.call_count == 0

        # transaction events do not call event.processed
        assert mock_signal.call_count == 0

    @patch("sentry.rules.processor.RuleProcessor")
    def test_no_cache_abort(self, mock_processor):
        event = self.create_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
            cache_key="total-rubbish",
        )

        assert mock_processor.call_count == 0

    def test_processing_cache_cleared(self):
        event = self.create_event(data={}, project_id=self.project.id)

        cache_key = self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert event_processing_store.get(cache_key) is None

    def test_processing_cache_cleared_with_commits(self):
        # Regression test to guard against suspect commit calculations breaking the
        # cache
        event = self.create_event(data={}, project_id=self.project.id)

        self.create_commit(repo=self.create_repo())
        cache_key = self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert event_processing_store.get(cache_key) is None


class DeriveCodeMappingsProcessGroupTestMixin(BasePostProgressGroupMixin):
    def _create_event(
        self,
        data: dict[str, Any],
        project_id: int | None = None,
    ) -> Event:
        data.setdefault("platform", "javascript")
        return self.store_event(data=data, project_id=project_id or self.project.id)

    def _call_post_process_group(self, event: Event) -> None:
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

    @patch("sentry.tasks.derive_code_mappings.derive_code_mappings")
    def test_derive_invalid_platform(self, mock_derive_code_mappings):
        event = self._create_event({"platform": "elixir"})
        self._call_post_process_group(event)

        assert mock_derive_code_mappings.delay.call_count == 0

    @patch("sentry.tasks.derive_code_mappings.derive_code_mappings")
    def test_derive_supported_languages(self, mock_derive_code_mappings):
        for platform in SUPPORTED_LANGUAGES:
            event = self._create_event({"platform": platform})
            self._call_post_process_group(event)

            assert mock_derive_code_mappings.delay.call_count == 1

    @patch("sentry.tasks.derive_code_mappings.derive_code_mappings")
    def test_only_maps_a_given_project_once_per_hour(self, mock_derive_code_mappings):
        dogs_project = self.create_project()
        maisey_event = self._create_event(
            {
                "fingerprint": ["themaiseymasieydog"],
            },
            dogs_project.id,
        )
        charlie_event = self._create_event(
            {
                "fingerprint": ["charliebear"],
            },
            dogs_project.id,
        )
        cory_event = self._create_event(
            {
                "fingerprint": ["thenudge"],
            },
            dogs_project.id,
        )
        bodhi_event = self._create_event(
            {
                "fingerprint": ["theescapeartist"],
            },
            dogs_project.id,
        )

        self._call_post_process_group(maisey_event)
        assert mock_derive_code_mappings.delay.call_count == 1

        # second event from project should bail (no increase in call count)
        self._call_post_process_group(charlie_event)
        assert mock_derive_code_mappings.delay.call_count == 1

        # advance the clock 59 minutes, and it should still bail
        with patch("time.time", return_value=time.time() + 60 * 59):
            self._call_post_process_group(cory_event)
            assert mock_derive_code_mappings.delay.call_count == 1

        # now advance the clock 61 minutes, and this time it should go through
        with patch("time.time", return_value=time.time() + 60 * 61):
            self._call_post_process_group(bodhi_event)
            assert mock_derive_code_mappings.delay.call_count == 2

    @patch("sentry.tasks.derive_code_mappings.derive_code_mappings")
    def test_only_maps_a_given_issue_once_per_day(self, mock_derive_code_mappings):
        dogs_project = self.create_project()
        maisey_event1 = self._create_event(
            {
                "fingerprint": ["themaiseymaiseydog"],
            },
            dogs_project.id,
        )
        maisey_event2 = self._create_event(
            {
                "fingerprint": ["themaiseymaiseydog"],
            },
            dogs_project.id,
        )
        maisey_event3 = self._create_event(
            {
                "fingerprint": ["themaiseymaiseydog"],
            },
            dogs_project.id,
        )
        maisey_event4 = self._create_event(
            {
                "fingerprint": ["themaiseymaiseydog"],
            },
            dogs_project.id,
        )
        # because of the fingerprint, the events should always end up in the same group,
        # but the rest of the test is bogus if they aren't, so let's be sure
        assert maisey_event1.group_id == maisey_event2.group_id
        assert maisey_event2.group_id == maisey_event3.group_id
        assert maisey_event3.group_id == maisey_event4.group_id

        self._call_post_process_group(maisey_event1)
        assert mock_derive_code_mappings.delay.call_count == 1

        # second event from group should bail (no increase in call count)
        self._call_post_process_group(maisey_event2)
        assert mock_derive_code_mappings.delay.call_count == 1

        # advance the clock 23 hours and 59 minutes, and it should still bail
        with patch("time.time", return_value=time.time() + (60 * 60 * 23) + (60 * 59)):
            self._call_post_process_group(maisey_event3)
            assert mock_derive_code_mappings.delay.call_count == 1

        # now advance the clock 24 hours and 1 minute, and this time it should go through
        with patch("time.time", return_value=time.time() + (60 * 60 * 24) + (60 * 1)):
            self._call_post_process_group(maisey_event4)
            assert mock_derive_code_mappings.delay.call_count == 2

    @patch("sentry.tasks.derive_code_mappings.derive_code_mappings")
    def test_skipping_an_issue_doesnt_mark_it_processed(self, mock_derive_code_mappings):
        dogs_project = self.create_project()
        maisey_event = self._create_event(
            {
                "fingerprint": ["themaiseymasieydog"],
            },
            dogs_project.id,
        )
        charlie_event1 = self._create_event(
            {
                "fingerprint": ["charliebear"],
            },
            dogs_project.id,
        )
        charlie_event2 = self._create_event(
            {
                "fingerprint": ["charliebear"],
            },
            dogs_project.id,
        )
        # because of the fingerprint, the two Charlie events should always end up in the same group,
        # but the rest of the test is bogus if they aren't, so let's be sure
        assert charlie_event1.group_id == charlie_event2.group_id

        self._call_post_process_group(maisey_event)
        assert mock_derive_code_mappings.delay.call_count == 1

        # second event from project should bail (no increase in call count)
        self._call_post_process_group(charlie_event1)
        assert mock_derive_code_mappings.delay.call_count == 1

        # now advance the clock 61 minutes (so the project should clear the cache), and another
        # event from the Charlie group should go through
        with patch("time.time", return_value=time.time() + 60 * 61):
            self._call_post_process_group(charlie_event2)
            assert mock_derive_code_mappings.delay.call_count == 2


class RuleProcessorTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor_backwards_compat(self, mock_processor):
        event = self.create_event(data={}, project_id=self.project.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_processor.assert_called_once_with(EventMatcher(event), True, False, True, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    @patch("sentry.rules.processor.RuleProcessor")
    def test_rule_processor(self, mock_processor):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
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

            event = self.create_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            event_2 = self.create_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )
            event.group.update(times_seen=2)
            assert MockAction.return_value.after.call_count == 0

            buffer.incr(Group, {"times_seen": 15}, filters={"pk": event.group.id})
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event_2,
            )
            assert MockAction.return_value.after.call_count == 1

    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_refresh(self, mock_processor):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

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
            event=event,
        )
        # Ensure that rule processing sees the merged group.
        mock_processor.assert_called_with(
            EventMatcher(event, group=group2), True, False, True, False
        )


class ServiceHooksTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_fires_on_new_event(self, mock_process_service_hook):
        event = self.create_event(data={}, project_id=self.project.id)
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
                event=event,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id, event=EventMatcher(event)
        )

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_fires_on_alert(self, mock_processor, mock_process_service_hook):
        event = self.create_event(data={}, project_id=self.project.id)

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
                event=event,
            )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id, event=EventMatcher(event)
        )

    @patch("sentry.tasks.servicehooks.process_service_hook")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_service_hook_does_not_fire_without_alert(
        self, mock_processor, mock_process_service_hook
    ):
        event = self.create_event(data={}, project_id=self.project.id)

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
                event=event,
            )

        assert not mock_process_service_hook.delay.mock_calls

    @patch("sentry.tasks.servicehooks.process_service_hook")
    def test_service_hook_does_not_fire_without_event(self, mock_process_service_hook):
        event = self.create_event(data={}, project_id=self.project.id)

        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        with self.feature("projects:servicehooks"):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )

        assert not mock_process_service_hook.delay.mock_calls


class ResourceChangeBoundsTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_new_group(self, delay):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        delay.assert_called_once_with(action="created", sender="Group", instance_id=group.id)

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_error_events(self, delay):
        event = self.create_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
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

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
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
        event = self.create_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert not delay.called

    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_feature_flag(self, delay):
        event = self.create_event(
            data={"message": "Foo bar", "level": "info", "timestamp": iso_format(timezone.now())},
            project_id=self.project.id,
            assert_no_errors=False,
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert not delay.called

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_error_created(self, delay):
        event = self.create_event(
            data={
                "message": "Foo bar",
                "level": "error",
                "exception": {"type": "Foo", "value": "oh no"},
                "timestamp": iso_format(timezone.now()),
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.create_service_hook(
            project=self.project, organization=self.project.organization, actor=self.user, events=[]
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert not delay.called


class InboxTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.rules.processor.RuleProcessor")
    def test_group_inbox_regression(self, mock_processor):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        group = event.group

        self.call_post_process_group(
            is_new=True,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )
        assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        GroupInbox.objects.filter(
            group=group
        ).delete()  # Delete so it creates the .REGRESSION entry.

        mock_processor.assert_called_with(EventMatcher(event), True, True, False, False)

        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, True, False, False)

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.REGRESSED
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.REGRESSION.value
        ).exists()


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
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == self.user.id
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
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == extra_user.id
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
            user_id=self.user.id,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
        )
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id is None
        assert assignee.team == extra_team

        owners = list(GroupOwner.objects.filter(group=event.group))
        assert {(None, extra_team.id), (self.user.id, None)} == {
            (o.user_id, o.team_id) for o in owners
        }

    def test_owner_assignment_assign_user(self):
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == self.user.id
        assert assignee.team is None

    def test_owner_assignment_ownership_no_matching_owners(self):
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assert not event.group.assignee_set.exists()

    def test_owner_assignment_existing_assignment(self):
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        event.group.assignee_set.create(team=self.team, project=self.project)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id is None
        assert assignee.team == self.team

    def test_only_first_assignment_works(self):
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == self.user.id
        assert assignee.team is None

        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "tests/src/app/test_example.py"}]},
                "fingerprint": ["group1"],
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        # Assignment shouldn't change.
        assert assignee.user_id == self.user.id
        assert assignee.team is None

    def test_owner_assignment_owner_is_gone(self):
        self.make_ownership()
        # Remove the team so the rule match will fail to resolve
        self.team.delete()

        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee is None

    def test_suspect_committer_affect_cache_debouncing_issue_owners_calculations(self):
        self.make_ownership()
        committer = GroupOwner(
            group=self.created_event.group,
            project=self.created_event.project,
            organization=self.created_event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )
        committer.save()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        event.group.assignee_set.create(team=self.team, project=self.project)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id is None
        assert assignee.team == self.team

    def test_owner_assignment_when_owners_have_been_unassigned(self):
        """
        Test that ensures that if certain assignees get unassigned, and project rules are changed
        then the new group assignees should be re-calculated and re-assigned
        """
        # Create rules and check assignees
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        event_2 = self.create_event(
            data={
                "message": "Exception",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/integration.py"}]},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event_2,
        )
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == self.user.id

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

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event_2,
        )

        # Group should be re-assigned to the new group owner
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == user_3.id

        # De-assign group assignees
        GroupAssignee.objects.deassign(event.group, user_service.get_user(user_id=assignee.user_id))
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

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event_2,
        )

        # Group should be re-assigned to the new group owner
        assignee = event.group.assignee_set.first()
        assert assignee.user_id == user_4.id

    def test_auto_assignment_when_owners_have_been_unassigned(self):
        """
        Test that ensures that if assignee gets unassigned and project rules are changed,
        then the new group assignees should be re-calculated and re-assigned
        """
        # Create rules and check assignees
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assignee = (
            GroupOwner.objects.filter()
            .exclude(user_id__isnull=True, team_id__isnull=True)
            .order_by("type")
            .first()
        )
        assert assignee.user_id == self.user.id

        user_3 = self.create_user()
        self.create_team_membership(self.team, user=user_3)

        # Set assignee_exists cache to self.user
        cache.set(ASSIGNEE_EXISTS_KEY(event.group_id), self.user, ASSIGNEE_EXISTS_DURATION)
        # De-assign group assignees
        GroupAssignee.objects.deassign(event.group, self.user)
        assert event.group.assignee_set.first() is None

        # Change ProjectOwnership rules
        rules = [
            Rule(Matcher("path", "src/*"), [Owner("user", user_3.email)]),
        ]
        self.prj_ownership.schema = dump_schema(rules)
        self.prj_ownership.save()

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        # Mimic filter used in get_autoassigned_owner_cached to get the issue owner to be
        # auto-assigned
        assignee = (
            GroupOwner.objects.filter()
            .exclude(user_id__isnull=True, team_id__isnull=True)
            .order_by("type")
            .first()
        )
        # Group should be re-assigned to the new group owner
        assert assignee.user_id == user_3.id

    def test_ensure_when_assignees_and_owners_are_cached_does_not_cause_unbound_errors(self):
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )

        assignee_cache_key = "assignee_exists:1:%s" % event.group.id
        owner_cache_key = "owner_exists:1:%s" % event.group.id

        for key in [assignee_cache_key, owner_cache_key]:
            cache.set(key, True)

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

    @patch("sentry.tasks.post_process.logger")
    def test_debounces_handle_owner_assignments(self, logger):
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        cache.set(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id), True, ISSUE_OWNERS_DEBOUNCE_DURATION)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        logger.info.assert_any_call(
            "handle_owner_assignment.issue_owners_exist",
            extra={
                "event": event.event_id,
                "group": event.group_id,
                "project": event.project_id,
                "organization": event.project.organization_id,
                "reason": "issue_owners_exist",
            },
        )

    @patch("sentry.tasks.post_process.logger")
    def test_issue_owners_should_ratelimit(self, logger):
        cache.set(
            f"issue_owner_assignment_ratelimiter:{self.project.id}",
            (set(range(0, ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT * 10, 10)), datetime.now()),
        )
        cache.set(f"commit-context-scm-integration:{self.project.organization_id}", True, 60)
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        logger.info.assert_any_call(
            "handle_owner_assignment.ratelimited",
            extra={
                "event": event.event_id,
                "group": event.group_id,
                "project": event.project_id,
                "organization": event.project.organization_id,
                "reason": "ratelimited",
            },
        )


class ProcessCommitsTestMixin(BasePostProgressGroupMixin):
    github_blame_return_value = {
        "commitId": "asdfwreqr",
        "committedDate": "",
        "commitMessage": "placeholder commit message",
        "commitAuthorName": "",
        "commitAuthorEmail": "admin@localhost",
    }

    def setUp(self):
        self.created_event = self.create_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(seconds=10)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "handle_set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": False,
                            "lineno": 30,
                            "filename": "sentry/tasks.py",
                        },
                        {
                            "function": "set_commits",
                            "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/release.py",
                        },
                    ]
                },
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=self.project.id,
        )
        self.cache_key = write_event_to_cache(self.created_event)
        self.repo = self.create_repo(
            name="example",
            integration_id=self.integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo, project=self.project, stack_root="src/"
        )
        self.commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )

    @with_feature("organizations:commit-context")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value=github_blame_return_value,
    )
    def test_debounce_cache_is_set(self, mock_get_commit_context):
        with self.tasks():
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=self.created_event,
            )
        assert GroupOwner.objects.get(
            group=self.created_event.group,
            project=self.created_event.project,
            organization=self.created_event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )
        assert cache.has_key(f"process-commit-context-{self.created_event.group_id}")

    @with_feature("organizations:commit-context")
    @patch(
        "sentry.integrations.github.GitHubIntegration.get_commit_context",
        return_value=github_blame_return_value,
    )
    def test_logic_fallback_no_scm(self, mock_get_commit_context):
        with in_test_psql_role_override("postgres"):
            Integration.objects.all().delete()
        integration = Integration.objects.create(provider="bitbucket")
        integration.add_organization(self.organization)
        with self.tasks():
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=self.created_event,
            )
        assert not cache.has_key(f"process-commit-context-{self.created_event.group_id}")


class SnoozeTestMixin(BasePostProgressGroupMixin):
    @with_feature("organizations:escalating-issues")
    @patch("sentry.signals.issue_escalating.send_robust")
    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processor.RuleProcessor")
    def test_invalidates_snooze(
        self, mock_processor, mock_send_unignored_robust, mock_send_escalating_robust
    ):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(hours=1))

        # Check for has_reappeared=False if is_new=True
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        GroupInbox.objects.filter(group=group).delete()  # Delete so it creates the UNIGNORED entry.
        Activity.objects.filter(group=group).delete()

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False)

        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        # Check for has_reappeared=True if is_new=False
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, False, True, True)
        mock_send_escalating_robust.assert_called_once_with(
            project=group.project,
            group=group,
            event=EventMatcher(event),
            sender=manage_issue_states,
        )
        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group = Group.objects.get(id=group.id)
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ESCALATING
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.ESCALATING.value
        ).exists()
        assert Activity.objects.filter(
            group=group, project=group.project, type=ActivityType.SET_UNRESOLVED.value
        ).exists()
        assert mock_send_unignored_robust.called

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

            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )
            assert GroupSnooze.objects.filter(id=snooze.id).exists()

            buffer.incr(Group, {"times_seen": 60}, filters={"pk": event.group.id})
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                event=event_2,
            )
            assert not GroupSnooze.objects.filter(id=snooze.id).exists()

    @patch("sentry.rules.processor.RuleProcessor")
    def test_maintains_valid_snooze(self, mock_processor):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() + timedelta(hours=1))

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False)

        assert GroupSnooze.objects.filter(id=snooze.id).exists()


@region_silo_test
class PostProcessGroupErrorTest(
    TestCase,
    AssignmentTestMixin,
    ProcessCommitsTestMixin,
    CorePostProcessGroupTestMixin,
    DeriveCodeMappingsProcessGroupTestMixin,
    InboxTestMixin,
    ResourceChangeBoundsTestMixin,
    RuleProcessorTestMixin,
    ServiceHooksTestMixin,
    SnoozeTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        return self.store_event(data=data, project_id=project_id, assert_no_errors=assert_no_errors)

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
    ):
        if cache_key is None:
            cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=cache_key,
            group_id=event.group_id,
        )
        return cache_key


@region_silo_test
class PostProcessGroupPerformanceTest(
    TestCase,
    SnubaTestCase,
    PerfIssueTransactionTestMixin,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    RuleProcessorTestMixin,
    SnoozeTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        fingerprint = data["fingerprint"][0] if data.get("fingerprint") else "some_group"
        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-{fingerprint}"
        # Store a performance event
        event = self.store_transaction(
            project_id=project_id,
            user_id="hi",
            fingerprint=[fingerprint],
        )
        return event.for_group(event.groups[0])

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
    ):
        group_states = (
            [
                {
                    "id": event.group_id,
                    "is_new": is_new,
                    "is_regression": is_regression,
                    "is_new_group_environment": is_new_group_environment,
                }
            ]
            if event.group_id
            else None
        )
        if cache_key is None:
            cache_key = write_event_to_cache(event)
        with self.feature(PerformanceNPlusOneGroupType.build_post_process_group_feature_name()):
            post_process_group(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                cache_key=cache_key,
                group_states=group_states,
            )
        return cache_key

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

    @patch("sentry.tasks.post_process.handle_owner_assignment")
    @patch("sentry.tasks.post_process.handle_auto_assignment")
    @patch("sentry.tasks.post_process.process_rules")
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
        mock_process_rules,
        mock_handle_auto_assignment,
        mock_handle_owner_assignment,
    ):
        min_ago = before_now(minutes=1).replace(tzinfo=pytz.utc)
        event = self.store_transaction(
            project_id=self.project.id,
            user_id=self.create_user(name="user1").name,
            fingerprint=[
                f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1",
                f"{PerformanceNPlusOneGroupType.type_id}-group2",
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

        # TODO(jangjodi): Fix this ordering test; side_effects should be a function (lambda),
        # but because post-processing is async, this causes the assert to fail because it doesn't
        # wait for the side effects to happen
        call_order = []
        mock_handle_owner_assignment.side_effect = call_order.append(mock_handle_owner_assignment)
        mock_handle_auto_assignment.side_effect = call_order.append(mock_handle_auto_assignment)
        mock_process_rules.side_effect = call_order.append(mock_process_rules)

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
        assert call_order == [
            mock_handle_owner_assignment,
            mock_handle_auto_assignment,
            mock_process_rules,
        ]


class TransactionClustererTestCase(TestCase, SnubaTestCase):
    @patch("sentry.ingest.transaction_clusterer.datasource.redis._store_transaction_name")
    def test_process_transaction_event_clusterer(
        self,
        mock_store_transaction_name,
    ):
        min_ago = before_now(minutes=1).replace(tzinfo=pytz.utc)
        event = process_event(
            data={
                "project": self.project.id,
                "event_id": "b" * 32,
                "transaction": "foo",
                "start_timestamp": str(min_ago),
                "timestamp": str(min_ago),
                "type": "transaction",
                "transaction_info": {
                    "source": "url",
                },
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            group_id=0,
        )
        cache_key = write_event_to_cache(event)
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key=cache_key,
            group_id=None,
            group_states=None,
        )

        assert mock_store_transaction_name.mock_calls == [mock.call(self.project, "foo")]


@region_silo_test
class PostProcessGroupGenericTest(
    TestCase,
    SnubaTestCase,
    OccurrenceTestMixin,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    RuleProcessorTestMixin,
    SnoozeTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        data["type"] = "generic"
        event = self.store_event(
            data=data, project_id=project_id, assert_no_errors=assert_no_errors
        )

        occurrence_data = self.build_occurrence_data(event_id=event.event_id, project_id=project_id)
        occurrence, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None

        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence
        return group_event

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
    ):
        with self.feature(ProfileFileIOGroupType.build_post_process_group_feature_name()):
            post_process_group(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                cache_key=None,
                group_id=event.group_id,
                occurrence_id=event.occurrence.id,
                project_id=event.group.project_id,
            )
        return cache_key

    def test_issueless(self):
        # Skip this test since there's no way to have issueless events in the issue platform
        pass

    def test_no_cache_abort(self):
        # We don't use the cache for generic issues, so skip this test
        pass

    @patch("sentry.rules.processor.RuleProcessor")
    def test_occurrence_deduping(self, mock_processor):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )
        assert mock_processor.call_count == 1
        mock_processor.assert_called_with(EventMatcher(event), True, True, False, False)

        # Calling this again should do nothing, since we've already processed this occurrence.
        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )

        # Make sure we haven't called this again, since we should exit early.
        assert mock_processor.call_count == 1
