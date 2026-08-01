from __future__ import annotations

import pytest
from django.db import IntegrityError, router, transaction

from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellComment,
    InvestigationCellDependency,
    InvestigationCellReaction,
    InvestigationCommentReaction,
    InvestigationCommentTeamMention,
    InvestigationCommentUserMention,
)
from sentry.testutils.cases import TestCase


class InvestigationModelTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Model test"
        )
        self.cell = self.create_investigation_cell(investigation=self.investigation)
        self.comment = self.create_investigation_cell_comment(
            cell=self.cell, author=self.user, body="A comment"
        )

    def test_template_key_and_version_must_be_set_together(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(Investigation)),
        ):
            self.create_investigation(
                organization=self.organization,
                created_by=self.user,
                title="Invalid",
                template_key="breached_metric",
            )

    def test_dependency_cannot_reference_itself(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(InvestigationCellDependency)),
        ):
            self.create_investigation_cell_dependency(cell=self.cell, depends_on=self.cell)

    def test_reactions_are_unique_per_target_user_and_value(self) -> None:
        self.create_investigation_cell_reaction(cell=self.cell, user=self.user, reaction="heart")
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(InvestigationCellReaction)),
        ):
            self.create_investigation_cell_reaction(
                cell=self.cell, user=self.user, reaction="heart"
            )

        self.create_investigation_comment_reaction(
            comment=self.comment, user=self.user, reaction="eyes"
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(InvestigationCommentReaction)),
        ):
            self.create_investigation_comment_reaction(
                comment=self.comment, user=self.user, reaction="eyes"
            )

    def test_mentions_are_unique_per_comment_and_actor(self) -> None:
        self.create_investigation_comment_user_mention(comment=self.comment, user=self.user)
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(InvestigationCommentUserMention)),
        ):
            self.create_investigation_comment_user_mention(comment=self.comment, user=self.user)

        self.create_investigation_comment_team_mention(comment=self.comment, team=self.team)
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(InvestigationCommentTeamMention)),
        ):
            self.create_investigation_comment_team_mention(comment=self.comment, team=self.team)

    def test_collaboration_relations_are_in_the_investigations_app(self) -> None:
        models = (
            Investigation,
            InvestigationCell,
            InvestigationCellComment,
            InvestigationCellDependency,
            InvestigationCellReaction,
            InvestigationCommentReaction,
            InvestigationCommentTeamMention,
            InvestigationCommentUserMention,
        )
        assert {model._meta.app_label for model in models} == {"investigations"}
