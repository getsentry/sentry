import pytest
from django.db import IntegrityError

from sentry.models.groupfeedback import GroupFeedback, GroupFeedbackType
from sentry.testutils.cases import TestCase


class GroupFeedbackTest(TestCase):
    def setUp(self):
        super().setUp()
        repo = self.create_repo(project=self.project)
        self.commit = self.create_commit(
            repo=repo,
            project=self.project,
            key="pretend this is a sha",
        )

    def test_check_constraint_both_null_fails(self):
        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit=None,
                group=None,
                user_id=self.user.id,
                feedback=False,
                source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
            )

    def test_unique_constraint_commit_group(self):
        """UniqueConstraint: one row per user per commit+group"""
        GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit=self.commit,
                group=self.group,
                user_id=self.user.id,
                feedback=True,
                source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
            )

    def test_unique_constraint_project_wide_exclusion(self):
        """UniqueConstraint: one row per user per project-wide commit"""
        GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=None,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit=self.commit,
                group=None,
                user_id=self.user.id,
                feedback=True,
                source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
            )

    def test_unique_constraint_group_exclusion(self):
        """UniqueConstraint: one row per user per group exclusion"""
        GroupFeedback.objects.create(
            project=self.project,
            commit=None,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        with pytest.raises(IntegrityError):
            GroupFeedback.objects.create(
                project=self.project,
                commit=None,
                group=self.group,
                user_id=self.user.id,
                feedback=True,
                source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
            )
