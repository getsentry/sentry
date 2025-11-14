from typing import int
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.issue_assigned import IssueAssignedEvent
from sentry.analytics.events.issue_priority import IssuePriorityUpdatedEvent
from sentry.analytics.events.issue_resolved import IssueResolvedEvent
from sentry.analytics.events.issue_unresolved import IssueUnresolvedEvent
from sentry.models.groupassignee import GroupAssignee
from sentry.signals import (
    issue_assigned,
    issue_mark_reviewed,
    issue_resolved,
    issue_unignored,
    issue_unresolved,
    issue_update_priority,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event


class SignalsTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team])

    @patch("sentry.analytics.record")
    def test_unignored_manually(self, mock_record: MagicMock) -> None:
        issue_unignored.send(
            project=self.project,
            group=self.group,
            user_id=self.owner.id,
            transition_type="manual",
            sender=type(self.project),
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_unignored_automatically(self, mock_record: MagicMock) -> None:
        issue_unignored.send(
            project=self.project,
            group=self.group,
            user_id=None,
            transition_type="automatic",
            sender="clear_expired_snoozes",
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_mark_reviewed(self, mock_record: MagicMock) -> None:
        issue_mark_reviewed.send(
            project=self.project, group=self.group, user=None, sender="test_mark_reviewed"
        )
        assert mock_record.called

    @patch("sentry.analytics.record")
    def test_update_priority(self, mock_record: MagicMock) -> None:
        issue_update_priority.send(
            project=self.project,
            group=self.group,
            new_priority="high",
            previous_priority="low",
            user_id=2,
            sender="test_update_priority",
            reason="reason",
        )
        assert_last_analytics_event(
            mock_record,
            IssuePriorityUpdatedEvent(
                group_id=self.group.id,
                new_priority="high",
                organization_id=self.organization.id,
                project_id=self.project.id,
                user_id=2,
                previous_priority="low",
                reason="reason",
                issue_category="error",
                issue_type="error",
            ),
        )

    @patch("sentry.analytics.record")
    def test_issue_resolved_with_default_owner(self, mock_record: MagicMock) -> None:
        """Test analytics is called with default owner ID when no user is provided"""

        issue_resolved.send(
            organization_id=self.organization.id,
            project=self.project,
            group=self.group,
            user=None,
            resolution_type="now",
            sender=type(self.project),
        )
        assert_last_analytics_event(
            mock_record,
            IssueResolvedEvent(
                user_id=None,
                project_id=self.project.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                group_id=self.group.id,
                resolution_type="now",
                issue_type="error",
                issue_category="error",
            ),
        )

    @patch("sentry.analytics.record")
    def test_issue_resolved_without_default_owner(self, mock_record: MagicMock) -> None:
        """Test analytics is called with 'unknown' when no user or default owner exists"""
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        issue_resolved.send(
            organization_id=organization.id,
            project=project,
            group=group,
            user=None,
            resolution_type="now",
            sender=type(project),
        )
        assert_last_analytics_event(
            mock_record,
            IssueResolvedEvent(
                user_id=None,
                project_id=project.id,
                default_user_id="unknown",
                organization_id=organization.id,
                group_id=group.id,
                resolution_type="now",
                issue_type="error",
                issue_category="error",
            ),
        )

    @patch("sentry.analytics.record")
    def test_issue_unresolved_with_default_owner(self, mock_record: MagicMock) -> None:
        """Test analytics is called with default owner ID when no user is provided"""
        issue_unresolved.send(
            project=self.project,
            group=self.group,
            user=None,
            transition_type="manual",
            sender=type(self.project),
        )
        assert_last_analytics_event(
            mock_record,
            IssueUnresolvedEvent(
                user_id=None,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                group_id=self.group.id,
                transition_type="manual",
            ),
        )

    @patch("sentry.analytics.record")
    def test_issue_unresolved_without_default_owner(self, mock_record: MagicMock) -> None:
        """Test analytics is called with 'unknown' when no user or default owner exists"""
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)

        issue_unresolved.send(
            project=project,
            group=group,
            user=None,
            transition_type="manual",
            sender=type(project),
        )
        assert_last_analytics_event(
            mock_record,
            IssueUnresolvedEvent(
                user_id=None,
                default_user_id="unknown",
                organization_id=organization.id,
                group_id=group.id,
                transition_type="manual",
            ),
        )

    @patch("sentry.analytics.record")
    def test_issue_assigned_with_default_owner(self, mock_record: MagicMock) -> None:
        """Test analytics is called with default owner ID when no user is provided"""
        GroupAssignee.objects.create(
            group_id=self.group.id, user_id=self.owner.id, project_id=self.project.id
        )
        issue_assigned.send(
            project=self.project,
            group=self.group,
            user=None,
            transition_type="manual",
            sender=type(self.project),
        )
        assert_last_analytics_event(
            mock_record,
            IssueAssignedEvent(
                user_id=None,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                group_id=self.group.id,
            ),
        )

    @patch("sentry.analytics.record")
    def test_issue_assigned_without_default_owner(self, mock_record: MagicMock) -> None:
        """Test analytics is called with 'unknown' when no user or default owner exists"""
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group = self.create_group(project=project)
        GroupAssignee.objects.create(
            group_id=group.id, user_id=self.owner.id, project_id=project.id
        )

        issue_assigned.send(
            project=project,
            group=group,
            user=None,
            transition_type="manual",
            sender=type(project),
        )
        assert_last_analytics_event(
            mock_record,
            IssueAssignedEvent(
                user_id=None,
                default_user_id="unknown",
                organization_id=organization.id,
                group_id=group.id,
            ),
        )
