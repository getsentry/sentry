from __future__ import annotations

import abc
import time
import uuid
from datetime import datetime, timedelta
from hashlib import md5
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, Mock, PropertyMock, patch

import pytest
from django.db import router
from django.test import override_settings
from django.utils import timezone

from sentry import buffer
from sentry.analytics.events.first_flag_sent import FirstFlagSentEvent
from sentry.eventstream.types import EventStreamEventType
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.commit_context import CommitInfo, FileBlameInfo
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.issues.auto_source_code_config.utils.platform import get_supported_platforms
from sentry.issues.grouptype import (
    FeedbackGroup,
    GroupCategory,
    PerformanceNPlusOneGroupType,
    PerformanceP95EndpointRegressionGroupType,
)
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.ownership.grammar import Matcher, Owner, Rule, dump_schema
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
from sentry.replays.lib import kafka as replays_kafka
from sentry.replays.lib.kafka import clear_replay_publisher
from sentry.rules import init_registry
from sentry.rules.actions.base import EventAction
from sentry.services.eventstore.models import Event
from sentry.services.eventstore.processing import event_processing_store
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.tasks.merge import merge_groups
from sentry.tasks.post_process import (
    HIGHER_ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT,
    ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT,
    feedback_filter_decorator,
    locks,
    post_process_group,
    run_post_process_job,
)
from sentry.testutils.cases import BaseTestCase, PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel
from sentry.uptime.autodetect.ranking import get_organization_bucket_key
from sentry.uptime.utils import get_cluster
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
    def test_no_cache_abort(self, mock_processor: MagicMock) -> None:
        event = self.create_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
            cache_key="total-rubbish",
        )

        assert mock_processor.call_count == 0

    def test_processing_cache_cleared(self) -> None:
        event = self.create_event(data={}, project_id=self.project.id)

        cache_key = self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        assert event_processing_store.get(cache_key) is None

    def test_processing_cache_cleared_with_commits(self) -> None:
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

    def _generate_node_data(self, filename: str) -> dict[str, Any]:
        return {
            "stacktrace": {"frames": [{"filename": f"src/{filename}.py", "in_app": True}]},
            "platform": "python",
        }

    def _call_post_process_group(self, event: Event) -> None:
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

    @patch("sentry.tasks.auto_source_code_config.auto_source_code_config")
    def test_derive_invalid_platform(self, mock_derive_code_mappings: MagicMock) -> None:
        event = self._create_event({"platform": "elixir"})
        self._call_post_process_group(event)

        assert mock_derive_code_mappings.delay.call_count == 0

    @patch("sentry.tasks.auto_source_code_config.auto_source_code_config")
    def test_derive_supported_languages(self, mock_derive_code_mappings: MagicMock) -> None:
        for platform in get_supported_platforms():
            event = self._create_event(self._generate_node_data("foo"))
            self._call_post_process_group(event)

            assert mock_derive_code_mappings.delay.call_count == 1

    @patch("sentry.tasks.auto_source_code_config.auto_source_code_config")
    def test_only_maps_a_given_project_once_per_hour(
        self, mock_derive_code_mappings: MagicMock
    ) -> None:
        dogs_project = self.create_project()
        maisey_event = self._create_event(self._generate_node_data("themaiseydog"), dogs_project.id)
        charlie_event = self._create_event(self._generate_node_data("charliebear"), dogs_project.id)
        cory_event = self._create_event(self._generate_node_data("thenudge"), dogs_project.id)
        bodhi_event = self._create_event(self._generate_node_data("escapeartist"), dogs_project.id)

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

    @patch("sentry.tasks.auto_source_code_config.auto_source_code_config")
    def test_only_maps_a_given_issue_once_per_day(
        self, mock_derive_code_mappings: MagicMock
    ) -> None:
        dogs_project = self.create_project()
        data = {
            "stacktrace": {"frames": [{"filename": "src/app/example.py", "in_app": True}]},
            "platform": "python",
        }
        maisey_event1 = self._create_event(data, dogs_project.id)
        maisey_event2 = self._create_event(data, dogs_project.id)
        maisey_event3 = self._create_event(data, dogs_project.id)
        maisey_event4 = self._create_event(data, dogs_project.id)
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

    @patch("sentry.tasks.auto_source_code_config.auto_source_code_config")
    def test_skipping_an_issue_doesnt_mark_it_processed(
        self, mock_derive_code_mappings: MagicMock
    ) -> None:
        dogs_project = self.create_project()
        maisey_event = self._create_event(self._generate_node_data("themaiseydog"), dogs_project.id)
        charlie_event1 = self._create_event(
            self._generate_node_data("charliebear"), dogs_project.id
        )
        charlie_event2 = self._create_event(
            self._generate_node_data("charliebear"), dogs_project.id
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
    def test_rule_processor_backwards_compat(self, mock_processor: MagicMock) -> None:
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
    def test_rule_processor(self, mock_processor: MagicMock) -> None:
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
    def test_rule_processor_buffer_values(self) -> None:
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
    def test_group_refresh(self, mock_processor: MagicMock) -> None:
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
    def test_group_last_seen_buffer(self, mock_processor: MagicMock) -> None:
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
    def test_service_hook_fires_on_new_event(self, mock_process_service_hook: MagicMock) -> None:
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
            servicehook_id=hook.id,
            project_id=self.project.id,
            group_id=event.group_id,
            event_id=event.event_id,
        )

    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_service_hook_fires_on_alert(
        self, mock_processor: MagicMock, mock_process_service_hook: MagicMock
    ) -> None:
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
            servicehook_id=hook.id,
            project_id=self.project.id,
            group_id=event.group_id,
            event_id=event.event_id,
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
    def test_service_hook_does_not_fire_without_event(
        self, mock_process_service_hook: MagicMock
    ) -> None:
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

    @patch("sentry.rules.processing.processor.RuleProcessor")
    @patch("sentry.workflow_engine.tasks.workflows.process_workflows_event")
    def test_workflow_engine_single_processing(
        self, mock_process_event: MagicMock, mock_processor: MagicMock
    ) -> None:
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

        # With the workflow engine feature flag enabled, RuleProcessor should not be called
        assert mock_processor.call_count == 0

        # Call the function inside process_workflow_engine
        assert mock_process_event.apply_async.call_count == 1

    @patch("sentry.rules.processing.processor.RuleProcessor")
    @patch("sentry.workflow_engine.tasks.workflows.process_workflows_event")
    def test_workflow_engine_single_processing__ignore_archived(
        self, mock_process_event, mock_processor
    ):
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group = event.group
        group.update(status=GroupStatus.IGNORED)

        mock_callback = Mock()
        mock_futures = [Mock()]

        mock_processor.return_value.apply.return_value = [(mock_callback, mock_futures)]

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        # With the workflow engine feature flag enabled, RuleProcessor should not be called
        assert mock_processor.call_count == 0

        # Don't process workflows for ignored issue
        assert mock_process_event.apply_async.call_count == 0


class ResourceChangeBoundsTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_processes_resource_change_task_on_new_group(self, delay: MagicMock) -> None:
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
    def test_processes_resource_change_task_on_error_events(self, delay: MagicMock) -> None:
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
    def test_processes_resource_change_task_not_called_for_non_errors(
        self, delay: MagicMock
    ) -> None:
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
    def test_processes_resource_change_task_not_called_without_feature_flag(
        self, delay: MagicMock
    ) -> None:
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
    def test_processes_resource_change_task_not_called_without_error_created(
        self, delay: MagicMock
    ) -> None:
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
    def test_group_inbox_regression(self, mock_processor: MagicMock) -> None:
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

    def test_owner_assignment_order_precedence(self) -> None:
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
            "assigneeName": self.user.name,
            "assigneeType": "user",
            "integration": ActivityIntegration.PROJECT_OWNERSHIP.value,
            "rule": str(Rule(Matcher("path", "src/*"), [Owner("user", self.user.email)])),
        }

    def test_owner_assignment_extra_groups(self) -> None:
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

    def test_owner_assignment_existing_owners(self) -> None:
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

    def test_owner_assignment_existing_assignee_preserved(self):
        """
        Tests that if a group already has an assignee, post-processing won't reassign it
        even if ownership rules change in the interim.
        """
        other_team = self.create_team()
        ProjectTeam.objects.create(team=other_team, project=self.project)

        rules = [
            Rule(Matcher("path", "src/*"), [Owner("team", self.team.slug)]),
            Rule(Matcher("path", "src/app/*"), [Owner("team", other_team.slug)]),
        ]
        self.prj_ownership = ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(rules),
            fallthrough=True,
            auto_assignment=True,
        )

        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/example.py"}]},
            },
            project_id=self.project.id,
        )

        # No assignee should exist prior to post processing
        assert not event.group.assignee_set.exists()

        # First post-processing - should assign to other_team (last matching rule)
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        assignee = event.group.assignee_set.first()
        assert assignee.team == other_team

        new_rules = [
            Rule(Matcher("path", "src/app/*"), [Owner("team", other_team.slug)]),
            Rule(Matcher("path", "src/*"), [Owner("team", self.team.slug)]),
        ]
        self.prj_ownership.schema = dump_schema(new_rules)
        self.prj_ownership.save()

        # Run post-processing again - assignee should NOT change
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assignee = event.group.assignee_set.first()
        assert assignee.team == other_team

        # If we had a completely new group, it would get assigned to self.team (new last matching rule)
        fresh_event = self.create_event(
            data={
                "message": "fresh event",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app/fresh.py"}]},
            },
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=fresh_event,
        )

        fresh_assignee = fresh_event.group.assignee_set.first()
        assert fresh_assignee.team == self.team

    def test_owner_assignment_assign_user(self) -> None:
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

    def test_owner_assignment_ownership_no_matching_owners(self) -> None:
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

    def test_owner_assignment_existing_assignment(self) -> None:
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

    def test_only_first_assignment_works(self) -> None:
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

    def test_owner_assignment_owner_is_gone(self) -> None:
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

    def test_suspect_committer_affect_cache_debouncing_issue_owners_calculations(self) -> None:
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

    def test_owner_assignment_when_owners_have_been_unassigned(self) -> None:
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

    def test_auto_assignment_when_owners_have_been_unassigned(self) -> None:
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

    def test_ensure_when_assignees_and_owners_are_cached_does_not_cause_unbound_errors(
        self,
    ) -> None:
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

    def test_auto_assignment_when_owners_are_invalid(self) -> None:
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
    def test_debounces_handle_owner_assignments(self, mock_incr: MagicMock) -> None:
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
    def test_debounces_with_timestamp_format(self, mock_incr: MagicMock) -> None:
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id))
        assert debounce_time is None

        # First event: evaluates ownership and sets debounce timestamp
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id))
        assert debounce_time is not None
        assert isinstance(debounce_time, float)

        # Second event: should debounce because no ownership change occurred
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        mock_incr.assert_any_call("sentry.tasks.post_process.handle_owner_assignment.debounce")

    @patch("sentry.utils.metrics.incr")
    def test_timestamp_invalidation_when_ownership_changes(self, mock_incr: MagicMock) -> None:
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id))
        assert debounce_time is None

        # First event: should evaluate ownership and set debounce timestamp
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id))
        assert debounce_time is not None
        assert isinstance(debounce_time, float)

        # Simulate ownership rules changing
        GroupOwner.set_project_ownership_version(self.project.id)

        # Second event: should NOT debounce because ownership changed after debounce was set
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        assert (
            mock.call("sentry.tasks.post_process.handle_owner_assignment.debounce")
            not in mock_incr.call_args_list
        )

    @patch("sentry.utils.metrics.incr")
    def test_timestamp_debounce_when_ownership_older(self, mock_incr: MagicMock) -> None:
        self.make_ownership()
        event = self.create_event(
            data={
                "message": "oh no",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "src/app.py"}]},
            },
            project_id=self.project.id,
        )
        debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id))
        assert debounce_time is None

        # Ownership changed in the past (before any events)
        GroupOwner.set_project_ownership_version(self.project.id)

        # First event: evaluates ownership (ownership change is in the past, so no debounce yet)
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        debounce_time = cache.get(ISSUE_OWNERS_DEBOUNCE_KEY(event.group_id))
        assert debounce_time is not None

        # Second event: should debounce because ownership change is older than the debounce timestamp
        self.call_post_process_group(
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )
        mock_incr.assert_any_call("sentry.tasks.post_process.handle_owner_assignment.debounce")

    @patch("sentry.utils.metrics.incr")
    def test_issue_owners_should_ratelimit(self, mock_incr: MagicMock) -> None:
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
            # Create a new event to avoid debouncing
            event2 = self.create_event(
                data={
                    "message": "oh no again",
                    "platform": "python",
                    "stacktrace": {"frames": [{"filename": "src/app2.py"}]},
                },
                project_id=self.project.id,
            )
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event2,
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
            # Create a new event to avoid debouncing
            event3 = self.create_event(
                data={
                    "message": "oh no yet again",
                    "platform": "python",
                    "stacktrace": {"frames": [{"filename": "src/app3.py"}]},
                },
                project_id=self.project.id,
            )
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event3,
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

    def setUp(self) -> None:
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
    def test_logic_fallback_no_scm(self, mock_get_commit_context: MagicMock) -> None:
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
    def test_github_enterprise(self, mock_get_commit_context: MagicMock) -> None:
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
    def test_skip_when_not_is_new(self, mock_get_commit_context: MagicMock) -> None:
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
    def test_does_not_skip_when_is_new(self, mock_get_commit_context: MagicMock) -> None:
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
    def test_invalidates_snooze_issue_platform(
        self, mock_processor: MagicMock, mock_send_unignored_robust: MagicMock
    ) -> None:
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
    def test_invalidates_snooze(
        self, mock_processor: MagicMock, mock_send_unignored_robust: MagicMock
    ) -> None:
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
    def test_invalidates_snooze_with_buffers(
        self, mock_processor: MagicMock, send_robust: MagicMock
    ) -> None:
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
    def test_maintains_valid_snooze(self, mock_processor: MagicMock) -> None:
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

    @patch("sentry.issues.escalating.escalating.is_escalating", return_value=(True, 0))
    def test_forecast_in_activity(self, mock_is_escalating: MagicMock) -> None:
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

    @patch("sentry.issues.escalating.escalating.is_escalating")
    def test_skip_escalation_logic_for_new_groups(self, mock_is_escalating: MagicMock) -> None:
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
    def test_sdk_crash_monitoring_is_called(self, mock_sdk_crash_detection: MagicMock) -> None:
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
    def test_sdk_crash_monitoring_not_called_without_sample_rate(
        self, mock_sdk_crash_detection: MagicMock
    ) -> None:
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
    def test_sdk_crash_monitoring_is_not_called_without_project_id(
        self, mock_sdk_crash_detection: MagicMock
    ) -> None:
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
    def test_replay_linkage(
        self, incr: MagicMock, kafka_producer: MagicMock, kafka_publisher: MagicMock
    ) -> None:
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

    def test_replay_linkage_with_tag(
        self, incr: MagicMock, kafka_producer: MagicMock, kafka_publisher: MagicMock
    ) -> None:
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

    def test_replay_linkage_with_tag_pii_scrubbed(
        self, incr: MagicMock, kafka_producer: MagicMock, kafka_publisher: MagicMock
    ) -> None:
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

    def test_no_replay(
        self, incr: MagicMock, kafka_producer: MagicMock, kafka_publisher: MagicMock
    ) -> None:
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
    def test_user_report_gets_environment(self) -> None:
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

    def test_user_report_gets_environment_with_new_link_features(self) -> None:
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

    @patch("sentry.feedback.usecases.ingest.create_feedback.produce_occurrence_to_kafka")
    def test_user_report_shims_to_feedback(
        self, mock_produce_occurrence_to_kafka: MagicMock
    ) -> None:
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

    @patch("sentry.feedback.usecases.ingest.create_feedback.produce_occurrence_to_kafka")
    def test_user_reports_no_shim_if_group_exists_on_report(
        self, mock_produce_occurrence_to_kafka: MagicMock
    ) -> None:
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
        cluster = get_cluster()
        assert exists == cluster.sismember(key, str(organization.id))

    def test_uptime_detection_feature_url(self) -> None:
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

    def test_uptime_detection_feature_no_url(self) -> None:
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

    @override_options({"uptime.automatic-hostname-detection": False})
    def test_uptime_detection_no_option(self) -> None:
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


