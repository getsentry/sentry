from __future__ import annotations

import abc
import time
import uuid
from datetime import datetime, timedelta
from hashlib import md5
from typing import Any
from unittest import mock
from unittest.mock import Mock, patch

import pytest
from django.db import router
from django.test import override_settings
from django.utils import timezone

from sentry import buffer
from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.eventstream.types import EventStreamEventType
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource
from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.commit_context import CommitInfo, FileBlameInfo
from sentry.issues.grouptype import (
    FeedbackGroup,
    GroupCategory,
    PerformanceNPlusOneGroupType,
    PerformanceP95EndpointRegressionGroupType,
    ProfileFileIOGroupType,
)
from sentry.issues.ingest import save_issue_occurrence
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.environment import Environment
from sentry.models.group import GROUP_SUBSTATUS_TO_STATUS_MAP, Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupinbox import GroupInbox, GroupInboxReason
from sentry.models.groupowner import (
    ASSIGNEE_EXISTS_DURATION,
    ASSIGNEE_EXISTS_KEY,
    ISSUE_OWNERS_DEBOUNCE_DURATION,
    ISSUE_OWNERS_DEBOUNCE_KEY,
    GroupOwner,
    GroupOwnerType,
)
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.organization import Organization
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectteam import ProjectTeam
from sentry.models.userreport import UserReport
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.replays.lib import kafka as replays_kafka
from sentry.replays.lib.kafka import clear_replay_publisher
from sentry.rules import init_registry
from sentry.rules.actions.base import EventAction
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.tasks.derive_code_mappings import SUPPORTED_LANGUAGES
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import (
    HIGHER_ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT,
    ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT,
    _get_event_id_from_cache_key,
    feedback_filter_decorator,
    locks,
    post_process_group,
    process_event,
    run_post_process_job,
)
from sentry.testutils.cases import BaseTestCase, PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.testutils.performance_issues.store_transaction import store_transaction
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel
from sentry.uptime.detectors.ranking import _get_cluster, get_organization_bucket_key
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.cache import cache
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SdkName
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


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
    @patch("sentry.rules.processing.processor.RuleProcessor")
    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    @patch("sentry.signals.event_processed.send_robust")
    def test_issueless(
        self,
        mock_signal,
        mock_process_resource_change_bound,
        mock_process_service_hook,
        mock_processor,
    ):
        min_ago = before_now(minutes=1).isoformat()
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

    @patch("sentry.rules.processing.processor.RuleProcessor")
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

    @patch("sentry.utils.metrics.timing")
    @patch("sentry.tasks.post_process.logger")
    def test_time_to_process_metric(self, logger_mock, metric_timing_mock):
        event = self.create_event(data={}, project_id=self.project.id)
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        metric_timing_mock.assert_any_call(
            "events.time-to-post-process",
            mock.ANY,
            instance=mock.ANY,
            tags={"occurrence_type": mock.ANY},
        )
        assert "tasks.post_process.old_time_to_post_process" not in [
            args[0] for args in logger_mock.warning.call_args_list
        ]


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
    @patch("sentry.rules.processing.processor.RuleProcessor")
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

        mock_processor.assert_called_once_with(EventMatcher(event), True, False, True, False, False)
        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    @patch("sentry.rules.processing.processor.RuleProcessor")
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

        mock_processor.return_value.apply.assert_called_once_with()

        mock_callback.assert_called_once_with(EventMatcher(event), mock_futures)

    @mock_redis_buffer()
    def test_rule_processor_buffer_values(self):
        # Test that pending buffer values for `times_seen` are applied to the group and that alerts
        # fire as expected
        from sentry.models.rule import Rule

        MOCK_RULES = ("sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",)

        with (
            mock.patch("sentry.buffer.backend.get", buffer.backend.get),
            mock.patch("sentry.buffer.backend.incr", buffer.backend.incr),
            patch("sentry.constants._SENTRY_RULES", MOCK_RULES),
            patch("sentry.rules.rules", init_registry()) as rules,
        ):
            MockAction = mock.Mock()
            MockAction.id = "tests.sentry.tasks.post_process.tests.MockAction"
            MockAction.return_value = mock.Mock(spec=EventAction)
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

            buffer.backend.incr(Group, {"times_seen": 15}, filters={"id": event.group.id})
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event_2,
            )
            assert MockAction.return_value.after.call_count == 1

    @patch("sentry.rules.processing.processor.RuleProcessor")
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
            EventMatcher(event, group=group2), True, False, True, False, False
        )

    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_group_last_seen_buffer(self, mock_processor):
        first_event_date = timezone.now() - timedelta(days=90)
        event1 = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )
        group1 = event1.group
        group1.update(last_seen=first_event_date)

        event2 = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        # Mock set the last_seen value to the first event date
        # To simulate the update to last_seen being buffered
        event2.group.last_seen = first_event_date
        event2.group.update(last_seen=first_event_date)
        assert event2.group_id == group1.id

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            event=event2,
        )
        mock_processor.assert_called_with(
            EventMatcher(event2, group=group1), False, True, False, False, False
        )
        sent_group_date: datetime = mock_processor.call_args[0][0].group.last_seen
        # Check that last_seen was updated to be at least the new event's date
        assert abs(sent_group_date - event2.datetime) < timedelta(seconds=10)


class ServiceHooksTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
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

    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    @patch("sentry.rules.processing.processor.RuleProcessor")
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

    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    @patch("sentry.rules.processing.processor.RuleProcessor")
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

    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
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
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
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
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_error_events(self, delay):
        event = self.create_event(
            data={
                "message": "Foo bar",
                "exception": {"type": "Foo", "value": "oh no"},
                "level": "error",
                "timestamp": timezone.now().isoformat(),
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
            group_id=event.group_id,
            project_id=self.project.id,
        )

    @with_feature("organizations:integrations-event-hooks")
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_for_non_errors(self, delay):
        event = self.create_event(
            data={
                "message": "Foo bar",
                "level": "info",
                "timestamp": timezone.now().isoformat(),
            },
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

    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_feature_flag(self, delay):
        event = self.create_event(
            data={
                "message": "Foo bar",
                "level": "info",
                "timestamp": timezone.now().isoformat(),
            },
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
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_not_called_without_error_created(self, delay):
        event = self.create_event(
            data={
                "message": "Foo bar",
                "level": "error",
                "exception": {"type": "Foo", "value": "oh no"},
                "timestamp": timezone.now().isoformat(),
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
    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_group_inbox_regression(self, mock_processor):
        new_event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        group = new_event.group
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.NEW

        self.call_post_process_group(
            is_new=True,
            is_regression=True,
            is_new_group_environment=False,
            event=new_event,
        )
        assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        GroupInbox.objects.filter(
            group=group
        ).delete()  # Delete so it creates the .REGRESSION entry.
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.NEW

        mock_processor.assert_called_with(EventMatcher(new_event), True, True, False, False, False)

        # resolve the new issue so regression actually happens
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.active_at = group.active_at - timedelta(minutes=1)
        group.save(update_fields=["status", "substatus", "active_at"])

        # trigger a transition from resolved to regressed by firing an event that groups to that issue
        regressed_event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        assert regressed_event.group == new_event.group

        group = regressed_event.group
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.REGRESSED
        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            event=regressed_event,
        )

        mock_processor.assert_called_with(
            EventMatcher(regressed_event), False, True, False, False, False
        )
        group.refresh_from_db()
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
        activity = Activity.objects.get(group=event.group)
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
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/things/in/a/path/example2.py"}]},
            },
            project_id=self.project.id,
        )

        committer = GroupOwner(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
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
                "stacktrace": {"frames": [{"filename": "src/app/example.py", "in_app": True}]},
            },
            project_id=self.project.id,
        )
        event_2 = self.create_event(
            data={
                "message": "Exception",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/integration.py", "in_app": True}]},
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
            .order_by("type")[0]
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
            GroupOwner.objects.filter().exclude(user_id__isnull=True, team_id__isnull=True).get()
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

    def test_auto_assignment_when_owners_are_invalid(self):
        """
        Test that invalid group owners (that exist due to bugs) are deleted and not assigned
        when no valid issue owner exists
        """
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )
        # Hard code an invalid group owner
        invalid_codeowner = GroupOwner(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.CODEOWNERS.value,
            context={"rule": "codeowners:/**/*.css " + self.user.email},
            user_id=self.user.id,
        )
        invalid_codeowner.save()

        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assignee = event.group.assignee_set.first()
        assert assignee is None
        assert len(GroupOwner.objects.filter(group_id=event.group)) == 0

    @patch("sentry.utils.metrics.incr")
    def test_debounces_handle_owner_assignments(self, mock_incr):
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
        mock_incr.assert_any_call("sentry.tasks.post_process.handle_owner_assignment.debounce")

    @patch("sentry.utils.metrics.incr")
    def test_issue_owners_should_ratelimit(self, mock_incr):
        cache.set(
            f"issue_owner_assignment_ratelimiter:{self.project.id}",
            (set(range(0, ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT * 10, 10)), datetime.now()),
        )
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
        mock_incr.assert_any_call("sentry.task.post_process.handle_owner_assignment.ratelimited")
        mock_incr.reset_mock()

        # Raise this organization's ratelimit
        with self.feature("organizations:increased-issue-owners-rate-limit"):
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )
            with pytest.raises(AssertionError):
                mock_incr.assert_any_call(
                    "sentry.task.post_process.handle_owner_assignment.ratelimited"
                )
        mock_incr.reset_mock()
        cache.set(
            f"issue_owner_assignment_ratelimiter:{self.project.id}",
            (
                set(range(0, HIGHER_ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT * 10, 10)),
                datetime.now(),
            ),
        )
        with self.feature("organizations:increased-issue-owners-rate-limit"):
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )
            mock_incr.assert_any_call(
                "sentry.task.post_process.handle_owner_assignment.ratelimited"
            )


