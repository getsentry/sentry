import pytest
from django.db import IntegrityError

from sentry.models.groupfeedback import GroupFeedback
from sentry.testutils.cases import TestCase


class GroupFeedbackTest(TestCase):
    def test_check_constraint_both_null_fails(self):
        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit_sha=None,
                group=None,
                user_id=self.user.id,
                feedback=False,
            )

    def test_unique_constraint_commit_group(self):
        """UniqueConstraint: one row per user per commit+group"""
        GroupFeedback.objects.create(
            project=self.project,
            commit_sha="abc123",
            group=self.group,
            user_id=self.user.id,
            feedback=False,
        )

        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit_sha="abc123",
                group=self.group,
                user_id=self.user.id,
                feedback=True,
            )

    def test_unique_constraint_project_wide_exclusion(self):
        """UniqueConstraint: one row per user per project-wide commit"""
        GroupFeedback.objects.create(
            project=self.project,
            commit_sha="def456",
            group=None,
            user_id=self.user.id,
            feedback=False,
        )

        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit_sha="def456",
                group=None,
                user_id=self.user.id,
                feedback=True,
            )

    def test_unique_constraint_group_exclusion(self):
        """UniqueConstraint: one row per user per group exclusion"""
        GroupFeedback.objects.create(
            project=self.project,
            commit_sha=None,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
        )

        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit_sha=None,
                group=self.group,
                user_id=self.user.id,
                feedback=True,
            )