@patch("sentry.analytics.record")
@patch("sentry.utils.metrics.incr")
@patch("sentry.utils.metrics.distribution")
class CheckIfFlagsSentTestMixin(BasePostProgressGroupMixin):
    def test_set_has_flags(
        self, mock_dist: MagicMock, mock_incr: MagicMock, mock_record: MagicMock
    ) -> None:
        project = self.create_project(platform="other")
        event_id = "a" * 32
        event = self.create_event(
            data={
                "event_id": event_id,
                "contexts": {
                    "flags": {
                        "values": [
                            {
                                "flag": "test-flag-1",
                                "result": False,
                            },
                            {
                                "flag": "test-flag-2",
                                "result": True,
                            },
                        ]
                    }
                },
            },
            project_id=project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        project.refresh_from_db()
        assert project.flags.has_flags

        mock_incr.assert_any_call("feature_flags.event_has_flags_context")
        mock_dist.assert_any_call("feature_flags.num_flags_sent", 2)
        assert_last_analytics_event(
            mock_record,
            FirstFlagSentEvent(
                organization_id=self.organization.id,
                project_id=project.id,
                platform=project.platform,
            ),
        )


class DetectNewEscalationTestMixin(BasePostProgressGroupMixin):
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated(self, mock_run_post_process_job: MagicMock) -> None:
        event = self.create_event(data={}, project_id=self.project.id)
        group = event.group
        group.update(
            first_seen=timezone.now() - timedelta(hours=1),
            times_seen=10,
            priority=PriorityLevel.LOW,
        )
        event.group = Group.objects.get(id=group.id)

        with patch("sentry.issues.escalating.issue_velocity.calculate_threshold", return_value=9):
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated_old(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold", return_value=11)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_not_escalated(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated_locked(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_escalated_already_escalated(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold")
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_does_not_escalate_non_new_substatus(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold", return_value=8)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_no_escalation_less_than_floor(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold", return_value=11)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_has_not_escalated_less_than_an_hour(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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

    @patch("sentry.issues.escalating.issue_velocity.get_latest_threshold", return_value=0)
    @patch("sentry.tasks.post_process.run_post_process_job", side_effect=run_post_process_job)
    def test_zero_escalation_rate(
        self, mock_run_post_process_job: MagicMock, mock_threshold: MagicMock
    ) -> None:
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
    def test_process_similarity(self, mock_safe_execute: MagicMock) -> None:
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
    def test_skip_process_similarity(self, mock_safe_execute: MagicMock) -> None:
        self.project.update_option("sentry:similarity_backfill_completed", int(time.time()))
        event = self.create_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        self.assert_not_called_with(mock_safe_execute)

    @patch("sentry.tasks.post_process.safe_execute")
    @override_options({"sentry.similarity.indexing.enabled": False})
    def test_skip_process_similarity_global(self, mock_safe_execute: MagicMock) -> None:
        event = self.create_event(data={}, project_id=self.project.id)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        self.assert_not_called_with(mock_safe_execute)


class KickOffSeerAutomationTestMixin(BasePostProgressGroupMixin):
    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_with_features(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        self.project.update_option("sentry:seer_scanner_automation", True)
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

        mock_generate_summary_and_run_automation.assert_called_once_with(event.group.id)

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    def test_kick_off_seer_automation_without_org_feature(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        self.project.update_option("sentry:seer_scanner_automation", True)
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

        mock_generate_summary_and_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=False,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_without_seer_enabled(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        self.project.update_option("sentry:seer_scanner_automation", True)
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

        mock_generate_summary_and_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_without_scanner_on(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )
        self.project.update_option("sentry:seer_scanner_automation", False)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        mock_generate_summary_and_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_skips_existing_fixability_score(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Set seer_fixability_score on the group
        group = event.group
        group.seer_fixability_score = 0.75
        group.save()

        self.call_post_process_group(
            is_new=False,  # Not a new group
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        mock_generate_summary_and_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_runs_with_missing_fixability_score(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Group has no seer_fixability_score (None by default)
        group = event.group
        assert group.seer_fixability_score is None

        self.call_post_process_group(
            is_new=False,  # Not a new group
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        mock_generate_summary_and_run_automation.assert_called_once_with(group.id)

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_skips_with_existing_fixability_score(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        from sentry.seer.autofix.issue_summary import get_issue_summary_cache_key

        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Set seer_fixability_score on the group
        group = event.group
        group.seer_fixability_score = 0.75
        group.save()

        # No cached issue summary (cache.get will return None)
        cache_key = get_issue_summary_cache_key(group.id)
        assert cache.get(cache_key) is None

        self.call_post_process_group(
            is_new=False,  # Not a new group
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        mock_generate_summary_and_run_automation.assert_not_called()

    @patch("sentry.seer.autofix.utils.is_seer_scanner_rate_limited")
    @patch("sentry.quotas.backend.check_seer_quota")
    @patch("sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner")
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_rate_limit_only_checked_after_all_other_checks_pass(
        self,
        mock_generate_summary_and_run_automation,
        mock_get_seer_org_acknowledgement,
        mock_has_budget,
        mock_is_rate_limited,
    ):
        """Test that rate limit check only happens after all other checks pass"""
        mock_get_seer_org_acknowledgement.return_value = True
        mock_has_budget.return_value = True
        mock_is_rate_limited.return_value = False

        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Test 1: When all checks pass, rate limit should be checked
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )
        mock_is_rate_limited.assert_called_once_with(event.project, event.group.organization)
        mock_generate_summary_and_run_automation.assert_called_once_with(event.group.id)

        mock_is_rate_limited.reset_mock()
        mock_generate_summary_and_run_automation.reset_mock()

        # Test 2: When seer org acknowledgement fails, rate limit should NOT be checked
        mock_get_seer_org_acknowledgement.return_value = False

        event2 = self.create_event(
            data={"message": "testing 2"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event2,
        )
        mock_is_rate_limited.assert_not_called()
        mock_generate_summary_and_run_automation.assert_not_called()

        mock_is_rate_limited.reset_mock()
        mock_generate_summary_and_run_automation.reset_mock()
        mock_get_seer_org_acknowledgement.return_value = True  # Reset to success

        # Test 3: When budget check fails, rate limit should NOT be checked
        mock_has_budget.return_value = False

        event3 = self.create_event(
            data={"message": "testing 3"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event3,
        )
        mock_is_rate_limited.assert_not_called()
        mock_generate_summary_and_run_automation.assert_not_called()

        mock_is_rate_limited.reset_mock()
        mock_generate_summary_and_run_automation.reset_mock()
        mock_has_budget.return_value = True  # Reset to success

        # Test 4: When project option is disabled, rate limit should NOT be checked
        self.project.update_option("sentry:seer_scanner_automation", False)

        event4 = self.create_event(
            data={"message": "testing 4"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event4,
        )
        mock_is_rate_limited.assert_not_called()
        mock_generate_summary_and_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_skips_when_lock_held(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        """Test that seer automation is skipped when another task is already processing the same issue"""
        from sentry.seer.autofix.issue_summary import get_issue_summary_lock_key
        from sentry.tasks.post_process import locks

        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Acquire the lock manually to simulate another task in progress
        lock_key, lock_name = get_issue_summary_lock_key(event.group.id)
        lock = locks.get(lock_key, duration=10, name=lock_name)

        with lock.acquire():
            # Call post process group while lock is held
            self.call_post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                event=event,
            )

        # Verify that seer automation was NOT started due to the lock
        mock_generate_summary_and_run_automation.assert_not_called()

        # Test that it works normally when lock is not held
        event2 = self.create_event(
            data={"message": "testing 2"},
            project_id=self.project.id,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event2,
        )

        # Now it should be called since no lock is held
        mock_generate_summary_and_run_automation.assert_called_once_with(event2.group.id)

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature("organizations:gen-ai-features")
    def test_kick_off_seer_automation_with_hide_ai_features_enabled(
        self, mock_generate_summary_and_run_automation, mock_get_seer_org_acknowledgement
    ):
        """Test that seer automation is not started when organization has hideAiFeatures set to True"""
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.organization.update_option("sentry:hide_ai_features", True)

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

        mock_generate_summary_and_run_automation.assert_not_called()


class TriageSignalsV0TestMixin(BasePostProgressGroupMixin):
    """Tests for the triage signals V0 flow behind the organizations:triage-signals-v0-org feature flag."""

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_issue_summary_only.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_less_than_10_no_cache(
        self, mock_generate_summary_only, mock_get_seer_org_acknowledgement
    ):
        """Test that with event count < 10 and no cached summary, we generate summary only (no automation)."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Ensure event count < 10
        group = event.group
        # Set times_seen_pending to 0 to ensure times_seen_with_pending < 10
        group.times_seen_pending = 0
        assert group.times_seen_with_pending < 10

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        # Should call generate_issue_summary_only (not generate_summary_and_run_automation)
        mock_generate_summary_only.assert_called_once_with(group.id)

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_issue_summary_only.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_less_than_10_with_cache(
        self, mock_generate_summary_only, mock_get_seer_org_acknowledgement
    ):
        """Test that with event count < 10 and cached summary exists, we do nothing."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Cache a summary for this group
        from sentry.seer.autofix.issue_summary import get_issue_summary_cache_key

        group = event.group
        cache_key = get_issue_summary_cache_key(group.id)
        cache.set(cache_key, {"summary": "test summary"}, 3600)

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            event=event,
        )

        # Should not call anything since summary exists
        mock_generate_summary_only.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch(
        "sentry.seer.autofix.utils.has_project_connected_repos",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.run_automation_only_task.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_gte_10_with_cache(
        self, mock_run_automation, mock_has_repos, mock_get_seer_org_acknowledgement
    ):
        """Test that with event count >= 10 and cached summary exists, we run automation directly."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Update group times_seen to simulate >= 10 events
        group = event.group
        group.times_seen = 1
        group.save()
        # Also update the event's cached group reference
        event.group.times_seen = 1

        # Mock buffer backend to return pending increments
        from sentry import buffer

        def mock_buffer_get(model, columns, filters):
            return {"times_seen": 9}

        with patch.object(buffer.backend, "get", side_effect=mock_buffer_get):
            # Cache a summary for this group
            from sentry.seer.autofix.issue_summary import get_issue_summary_cache_key

            cache_key = get_issue_summary_cache_key(group.id)
            cache.set(cache_key, {"summary": "test summary"}, 3600)

            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )

        # Should call run_automation_only_task since summary exists
        mock_run_automation.assert_called_once_with(group.id)

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch(
        "sentry.seer.autofix.utils.has_project_connected_repos",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_gte_10_no_cache(
        self,
        mock_generate_summary_and_run_automation,
        mock_has_repos,
        mock_get_seer_org_acknowledgement,
    ):
        """Test that with event count >= 10 and no cached summary, we generate summary + run automation."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Update group times_seen to simulate >= 10 events
        group = event.group
        group.times_seen = 1
        group.save()
        # Also update the event's cached group reference
        event.group.times_seen = 1

        # Mock buffer backend to return pending increments
        from sentry import buffer

        def mock_buffer_get(model, columns, filters):
            return {"times_seen": 9}

        with patch.object(buffer.backend, "get", side_effect=mock_buffer_get):
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )

        # Should call generate_summary_and_run_automation to generate summary + run automation
        mock_generate_summary_and_run_automation.assert_called_once_with(group.id)

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch(
        "sentry.seer.autofix.utils.has_project_connected_repos",
        return_value=False,
    )
    @patch("sentry.tasks.autofix.generate_summary_and_run_automation.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_gte_10_skips_without_connected_repos(
        self,
        mock_generate_summary_and_run_automation,
        mock_has_repos,
        mock_get_seer_org_acknowledgement,
    ):
        """Test that with event count >= 10 but no connected repos, we skip automation."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Update group times_seen to simulate >= 10 events
        group = event.group
        group.times_seen = 1
        group.save()
        event.group.times_seen = 1

        # Mock buffer backend to return pending increments
        from sentry import buffer

        def mock_buffer_get(model, columns, filters):
            return {"times_seen": 9}

        with patch.object(buffer.backend, "get", side_effect=mock_buffer_get):
            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )

        # Should not call automation since no connected repos
        mock_generate_summary_and_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.run_automation_only_task.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_gte_10_skips_with_seer_last_triggered(
        self, mock_run_automation, mock_get_seer_org_acknowledgement
    ):
        """Test that with event count >= 10 and seer_autofix_last_triggered set, we skip automation."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Update group times_seen and seer_autofix_last_triggered
        group = event.group
        group.times_seen = 1
        group.seer_autofix_last_triggered = timezone.now()
        group.save()
        # Also update the event's cached group reference
        event.group.times_seen = 1
        event.group.seer_autofix_last_triggered = group.seer_autofix_last_triggered

        # Mock buffer backend to return pending increments
        from sentry import buffer

        def mock_buffer_get(model, columns, filters):
            return {"times_seen": 9}

        with patch.object(buffer.backend, "get", side_effect=mock_buffer_get):
            # Cache a summary for this group
            from sentry.seer.autofix.issue_summary import get_issue_summary_cache_key

            cache_key = get_issue_summary_cache_key(group.id)
            cache.set(cache_key, {"summary": "test summary"}, 3600)

            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )

        # Should not call automation since seer_autofix_last_triggered is set
        mock_run_automation.assert_not_called()

    @patch(
        "sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner",
        return_value=True,
    )
    @patch("sentry.tasks.autofix.run_automation_only_task.delay")
    @with_feature(
        {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True}
    )
    def test_triage_signals_event_count_gte_10_skips_with_existing_fixability_score(
        self, mock_run_automation, mock_get_seer_org_acknowledgement
    ):
        """Test that with event count >= 10 and seer_fixability_score below MEDIUM threshold, we skip automation."""
        self.project.update_option("sentry:seer_scanner_automation", True)
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        event = self.create_event(
            data={"message": "testing"},
            project_id=self.project.id,
        )

        # Update group times_seen and set seer_fixability_score below MEDIUM threshold (< 0.40)
        group = event.group
        group.times_seen = 1
        group.seer_fixability_score = 0.3
        group.save()
        # Also update the event's cached group reference
        event.group.times_seen = 1
        event.group.seer_fixability_score = 0.3

        # Mock buffer backend to return pending increments
        from sentry import buffer

        def mock_buffer_get(model, columns, filters):
            return {"times_seen": 9}

        with patch.object(buffer.backend, "get", side_effect=mock_buffer_get):
            # Cache a summary for this group
            from sentry.seer.autofix.issue_summary import get_issue_summary_cache_key

            cache_key = get_issue_summary_cache_key(group.id)
            cache.set(cache_key, {"summary": "test summary"}, 3600)

            self.call_post_process_group(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                event=event,
            )

        # Should not call automation since seer_fixability_score is below MEDIUM threshold
        mock_run_automation.assert_not_called()


class SeerAutomationHelperFunctionsTestMixin(BasePostProgressGroupMixin):
    """Unit tests for is_issue_eligible_for_seer_automation."""

    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.seer_setup.get_seer_org_acknowledgement_for_scanner", return_value=True)
    @patch("sentry.features.has", return_value=True)
    def test_is_issue_eligible_for_seer_automation(
        self, mock_features_has, mock_get_seer_org_acknowledgement, mock_has_budget
    ):
        """Test permission check with various failure conditions."""
        from sentry.constants import DataCategory
        from sentry.issues.grouptype import GroupCategory
        from sentry.seer.autofix.utils import is_issue_eligible_for_seer_automation

        self.project.update_option("sentry:seer_scanner_automation", True)
        event = self.create_event(data={"message": "testing"}, project_id=self.project.id)
        group = event.group

        # All conditions pass
        assert is_issue_eligible_for_seer_automation(group) is True

        # Unsupported categories (using PropertyMock to mock the property)
        with patch(
            "sentry.models.group.Group.issue_category", new_callable=PropertyMock
        ) as mock_category:
            mock_category.return_value = GroupCategory.REPLAY
            assert is_issue_eligible_for_seer_automation(group) is False

            mock_category.return_value = GroupCategory.FEEDBACK
            assert is_issue_eligible_for_seer_automation(group) is False

        # Missing feature flag
        mock_features_has.return_value = False
        assert is_issue_eligible_for_seer_automation(group) is False

        # Hide AI features enabled
        mock_features_has.return_value = True
        self.organization.update_option("sentry:hide_ai_features", True)
        assert is_issue_eligible_for_seer_automation(group) is False
        self.organization.update_option("sentry:hide_ai_features", False)

        # Scanner disabled without always_trigger
        self.project.update_option("sentry:seer_scanner_automation", False)
        with patch.object(group.issue_type, "always_trigger_seer_automation", False):
            assert is_issue_eligible_for_seer_automation(group) is False

        # Scanner disabled but always_trigger enabled
        with patch.object(group.issue_type, "always_trigger_seer_automation", True):
            assert is_issue_eligible_for_seer_automation(group) is True

        # Seer not acknowledged
        self.project.update_option("sentry:seer_scanner_automation", True)
        mock_get_seer_org_acknowledgement.return_value = False
        assert is_issue_eligible_for_seer_automation(group) is False

        # No budget
        mock_get_seer_org_acknowledgement.return_value = True
        mock_has_budget.return_value = False
        assert is_issue_eligible_for_seer_automation(group) is False
        mock_has_budget.assert_called_with(
            org_id=group.organization.id, data_category=DataCategory.SEER_SCANNER
        )


class PostProcessGroupErrorTest(
    TestCase,
    AssignmentTestMixin,
    ProcessCommitsTestMixin,
    CorePostProcessGroupTestMixin,
    DeriveCodeMappingsProcessGroupTestMixin,
    InboxTestMixin,
    ResourceChangeBoundsTestMixin,
    KickOffSeerAutomationTestMixin,
    TriageSignalsV0TestMixin,
    SeerAutomationHelperFunctionsTestMixin,
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
    CheckIfFlagsSentTestMixin,
):
    def setUp(self) -> None:
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
            eventstream_type=EventStreamEventType.Error.value,
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
    KickOffSeerAutomationTestMixin,
    TriageSignalsV0TestMixin,
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
                eventstream_type=EventStreamEventType.Error.value,
            )
        return cache_key

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
            eventstream_type=EventStreamEventType.Error.value,
        )

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
                eventstream_type=EventStreamEventType.Error.value,
            )
        return cache_key


class PostProcessGroupGenericTest(
    TestCase,
    SnubaTestCase,
    OccurrenceTestMixin,
    CorePostProcessGroupTestMixin,
    InboxTestMixin,
    RuleProcessorTestMixin,
    SnoozeTestMixin,
    KickOffSeerAutomationTestMixin,
    TriageSignalsV0TestMixin,
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
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=None,
            group_id=event.group_id,
            occurrence_id=event.occurrence.id,
            project_id=event.group.project_id,
            eventstream_type=EventStreamEventType.Generic.value,
        )
        return cache_key

    def test_issueless(self) -> None:
        # Skip this test since there's no way to have issueless events in the issue platform
        pass

    def test_no_cache_abort(self) -> None:
        # We don't use the cache for generic issues, so skip this test
        pass

    @patch("sentry.rules.processing.processor.RuleProcessor")
    def test_occurrence_deduping(self, mock_processor: MagicMock) -> None:
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
    def test_processing_cache_cleared(self) -> None:
        pass

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared_with_commits(self) -> None:
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
            "source": feedback_type.value if feedback_type else None,
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
        with self.feature(FeedbackGroup.build_post_process_group_feature_name()):
            post_process_group(
                is_new=is_new,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                cache_key=None,
                group_id=event.group_id,
                occurrence_id=event.occurrence.id,
                project_id=event.group.project_id,
                eventstream_type=EventStreamEventType.Error.value,
            )
        return cache_key

    def test_not_ran_if_crash_report_option_disabled(self) -> None:
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

    def test_not_ran_if_spam(self) -> None:
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

    def test_not_ran_if_crash_report_project_option_enabled(self) -> None:
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

    def test_not_ran_if_crash_report_setting_option_epoch_0(self) -> None:
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

    def test_ran_if_default_on_new_projects(self) -> None:
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

    def test_ran_if_crash_feedback_envelope(self) -> None:
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

    def test_logs_if_source_missing(self) -> None:
        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=None,
        )
        mock_process_func = Mock()
        mock_logger = Mock()
        with patch(
            "sentry.tasks.post_process.GROUP_CATEGORY_POST_PROCESS_PIPELINE",
            {
                GroupCategory.FEEDBACK: [
                    feedback_filter_decorator(mock_process_func),
                ]
            },
        ):
            with patch("sentry.tasks.post_process.logger", mock_logger):
                self.call_post_process_group(
                    is_new=True,
                    is_regression=False,
                    is_new_group_environment=True,
                    event=event,
                    cache_key="total_rubbish",
                )

        assert mock_process_func.call_count == 0
        assert mock_logger.error.call_count == 1

    @pytest.mark.skip(
        reason="Skip this test since there's no way to have issueless events in the issue platform"
    )
    def test_issueless(self) -> None: ...

    def test_no_cache_abort(self) -> None:
        # We don't use the cache for generic issues, so skip this test
        pass

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared(self) -> None:
        pass

    @pytest.mark.skip(reason="those tests do not work with the given call_post_process_group impl")
    def test_processing_cache_cleared_with_commits(self) -> None:
        pass

    @pytest.mark.skip(reason="escalation detection is disabled for feedback issues")
    def test_invalidates_snooze(self) -> None:
        pass

    @pytest.mark.skip(reason="escalation detection is disabled for feedback issues")
    def test_invalidates_snooze_with_buffers(self) -> None:
        pass

    @pytest.mark.skip(reason="auto resolve is disabled for feedback issues")
    def test_group_inbox_regression(self) -> None:
        pass

    @pytest.mark.skip(reason="escalation detection is disabled for feedback issues")
    def test_forecast_in_activity(self) -> None:
        pass

    @pytest.mark.skip(reason="regression is disabled for feedback issues")
    def test_group_last_seen_buffer(self) -> None:
        pass

    @with_feature("organizations:expanded-sentry-apps-webhooks")
    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_feedback_sends_webhook_with_feature_flag(self, mock_delay: MagicMock) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.created"]
        )
        self.create_sentry_app_installation(organization=self.organization, slug=sentry_app.slug)

        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        mock_delay.assert_called_once_with(
            action="created", sender="Group", instance_id=event.group.id
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound.delay")
    def test_feedback_no_webhook_without_feature_flag(self, mock_delay: MagicMock) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.organization, events=["issue.created"]
        )
        self.create_sentry_app_installation(organization=self.organization, slug=sentry_app.slug)

        event = self.create_event(
            data={},
            project_id=self.project.id,
            feedback_type=FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        )

        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert not mock_delay.called


class ProcessDataForwardingTest(BasePostProgressGroupMixin, SnubaTestCase):
    DEFAULT_FORWARDER_CONFIGS = {
        DataForwarderProviderSlug.SQS: {
            "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789/test-queue",
            "region": "us-east-1",
            "access_key": "test-key",
            "secret_key": "test-secret",
        },
        DataForwarderProviderSlug.SPLUNK: {
            "instance_url": "https://splunk.example.com",
            "token": "test-token",
            "index": "main",
        },
        DataForwarderProviderSlug.SEGMENT: {
            "write_key": "test-write-key",
        },
    }

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
        )
        return cache_key

    def setup_forwarder(self, provider, is_enabled=True, **config_overrides):
        config = self.DEFAULT_FORWARDER_CONFIGS[provider].copy()
        config.update(config_overrides)

        data_forwarder = self.create_data_forwarder(
            organization=self.project.organization,
            provider=provider.value,  # Convert enum to string value
            config=config,
            is_enabled=is_enabled,
        )

        data_forwarder_project = self.create_data_forwarder_project(
            data_forwarder=data_forwarder,
            project=self.project,
            is_enabled=True,
        )

        return data_forwarder, data_forwarder_project

    @with_feature("organizations:data-forwarding-revamp-access")
    def test_process_data_forwarding_no_forwarders(self):
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.amazon_sqs.forwarder.AmazonSQSForwarder.forward_event")
    def test_process_data_forwarding_sqs_enabled(self, mock_forward):
        mock_forward.return_value = True
        _, data_forwarder_project = self.setup_forwarder(DataForwarderProviderSlug.SQS)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert mock_forward.call_count == 1
        call_args = mock_forward.call_args
        assert call_args[0][1] == data_forwarder_project

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.amazon_sqs.forwarder.AmazonSQSForwarder.forward_event")
    def test_process_data_forwarding_sqs_with_s3_bucket(self, mock_forward):
        """Test SQS forwarder with S3 bucket configured for large payloads."""
        mock_forward.return_value = True

        _, data_forwarder_project = self.setup_forwarder(
            DataForwarderProviderSlug.SQS, s3_bucket="my-sentry-events-bucket"
        )
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        # Verify the forwarder was called
        assert mock_forward.call_count == 1
        call_args = mock_forward.call_args
        assert call_args[0][1] == data_forwarder_project

        # Verify the config includes S3 bucket
        assert call_args[0][1].get_config()["s3_bucket"] == "my-sentry-events-bucket"

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.splunk.forwarder.SplunkForwarder.forward_event")
    def test_process_data_forwarding_splunk_enabled(self, mock_forward):
        mock_forward.return_value = True
        self.setup_forwarder(DataForwarderProviderSlug.SPLUNK)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert mock_forward.call_count == 1

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.segment.forwarder.SegmentForwarder.forward_event")
    def test_process_data_forwarding_segment_enabled(self, mock_forward):
        mock_forward.return_value = True
        self.setup_forwarder(DataForwarderProviderSlug.SEGMENT)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert mock_forward.call_count == 1

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.amazon_sqs.forwarder.AmazonSQSForwarder.forward_event")
    def test_process_data_forwarding_disabled_forwarder(self, mock_forward):
        self.setup_forwarder(DataForwarderProviderSlug.SQS, is_enabled=False)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert mock_forward.call_count == 0

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.amazon_sqs.forwarder.AmazonSQSForwarder.forward_event")
    @patch("data_forwarding.splunk.forwarder.SplunkForwarder.forward_event")
    def test_process_data_forwarding_multiple_forwarders(
        self, mock_splunk_forward, mock_sqs_forward
    ):
        mock_sqs_forward.return_value = True
        mock_splunk_forward.return_value = True

        self.setup_forwarder(DataForwarderProviderSlug.SQS)
        self.setup_forwarder(DataForwarderProviderSlug.SPLUNK)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        assert mock_sqs_forward.call_count == 1
        assert mock_splunk_forward.call_count == 1

    @with_feature("organizations:data-forwarding-revamp-access")
    @patch("data_forwarding.amazon_sqs.forwarder.AmazonSQSForwarder.forward_event")
    @patch("data_forwarding.splunk.forwarder.SplunkForwarder.forward_event")
    def test_process_data_forwarding_one_forwarder_fails(
        self, mock_splunk_forward, mock_sqs_forward
    ):
        """Test that when one forwarder fails, other forwarders still execute."""
        mock_sqs_forward.side_effect = Exception("SQS connection failed")
        mock_splunk_forward.return_value = True

        self.setup_forwarder(DataForwarderProviderSlug.SQS)
        self.setup_forwarder(DataForwarderProviderSlug.SPLUNK)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        # Both forwarders should be called despite SQS failure
        assert mock_sqs_forward.call_count == 1
        assert mock_splunk_forward.call_count == 1

    @patch("data_forwarding.amazon_sqs.forwarder.AmazonSQSForwarder.forward_event")
    def test_process_data_forwarding_revamp_access_flag_disabled(self, mock_forward):
        """Test that data forwarding is skipped when the revamp-access feature flag is disabled."""
        self.setup_forwarder(DataForwarderProviderSlug.SQS)
        event = self.create_event(
            data={"message": "test message", "level": "error"},
            project_id=self.project.id,
        )
        self.call_post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=False,
            event=event,
        )

        # should not be called when feature flag is disabled
        assert mock_forward.call_count == 0
