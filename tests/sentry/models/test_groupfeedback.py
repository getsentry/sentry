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
        GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        updated_feedback, created = GroupFeedback.objects.update_or_create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
            defaults={"feedback": True},
        )
        assert not created
        assert updated_feedback.feedback
        assert GroupFeedback.objects.count() == 1

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

    def test_user_can_provide_feedback_on_different_commits_same_group(self):
        repo = self.create_repo(project=self.project)
        commit2 = self.create_commit(
            repo=repo,
            project=self.project,
            key="another commit sha",
        )

        GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        feedback2 = GroupFeedback.objects.create(
            project=self.project,
            commit=commit2,
            group=self.group,
            user_id=self.user.id,
            feedback=True,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        assert feedback2.feedback is True
        assert GroupFeedback.objects.count() == 2

    def test_user_can_provide_feedback_on_multiple_groups(self):
        group2 = self.create_group(project=self.project)

        GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        feedback2 = GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=group2,
            user_id=self.user.id,
            feedback=True,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        assert feedback2.group == group2
        assert GroupFeedback.objects.count() == 2

    def test_multiple_deleted_users_can_leave_feedback(self):
        user2 = self.create_user()

        feedback1 = GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            feedback=False,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        feedback2 = GroupFeedback.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=user2.id,
            feedback=True,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        # delete users
        feedback1.user_id = None
        feedback1.save()
        feedback2.user_id = None
        feedback2.save()

        deleted_user_feedbacks = GroupFeedback.objects.filter(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=None,
            source=GroupFeedbackType.USER_SUSPECT_COMMIT_FEEDBACK.value,
        )

        assert deleted_user_feedbacks.count() == 2
        assert GroupFeedback.objects.count() == 2
