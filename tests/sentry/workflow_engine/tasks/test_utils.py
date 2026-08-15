from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.models.activity import Activity
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.workflow_engine.tasks.utils import (
    EventNotFoundError,
    ProjectNotActiveError,
    build_workflow_event_data_from_activity,
    build_workflow_event_data_from_event,
)


class TestBuildWorkflowEventDataFromEvent(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def test_raises_for_pending_deletion_project(self) -> None:
        self.project.update(status=ObjectStatus.PENDING_DELETION)

        with (
            mock.patch(
                "sentry.workflow_engine.tasks.utils.nodestore.backend.get",
                return_value={"event_id": "fake-event-id", "project": self.project.id},
            ),
            pytest.raises(ProjectNotActiveError),
        ):
            build_workflow_event_data_from_event(
                event_id="fake-event-id",
                group_id=self.group.id,
            )

    def test_raises_for_deletion_in_progress_project(self) -> None:
        self.project.update(status=ObjectStatus.DELETION_IN_PROGRESS)

        with (
            mock.patch(
                "sentry.workflow_engine.tasks.utils.nodestore.backend.get",
                return_value={"event_id": "fake-event-id", "project": self.project.id},
            ),
            pytest.raises(ProjectNotActiveError),
        ):
            build_workflow_event_data_from_event(
                event_id="fake-event-id",
                group_id=self.group.id,
            )

    def test_raises_event_not_found(self) -> None:
        with (
            mock.patch(
                "sentry.workflow_engine.tasks.utils.nodestore.backend.get", return_value=None
            ),
            pytest.raises(EventNotFoundError),
        ):
            build_workflow_event_data_from_event(
                event_id="nonexistent-event-id",
                group_id=self.group.id,
            )

    def test_returns_workflow_event_data(self) -> None:
        with mock.patch(
            "sentry.workflow_engine.tasks.utils.nodestore.backend.get",
            return_value={"event_id": "test-event-id", "project": self.project.id},
        ):
            result = build_workflow_event_data_from_event(
                event_id="test-event-id",
                group_id=self.group.id,
            )

        assert isinstance(result.event, GroupEvent)
        assert result.event.event_id == "test-event-id"
        assert result.group.id == self.group.id


class TestBuildWorkflowEventDataFromActivity(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group(project=self.project)
        self.activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        self.activity.save()

    def test_returns_workflow_event_data(self) -> None:
        # Without a GroupActionLogEntry, only the activity is attached.
        result = build_workflow_event_data_from_activity(
            activity_id=self.activity.id,
            group_id=self.group.id,
        )
        assert result.event == self.activity
        assert result.group == self.group
        assert result.group_action_log_entry is None

        # When a GroupActionLogEntry id is passed, the entry is attached too.
        entry = self.create_group_action_log_entry(group=self.group)
        result = build_workflow_event_data_from_activity(
            activity_id=self.activity.id,
            group_id=self.group.id,
            group_action_log_entry_id=entry.id,
        )
        assert result.event == self.activity
        assert result.group == self.group
        assert result.group_action_log_entry == entry
