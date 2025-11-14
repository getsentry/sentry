from typing import int
import pytest
from django.db import IntegrityError

from sentry.models.groupreaction import GroupReaction, GroupReactionType
from sentry.testutils.cases import TestCase


class GroupReactionTest(TestCase):
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
            GroupReaction.objects.create(
                project=self.project,
                commit=None,
                group=None,
                user_id=self.user.id,
                reaction=False,
                source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
            )

    def test_unique_constraint_commit_group(self):
        GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            reaction=False,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        updated_reaction, created = GroupReaction.objects.update_or_create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
            defaults={"reaction": True},
        )
        assert not created
        assert updated_reaction.reaction
        assert GroupReaction.objects.count() == 1

        with pytest.raises(IntegrityError):
            GroupReaction.objects.create(
                project=self.project,
                commit=self.commit,
                group=self.group,
                user_id=self.user.id,
                reaction=True,
                source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
            )

    def test_unique_constraint_project_wide_exclusion(self):
        GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=None,
            user_id=self.user.id,
            reaction=False,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        with pytest.raises(IntegrityError):
            GroupReaction.objects.create(
                project=self.project,
                commit=self.commit,
                group=None,
                user_id=self.user.id,
                reaction=True,
                source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
            )

    def test_unique_constraint_group_exclusion(self):
        GroupReaction.objects.create(
            project=self.project,
            commit=None,
            group=self.group,
            user_id=self.user.id,
            reaction=False,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        with pytest.raises(IntegrityError):
            GroupReaction.objects.create(
                project=self.project,
                commit=None,
                group=self.group,
                user_id=self.user.id,
                reaction=True,
                source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
            )

    def test_user_can_react_to_different_commits_same_group(self):
        repo = self.create_repo(project=self.project)
        commit2 = self.create_commit(
            repo=repo,
            project=self.project,
            key="another commit sha",
        )

        GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            reaction=False,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        reaction2 = GroupReaction.objects.create(
            project=self.project,
            commit=commit2,
            group=self.group,
            user_id=self.user.id,
            reaction=True,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        assert reaction2.reaction is True
        assert GroupReaction.objects.count() == 2

    def test_user_can_react_to_multiple_groups(self):
        group2 = self.create_group(project=self.project)

        GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            reaction=False,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        reaction2 = GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=group2,
            user_id=self.user.id,
            reaction=True,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        assert reaction2.group == group2
        assert GroupReaction.objects.count() == 2

    def test_multiple_deleted_users_can_react(self):
        user2 = self.create_user()

        reaction1 = GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=self.user.id,
            reaction=False,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        reaction2 = GroupReaction.objects.create(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=user2.id,
            reaction=True,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        # delete users
        reaction1.user_id = None
        reaction1.save()
        reaction2.user_id = None
        reaction2.save()

        deleted_user_reactions = GroupReaction.objects.filter(
            project=self.project,
            commit=self.commit,
            group=self.group,
            user_id=None,
            source=GroupReactionType.USER_SUSPECT_COMMIT_REACTION.value,
        )

        assert deleted_user_reactions.count() == 2
        assert GroupReaction.objects.count() == 2