class ProcessCommitsTestMixin(BasePostProgressGroupMixin):
    github_blame_return_value = {
        "commitId": "asdfwreqr",
        "committedDate": (timezone.now() - timedelta(days=2)),
        "commitMessage": "placeholder commit message",
        "commitAuthorName": "",
        "commitAuthorEmail": "admin@localhost",
    }

    def setUp(self):
        self.created_event = self.create_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": before_now(seconds=10).isoformat(),
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
            name="org/example", integration_id=self.integration.id, provider="integrations:github"
        )
        self.code_mapping = self.create_code_mapping(
            repo=self.repo, project=self.project, stack_root="sentry/", source_root="sentry/"
        )
        self.commit_author = self.create_commit_author(project=self.project, user=self.user)
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.commit_author,
            key="asdfwreqr",
            message="placeholder commit message",
        )

        self.github_blame_all_files_return_value = [
            FileBlameInfo(
                code_mapping=self.code_mapping,
                lineno=39,
                path="sentry/models/release.py",
                ref="master",
                repo=self.repo,
                commit=CommitInfo(
                    commitId="asdfwreqr",
                    committedDate=(timezone.now() - timedelta(days=2)),
                    commitMessage="placeholder commit message",
                    commitAuthorName="",
                    commitAuthorEmail="admin@localhost",
                ),
            )
        ]

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
        return_value=github_blame_return_value,
    )
    def test_logic_fallback_no_scm(self, mock_get_commit_context):
        with assume_test_silo_mode(SiloMode.CONTROL):
            with unguarded_write(using=router.db_for_write(Integration)):
                Integration.objects.all().delete()
            integration = self.create_provider_integration(provider="bitbucket")
            integration.add_organization(self.organization)

        with self.tasks():
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=self.created_event,
            )

        assert not mock_get_commit_context.called

    @patch(
        "sentry.integrations.github_enterprise.integration.GitHubEnterpriseIntegration.get_commit_context_all_frames",
    )
    def test_github_enterprise(self, mock_get_commit_context):
        mock_get_commit_context.return_value = self.github_blame_all_files_return_value
        with assume_test_silo_mode(SiloMode.CONTROL):
            with unguarded_write(using=router.db_for_write(Integration)):
                Integration.objects.all().delete()
            integration = self.create_provider_integration(
                external_id="35.232.149.196:12345",
                provider="github_enterprise",
                metadata={
                    "domain_name": "35.232.149.196/baxterthehacker",
                    "installation_id": "12345",
                    "installation": {"id": "2", "private_key": "private_key", "verify_ssl": True},
                },
            )
            organization_integration = integration.add_organization(self.organization)
        assert organization_integration is not None

        self.repo.update(integration_id=integration.id, provider="integrations:github_enterprise")
        self.code_mapping.update(organization_integration_id=organization_integration.id)

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

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames")
    def test_skip_when_not_is_new(self, mock_get_commit_context):
        """
        Tests that we do not process commit context if the group isn't new.
        """
        with self.tasks():
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                event=self.created_event,
            )
        assert not mock_get_commit_context.called
        assert not GroupOwner.objects.filter(
            group=self.created_event.group,
            project=self.created_event.project,
            organization=self.created_event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        ).exists()

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_commit_context_all_frames",
    )
    def test_does_not_skip_when_is_new(self, mock_get_commit_context):
        """
        Tests that the commit context should be processed when the group is new.
        """
        mock_get_commit_context.return_value = self.github_blame_all_files_return_value
        with self.tasks():
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=self.created_event,
            )
        assert mock_get_commit_context.called
        assert GroupOwner.objects.get(
            group=self.created_event.group,
            project=self.created_event.project,
            organization=self.created_event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
        )


class SnoozeTestSkipSnoozeMixin(BasePostProgressGroupMixin):
    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_invalidates_snooze_issue_platform(self, mock_processor, mock_send_unignored_robust):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group = event.group
        should_detect_escalation = group.issue_type.should_detect_escalation()

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
        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False, False)

        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group.status = GroupStatus.IGNORED
        group.substatus = GroupSubStatus.UNTIL_CONDITION_MET
        group.save(update_fields=["status", "substatus"])
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(hours=1))

        # Check for has_reappeared=True if is_new=False
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        mock_processor.assert_called_with(EventMatcher(event), False, False, True, True, False)

        if should_detect_escalation:
            assert not GroupSnooze.objects.filter(id=snooze.id).exists()
        else:
            assert GroupSnooze.objects.filter(id=snooze.id).exists()

        group.refresh_from_db()
        if should_detect_escalation:
            assert group.status == GroupStatus.UNRESOLVED
            assert group.substatus == GroupSubStatus.ONGOING
            assert GroupInbox.objects.filter(
                group=group, reason=GroupInboxReason.ONGOING.value
            ).exists()
            assert Activity.objects.filter(
                group=group, project=group.project, type=ActivityType.SET_UNRESOLVED.value
            ).exists()
            assert mock_send_unignored_robust.called
        else:
            assert group.status == GroupStatus.IGNORED
            assert group.substatus == GroupSubStatus.UNTIL_CONDITION_MET
            assert not GroupInbox.objects.filter(
                group=group, reason=GroupInboxReason.ESCALATING.value
            ).exists()
            assert not Activity.objects.filter(
                group=group, project=group.project, type=ActivityType.SET_ESCALATING.value
            ).exists()
            assert not mock_send_unignored_robust.called


class SnoozeTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_invalidates_snooze(self, mock_processor, mock_send_unignored_robust):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        group = event.group

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

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False, False)

        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group.status = GroupStatus.IGNORED
        group.substatus = GroupSubStatus.UNTIL_CONDITION_MET
        group.save(update_fields=["status", "substatus"])
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() - timedelta(hours=1))

        # Check for has_reappeared=True if is_new=False
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_processor.assert_called_with(EventMatcher(event), False, False, True, True, False)
        assert not GroupSnooze.objects.filter(id=snooze.id).exists()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.ONGOING.value
        ).exists()
        assert Activity.objects.filter(
            group=group, project=group.project, type=ActivityType.SET_UNRESOLVED.value
        ).exists()
        assert mock_send_unignored_robust.called

    @mock_redis_buffer()
    @override_settings(SENTRY_BUFFER="sentry.buffer.redis.RedisBuffer")
    @patch("sentry.signals.issue_unignored.send_robust")
    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_invalidates_snooze_with_buffers(self, mock_processor, send_robust):
        with (
            mock.patch("sentry.buffer.backend.get", buffer.backend.get),
            mock.patch("sentry.buffer.backend.incr", buffer.backend.incr),
        ):
            event = self.create_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            event_2 = self.create_event(
                data={"message": "testing", "fingerprint": ["group-1"]}, project_id=self.project.id
            )
            group = event.group
            group.times_seen = 50
            group.status = GroupStatus.IGNORED
            group.substatus = GroupSubStatus.UNTIL_CONDITION_MET
            group.save(update_fields=["times_seen", "status", "substatus"])
            snooze = GroupSnooze.objects.create(group=group, count=100, state={"times_seen": 0})

            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )
            assert GroupSnooze.objects.filter(id=snooze.id).exists()

            buffer.backend.incr(Group, {"times_seen": 60}, filters={"id": event.group.id})
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=True,
                event=event_2,
            )
            assert not GroupSnooze.objects.filter(id=snooze.id).exists()

    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_maintains_valid_snooze(self, mock_processor):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.NEW
        snooze = GroupSnooze.objects.create(group=group, until=timezone.now() + timedelta(hours=1))

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_processor.assert_called_with(EventMatcher(event), True, False, True, False, False)

        assert GroupSnooze.objects.filter(id=snooze.id).exists()
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.NEW

    @patch("sentry.issues.escalating.is_escalating", return_value=(True, 0))
    def test_forecast_in_activity(self, mock_is_escalating):
        """
        Test that the forecast is added to the activity for escalating issues that were
        previously ignored until_escalating.
        """
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group = event.group
        group.update(
            first_seen=timezone.now() - timedelta(days=1),
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        assert Activity.objects.filter(
            group=group,
            project=group.project,
            type=ActivityType.SET_ESCALATING.value,
            data={"event_id": event.event_id, "forecast": 0},
        ).exists()

    @patch("sentry.issues.escalating.is_escalating")
    def test_skip_escalation_logic_for_new_groups(self, mock_is_escalating):
        """
        Test that we skip checking escalation in the process_snoozes job if the group is less than
        a day old.
        """
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group = event.group
        group.status = GroupStatus.IGNORED
        group.substatus = GroupSubStatus.UNTIL_ESCALATING
        group.update(first_seen=timezone.now() - timedelta(hours=1))
        group.save()
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_is_escalating.assert_not_called()


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection")
class SDKCrashMonitoringTestMixin(BasePostProgressGroupMixin):
    @with_feature("organizations:sdk-crash-detection")
    @override_options(
        {
            "issues.sdk_crash_detection.cocoa.project_id": 1234,
            "issues.sdk_crash_detection.cocoa.sample_rate": 1.0,
            "issues.sdk_crash_detection.react-native.project_id": 12345,
            "issues.sdk_crash_detection.react-native.sample_rate": 1.0,
            "issues.sdk_crash_detection.react-native.organization_allowlist": [1],
        }
    )
    def test_sdk_crash_monitoring_is_called(self, mock_sdk_crash_detection):
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_sdk_crash_detection.detect_sdk_crash.assert_called_once()

        args = mock_sdk_crash_detection.detect_sdk_crash.call_args[-1]
        assert args["event"].project.id == event.project.id

        assert len(args["configs"]) == 2
        cocoa_config = args["configs"][0]
        assert cocoa_config.sdk_name == SdkName.Cocoa
        assert cocoa_config.project_id == 1234
        assert cocoa_config.sample_rate == 1.0
        assert cocoa_config.organization_allowlist == []

        react_native_config = args["configs"][1]
        assert react_native_config.sdk_name == SdkName.ReactNative
        assert react_native_config.project_id == 12345
        assert react_native_config.sample_rate == 1.0
        assert react_native_config.organization_allowlist == [1]

    @with_feature("organizations:sdk-crash-detection")
    @override_options(
        {
            "issues.sdk_crash_detection.cocoa.project_id": 1234,
            "issues.sdk_crash_detection.cocoa.sample_rate": 0.0,
        }
    )
    def test_sdk_crash_monitoring_not_called_without_sample_rate(self, mock_sdk_crash_detection):
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_sdk_crash_detection.detect_sdk_crash.assert_not_called()

    def test_sdk_crash_monitoring_is_not_called_with_disabled_feature(
        self, mock_sdk_crash_detection
    ):
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_sdk_crash_detection.detect_sdk_crash.assert_not_called()

    @override_options(
        {
            "issues.sdk_crash_detection.cocoa.project_id": None,
        }
    )
    @with_feature("organizations:sdk-crash-detection")
    def test_sdk_crash_monitoring_is_not_called_without_project_id(self, mock_sdk_crash_detection):
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_sdk_crash_detection.detect_sdk_crash.assert_not_called()


@mock.patch.object(replays_kafka, "get_kafka_producer_cluster_options")
@mock.patch.object(replays_kafka, "KafkaPublisher")
@mock.patch("sentry.utils.metrics.incr")
class ReplayLinkageTestMixin(BasePostProgressGroupMixin):
    def test_replay_linkage(self, incr, kafka_producer, kafka_publisher):
        replay_id = uuid.uuid4().hex
        event = self.create_event(
            data={"message": "testing", "contexts": {"replay": {"replay_id": replay_id}}},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert kafka_producer.return_value.publish.call_count == 1
        assert kafka_producer.return_value.publish.call_args[0][0] == "ingest-replay-events"

        ret_value = json.loads(kafka_producer.return_value.publish.call_args[0][1])

        assert ret_value["type"] == "replay_event"
        assert ret_value["start_time"]
        assert ret_value["replay_id"] == replay_id
        assert ret_value["project_id"] == self.project.id
        assert ret_value["segment_id"] is None
        assert ret_value["retention_days"] == 90
        assert ret_value["payload"] == {
            "type": "event_link",
            "replay_id": replay_id,
            "error_id": event.event_id,
            "timestamp": int(event.datetime.timestamp()),
            "event_hash": str(uuid.UUID(md5((event.event_id).encode("utf-8")).hexdigest())),
        }

        incr.assert_any_call("post_process.process_replay_link.id_sampled")
        incr.assert_any_call("post_process.process_replay_link.id_exists")

    def test_replay_linkage_with_tag(self, incr, kafka_producer, kafka_publisher):
        replay_id = uuid.uuid4().hex
        event = self.create_event(
            data={"message": "testing", "tags": {"replayId": replay_id}},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert kafka_producer.return_value.publish.call_count == 1
        assert kafka_producer.return_value.publish.call_args[0][0] == "ingest-replay-events"

        ret_value = json.loads(kafka_producer.return_value.publish.call_args[0][1])

        assert ret_value["type"] == "replay_event"
        assert ret_value["start_time"]
        assert ret_value["replay_id"] == replay_id
        assert ret_value["project_id"] == self.project.id
        assert ret_value["segment_id"] is None
        assert ret_value["retention_days"] == 90
        assert ret_value["payload"] == {
            "type": "event_link",
            "replay_id": replay_id,
            "error_id": event.event_id,
            "timestamp": int(event.datetime.timestamp()),
            "event_hash": str(uuid.UUID(md5((event.event_id).encode("utf-8")).hexdigest())),
        }

        incr.assert_any_call("post_process.process_replay_link.id_sampled")
        incr.assert_any_call("post_process.process_replay_link.id_exists")

    def test_replay_linkage_with_tag_pii_scrubbed(self, incr, kafka_producer, kafka_publisher):
        event = self.create_event(
            data={"message": "testing", "tags": {"replayId": "***"}},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert kafka_producer.return_value.publish.call_count == 0

    def test_no_replay(self, incr, kafka_producer, kafka_publisher):
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert kafka_producer.return_value.publish.call_count == 0
        incr.assert_any_call("post_process.process_replay_link.id_sampled")


class UserReportEventLinkTestMixin(BasePostProgressGroupMixin):
    def test_user_report_gets_environment(self):
        project = self.create_project()
        environment = Environment.objects.create(
            organization_id=project.organization_id, name="production"
        )
        environment.add_project(project)

        event_id = "a" * 32

        event = self.create_event(
            data={"environment": environment.name, "event_id": event_id},
            project_id=project.id,
        )
        UserReport.objects.create(
            project_id=project.id,
            event_id=event_id,
            name="foo",
            email="bar@example.com",
            comments="It Broke!!!",
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert UserReport.objects.get(event_id=event_id).environment_id == environment.id

    def test_user_report_gets_environment_with_new_link_features(self):
        with self.feature("organizations:user-feedback-event-link-ingestion-changes"):
            project = self.create_project()
            environment = Environment.objects.create(
                organization_id=project.organization_id, name="production"
            )
            environment.add_project(project)

            event_id = "a" * 32
            event = self.store_event(
                data={"environment": environment.name, "event_id": event_id},
                project_id=project.id,
            )
            UserReport.objects.create(
                project_id=project.id,
                event_id=event_id,
                name="foo",
                email="bar@example.com",
                comments="It Broke!!!",
            )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        assert UserReport.objects.get(event_id=event_id).environment_id == environment.id

    @patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_user_report_shims_to_feedback(self, mock_produce_occurrence_to_kafka):
        with self.feature("organizations:user-feedback-event-link-ingestion-changes"):
            project = self.create_project()
            environment = Environment.objects.create(
                organization_id=project.organization_id, name="production"
            )
            environment.add_project(project)

            event_id = "a" * 32

            UserReport.objects.create(
                project_id=project.id,
                event_id=event_id,
                name="Foo Bar",
                email="bar@example.com",
                comments="It Broke!!!",
            )

            event = self.store_event(
                data={"environment": environment.name, "event_id": event_id},
                project_id=project.id,
            )

            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )

            report1 = UserReport.objects.get(project_id=project.id, event_id=event.event_id)
            assert report1.group_id == event.group_id
            assert report1.environment_id == event.get_environment().id

            assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
            mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]

            assert mock_event_data["contexts"]["feedback"]["contact_email"] == "bar@example.com"
            assert mock_event_data["contexts"]["feedback"]["message"] == "It Broke!!!"
            assert mock_event_data["contexts"]["feedback"]["name"] == "Foo Bar"
            assert mock_event_data["environment"] == environment.name
            assert mock_event_data["tags"]["environment"] == environment.name
            assert mock_event_data["tags"]["level"] == "error"
            assert mock_event_data["tags"]["user.email"] == "bar@example.com"

            assert mock_event_data["platform"] == "other"
            assert mock_event_data["contexts"]["feedback"]["associated_event_id"] == event.event_id
            assert mock_event_data["level"] == "error"

    @patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_user_reports_no_shim_if_group_exists_on_report(self, mock_produce_occurrence_to_kafka):
        with self.feature("organizations:user-feedback-event-link-ingestion-changes"):
            project = self.create_project()
            environment = Environment.objects.create(
                organization_id=project.organization_id, name="production"
            )
            environment.add_project(project)

            event_id = "a" * 32

            UserReport.objects.create(
                project_id=project.id,
                event_id=event_id,
                name="Foo Bar",
                email="bar@example.com",
                comments="It Broke!!!",
                environment_id=environment.id,
            )

            event = self.store_event(
                data={"environment": environment.name, "event_id": event_id},
                project_id=project.id,
            )

            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )

            # since the environment already exists on this user report, we know that
            # the report and the event have already been linked, so no feedback shim should be produced
            report1 = UserReport.objects.get(project_id=project.id, event_id=event.event_id)
            assert report1.environment_id == event.get_environment().id
            assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0


class DetectBaseUrlsForUptimeTestMixin(BasePostProgressGroupMixin):
    def assert_organization_key(self, organization: Organization, exists: bool) -> None:
        key = get_organization_bucket_key(organization)
        cluster = _get_cluster()
        assert exists == cluster.sismember(key, str(organization.id))

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test_uptime_detection_feature_url(self):
        event = self.create_event(
            data={"request": {"url": "http://sentry.io"}},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        self.assert_organization_key(self.organization, True)

    @with_feature("organizations:uptime-automatic-hostname-detection")
    def test_uptime_detection_feature_no_url(self):
        event = self.create_event(
            data={},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        self.assert_organization_key(self.organization, False)

    def test_uptime_detection_no_feature(self):
        event = self.create_event(
            data={"request": {"url": "http://sentry.io"}},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        self.assert_organization_key(self.organization, False)


class DetectNewEscalationTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated(self, mock_run_post_process_job):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(
            first_seen=timezone.now() - timedelta(hours=1),
            times_seen=10,
            priority=PriorityLevel.LOW,
        )
        event.group = Group.objects.get(id=group.id)

        with patch("sentry.issues.issue_velocity.calculate_threshold", return_value=9):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )
        job = mock_run_post_process_job.call_args[0][0]
        assert job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.ESCALATING
        assert group.priority == PriorityLevel.MEDIUM

    @patch("sentry.issues.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated_old(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(first_seen=timezone.now() - timedelta(days=2), times_seen=10000)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        mock_threshold.assert_not_called()
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.NEW
        assert group.priority == PriorityLevel.HIGH

    @patch("sentry.issues.issue_velocity.get_latest_threshold", return_value=11)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_not_escalated(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(
            first_seen=timezone.now() - timedelta(hours=1),
            times_seen=10,
            priority=PriorityLevel.LOW,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        mock_threshold.assert_called()
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.NEW
        assert group.priority == PriorityLevel.LOW

    @patch("sentry.issues.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated_locked(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(first_seen=timezone.now() - timedelta(hours=1), times_seen=10000)
        lock = locks.get(f"detect_escalation:{group.id}", duration=10, name="detect_escalation")
        with lock.acquire():
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )
        mock_threshold.assert_not_called()
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.NEW

    @patch("sentry.issues.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated_already_escalated(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        group.update(
            first_seen=timezone.now() - timedelta(hours=1),
            times_seen=10000,
            substatus=GroupSubStatus.ESCALATING,
            priority=PriorityLevel.MEDIUM,
        )
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        mock_threshold.assert_not_called()
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.ESCALATING
        assert group.priority == PriorityLevel.MEDIUM

    @patch("sentry.issues.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_does_not_escalate_non_new_substatus(self, mock_run_post_process_job, mock_threshold):
        for substatus, status in GROUP_SUBSTATUS_TO_STATUS_MAP.items():
            if substatus == GroupSubStatus.NEW:
                continue
            event = self.create_event(data={}, project_id=self.project.id)
            group = event.group
            group.update(
                first_seen=timezone.now() - timedelta(hours=1),
                times_seen=10000,
                status=status,
                substatus=substatus,
            )
            group.save()

            self.call_post_process_group(
                is_new=False,  # when true, post_process sets the substatus to NEW
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )
            mock_threshold.assert_not_called()
            job = mock_run_post_process_job.call_args[0][0]
            assert not job["has_escalated"]
            group.refresh_from_db()
            assert group.substatus == substatus

    @patch("sentry.issues.issue_velocity.get_latest_threshold", return_value=8)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_no_escalation_less_than_floor(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(first_seen=timezone.now() - timedelta(hours=1), times_seen=9)
        event.group = Group.objects.get(id=group.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        mock_threshold.assert_not_called()
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.NEW

    @patch("sentry.issues.issue_velocity.get_latest_threshold", return_value=11)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_not_escalated_less_than_an_hour(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        # the group is less than an hour old, but we use 1 hr for the hourly event rate anyway
        group.update(first_seen=timezone.now() - timedelta(minutes=1), times_seen=10)
        event.group = Group.objects.get(id=group.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.NEW

    @patch("sentry.issues.issue_velocity.get_latest_threshold", return_value=0)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_zero_escalation_rate(self, mock_run_post_process_job, mock_threshold):
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(first_seen=timezone.now() - timedelta(hours=1), times_seen=10000)
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        mock_threshold.assert_called()
        job = mock_run_post_process_job.call_args[0][0]
        assert not job["has_escalated"]
        group.refresh_from_db()
        assert group.substatus == GroupSubStatus.NEW


class ProcessSimilarityTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.post_process.safe_execute")
    def test_process_similarity(self, mock_safe_execute):
        from sentry import similarity

        event = self.create_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        mock_safe_execute.assert_called_with(similarity.record, mock.ANY, mock.ANY)

    def assert_not_called_with(self, mock_function: Mock):
        """
        Helper function to check that safe_execute isn't called with similarity.record
        It can/will be called with other parameters
        """
        from sentry import similarity

        try:
            mock_function.assert_called_with(similarity.record, mock.ANY, mock.ANY)
        except AssertionError:
            return
        raise AssertionError("Expected safe_execute to not be called with similarity.record")

    @patch("sentry.tasks.post_process.safe_execute")
    def test_skip_process_similarity(self, mock_safe_execute):
        self.project.update_option("sentry:similarity_backfill_completed", int(time.time()))
        event = self.create_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        self.assert_not_called_with(mock_safe_execute)


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
    SnoozeTestSkipSnoozeMixin,
    SDKCrashMonitoringTestMixin,
    ReplayLinkageTestMixin,
    DetectNewEscalationTestMixin,
    UserReportEventLinkTestMixin,
    DetectBaseUrlsForUptimeTestMixin,
    ProcessSimilarityTestMixin,
):
    def setUp(self):
        super().setUp()
        clear_replay_publisher()

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
            project_id=event.project_id,
            eventstream_type=EventStreamEventType.Error,
        )
        return cache_key

    @with_feature("organizations:escalating-metrics-backend")
    @patch("sentry.sentry_metrics.client.generic_metrics_backend.counter")
    @patch("sentry.utils.metrics.incr")
    @patch("sentry.utils.metrics.timer")
    def test_generic_metrics_backend_counter(
        self, metric_timer_mock, metric_incr_mock, generic_metrics_backend_mock
    ):
        min_ago = before_now(minutes=1).isoformat()
        event = self.create_event(
            data={
                "exception": {
                    "values": [
                        {
                            "type": "ZeroDivisionError",
                            "stacktrace": {"frames": [{"function": f} for f in ["a", "b"]]},
                        }
                    ]
                },
                "timestamp": min_ago,
                "start_timestamp": min_ago,
                "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            },
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True, is_regression=False, is_new_group_environment=True, event=event
        )

        assert generic_metrics_backend_mock.call_count == 1
        metric_incr_mock.assert_any_call(
            "sentry.tasks.post_process.post_process_group.completed",
            tags={"issue_category": "error", "pipeline": "process_rules"},
        )
        metric_timer_mock.assert_any_call(
            "tasks.post_process.run_post_process_job.pipeline.duration",
            tags={
                "pipeline": "process_rules",
                "issue_category": "error",
                "is_reprocessed": False,
            },
        )


class PostProcessGroupPerformanceTest(
    TestCase,
    SnubaTestCase,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    RuleProcessorTestMixin,
    SnoozeTestMixin,
    SnoozeTestSkipSnoozeMixin,
    PerformanceIssueTestCase,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        fingerprint = data["fingerprint"][0] if data.get("fingerprint") else "some_group"
        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-{fingerprint}"
        return self.create_performance_issue(fingerprint=fingerprint)

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
    ):
        if cache_key is None:
            cache_key = write_event_to_cache(event)
        with self.feature(PerformanceNPlusOneGroupType.build_post_process_group_feature_name()):
            post_process_group(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                cache_key=cache_key,
                group_id=event.group_id,
                project_id=event.project_id,
                eventstream_type=EventStreamEventType.Error,
            )
        return cache_key

    @patch("sentry.sentry_metrics.client.generic_metrics_backend.counter")
    @patch("sentry.tasks.post_process.run_post_process_job")
    @patch("sentry.rules.processing.processor.RuleProcessor")
    @patch("sentry.signals.transaction_processed.send_robust")
    @patch("sentry.signals.event_processed.send_robust")
    def test_process_transaction_event_with_no_group(
        self,
        event_processed_signal_mock,
        transaction_processed_signal_mock,
        mock_processor,
        run_post_process_job_mock,
        generic_metrics_backend_mock,
    ):
        min_ago = before_now(minutes=1)
        event = store_transaction(
            test_case=self,
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
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Transaction,
        )

        assert transaction_processed_signal_mock.call_count == 1
        assert event_processed_signal_mock.call_count == 0
        assert mock_processor.call_count == 0
        assert run_post_process_job_mock.call_count == 0
        assert generic_metrics_backend_mock.call_count == 0

    @patch("sentry.tasks.post_process.handle_owner_assignment")
    @patch("sentry.tasks.post_process.handle_auto_assignment")
    @patch("sentry.tasks.post_process.process_rules")
    @patch("sentry.tasks.post_process.run_post_process_job")
    @patch("sentry.rules.processing.processor.RuleProcessor")
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
        event = self.create_performance_issue()
        assert event.group

        # TODO(jangjodi): Fix this ordering test; side_effects should be a function (lambda),
        # but because post-processing is async, this causes the assert to fail because it doesn't
        # wait for the side effects to happen
        call_order = [mock_handle_owner_assignment, mock_handle_auto_assignment, mock_process_rules]
        mock_handle_owner_assignment.side_effect = None
        mock_handle_auto_assignment.side_effect = None
        mock_process_rules.side_effect = None

        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key="dummykey",
            group_id=event.group_id,
            occurrence_id=event.occurrence_id,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Error,
        )

        assert transaction_processed_signal_mock.call_count == 1
        assert event_processed_signal_mock.call_count == 0
        assert mock_processor.call_count == 0
        assert run_post_process_job_mock.call_count == 1
        assert call_order == [
            mock_handle_owner_assignment,
            mock_handle_auto_assignment,
            mock_process_rules,
        ]


class PostProcessGroupAggregateEventTest(
    TestCase,
    SnubaTestCase,
    CorePostProcessGroupTestMixin,
    SnoozeTestSkipSnoozeMixin,
    PerformanceIssueTestCase,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        group = self.create_group(
            type=PerformanceP95EndpointRegressionGroupType.type_id,
        )

        event = self.store_event(data=data, project_id=project_id)
        event.group = group
        event = event.for_group(group)

        return event

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
    ):
        if cache_key is None:
            cache_key = write_event_to_cache(event)
        with self.feature(
            PerformanceP95EndpointRegressionGroupType.build_post_process_group_feature_name()
        ):
            post_process_group(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                cache_key=cache_key,
                group_id=event.group_id,
                project_id=event.project_id,
                eventstream_type=EventStreamEventType.Error,
            )
        return cache_key


class TransactionClustererTestCase(TestCase, SnubaTestCase):
    @patch("sentry.ingest.transaction_clusterer.datasource.redis._record_sample")
    def test_process_transaction_event_clusterer(
        self,
        mock_store_transaction_name,
    ):
        min_ago = before_now(minutes=1)
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
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Transaction,
        )

        assert mock_store_transaction_name.mock_calls == [
            mock.call(ClustererNamespace.TRANSACTIONS, self.project, "foo")
        ]


class ProcessingStoreTransactionEmptyTestcase(TestCase):
    @patch("sentry.tasks.post_process.logger")
    def test_logger_called_when_empty(self, mock_logger):
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key="e:1:2",
            group_id=None,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Transaction,
        )
        assert mock_logger.info.called
        mock_logger.info.assert_called_with(
            "post_process.skipped", extra={"cache_key": "e:1:2", "reason": "missing_cache"}
        )

    @patch("sentry.tasks.post_process.logger")
    @patch("sentry.utils.metrics.incr")
    @override_options({"transactions.do_post_process_in_save": 1.0})
    def test_logger_called_when_empty_option_on(self, mock_metric_incr, mock_logger):
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key="e:1:2",
            group_id=None,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Transaction,
        )
        assert not mock_logger.info.called
        mock_metric_incr.assert_called_with("post_process.skipped_do_post_process_in_save")

    @patch("sentry.tasks.post_process.logger")
    @override_options({"transactions.do_post_process_in_save": 1.0})
    def test_logger_called_when_empty_option_on_invalid_cache_key(self, mock_logger):
        post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            cache_key="invalidhehe",
            group_id=None,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Transaction,
        )
        mock_logger.info.assert_called_with(
            "post_process.skipped", extra={"cache_key": "invalidhehe", "reason": "missing_cache"}
        )

    def test_get_event_id_from_cache_key(self):
        assert _get_event_id_from_cache_key("e:1:2") == "1"
        assert _get_event_id_from_cache_key("invalid") is None


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
                eventstream_type=EventStreamEventType.Generic,
            )
        return cache_key

    def test_issueless(self):
        # Skip this test since there's no way to have issueless events in the issue platform
        pass

    def test_no_cache_abort(self):
        # We don't use the cache for generic issues, so skip this test
        pass

    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_occurrence_deduping(self, mock_processor):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )
        assert mock_processor.call_count == 1
        mock_processor.assert_called_with(EventMatcher(event), True, True, False, False, False)

        # Calling this again should do nothing, since we've already processed this occurrence.
        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )

        # Make sure we haven't called this again, since we should exit early.
        assert mock_processor.call_count == 1

    @patch("sentry.tasks.post_process.handle_owner_assignment")
    @patch("sentry.tasks.post_process.handle_auto_assignment")
    @patch("sentry.tasks.post_process.process_rules")
    @patch("sentry.tasks.post_process.run_post_process_job")
    @patch("sentry.rules.processing.processor.RuleProcessor")
    @patch("sentry.signals.event_processed.send_robust")
    @patch("sentry.utils.snuba.raw_query")
    def test_full_pipeline_with_group_states(
        self,
        snuba_raw_query_mock,
        event_processed_signal_mock,
        mock_processor,
        run_post_process_job_mock,
        mock_process_rules,
        mock_handle_auto_assignment,
        mock_handle_owner_assignment,
    ):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        call_order = [mock_handle_owner_assignment, mock_handle_auto_assignment, mock_process_rules]
        mock_handle_owner_assignment.side_effect = None
        mock_handle_auto_assignment.side_effect = None
        mock_process_rules.side_effect = None
        self.call_post_process_group(
            is_new=False,
            is_regression=True,
            is_new_group_environment=False,
            event=event,
        )
        assert event_processed_signal_mock.call_count == 0
        assert mock_processor.call_count == 0
        assert run_post_process_job_mock.call_count == 1
        assert call_order == [
            mock_handle_owner_assignment,
            mock_handle_auto_assignment,
            mock_process_rules,
        ]
        assert snuba_raw_query_mock.call_count == 0

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared(self):
        pass

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared_with_commits(self):
        pass


class PostProcessGroupFeedbackTest(
    TestCase,
    SnubaTestCase,
    OccurrenceTestMixin,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    RuleProcessorTestMixin,
    SnoozeTestMixin,
):
    def create_event(
        self,
        data,
        project_id,
        assert_no_errors=True,
        feedback_type=FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        is_spam=False,
    ):
        data["type"] = "generic"
        event = self.store_event(
            data=data, project_id=project_id, assert_no_errors=assert_no_errors
        )

        evidence_data = {
            "Test": 123,
            "source": feedback_type.value,
        }
        evidence_display = [
            {"name": "hi", "value": "bye", "important": True},
            {"name": "what", "value": "where", "important": False},
        ]
        if is_spam:
            evidence_data["is_spam"] = True

        occurrence_data = self.build_occurrence_data(
            event_id=event.event_id,
            project_id=project_id,
            **{
                "id": uuid.uuid4().hex,
                "fingerprint": ["c" * 32],
                "issue_title": "User Feedback",
                "subtitle": "it was bad",
                "culprit": "api/123",
                "resource_id": "1234",
                "evidence_data": evidence_data,
                "evidence_display": evidence_display,
                "type": FeedbackGroup.type_id,
                "detection_time": datetime.now().timestamp(),
                "level": "info",
            },
        )
        occurrence, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None

        group_event = event.for_group(group_info.group)
        group_event.occurrence = occurrence
        return group_event

    def call_post_process_group(
        self, is_new, is_regression, is_new_group_environment, event, cache_key=None
    ):
        with (
            self.feature(FeedbackGroup.build_post_process_group_feature_name()),
            self.feature("organizations:user-feedback-spam-filter-actions"),
        ):
            post_process_group(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                cache_key=None,
                group_id=event.group_id,
                occurrence_id=event.occurrence.id,
                project_id=event.group.project_id,
                eventstream_type=EventStreamEventType.Error,
            )
        return cache_key

    def test_not_ran_if_crash_report_option_disabled(self):
        self.project.update_option("sentry:feedback_user_report_notifications", False)
        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.CRASH_REPORT_EMBED_FORM,
        )
        mock_process_func = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
                cache_key="total_rubbish",
            )
        assert mock_process_func.call_count == 0

    def test_not_ran_if_spam(self):
        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.CRASH_REPORT_EMBED_FORM,
            is_spam=True,
        )
        mock_process_func = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
                cache_key="total_rubbish",
            )
        assert mock_process_func.call_count == 0

    def test_not_ran_if_crash_report_project_option_enabled(self):
        self.project.update_option("sentry:feedback_user_report_notifications", True)

        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.CRASH_REPORT_EMBED_FORM,
        )
        mock_process_func = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
                cache_key="total_rubbish",
            )
        assert mock_process_func.call_count == 1

    def test_not_ran_if_crash_report_setting_option_epoch_0(self):
        self.project.update_option("sentry:option-epoch", 1)
        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.CRASH_REPORT_EMBED_FORM,
        )
        mock_process_func = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
                cache_key="total_rubbish",
            )
        assert mock_process_func.call_count == 0

    def test_ran_if_default_on_new_projects(self):
        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.CRASH_REPORT_EMBED_FORM,
        )
        mock_process_func = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
                cache_key="total_rubbish",
            )
        assert mock_process_func.call_count == 1

    def test_ran_if_crash_feedback_envelope(self):
        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        )
        mock_process_func = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
                cache_key="total_rubbish",
            )
        assert mock_process_func.call_count == 1

    @pytest.mark.skip(
        reason="Skip this test since there's no way to have issueless events in the issue platform"
    )
    def test_issueless(self): ...

    def test_no_cache_abort(self):
        # We don't use the cache for generic issues, so skip this test
        pass

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared(self):
        pass

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared_with_commits(self):
        pass
