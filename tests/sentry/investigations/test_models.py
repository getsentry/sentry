from __future__ import annotations

from pathlib import Path

import pytest
from django.db import IntegrityError, router, transaction
from rest_framework.exceptions import ValidationError

from sentry.investigations.contracts import validate_query_result
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
from sentry.utils import json


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

    def test_source_key_is_unique_within_an_organization(self) -> None:
        self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="First",
            source_type="breached_metric",
            source_key="source",
            status="archived",
        )

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(Investigation)),
        ):
            self.create_investigation(
                organization=self.organization,
                created_by=self.user,
                title="Second",
                source_type="breached_metric",
                source_key="source",
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


def test_query_result_contract_accepts_the_versioned_wire_shape() -> None:
    result = validate_query_result(
        {
            "schemaVersion": 1,
            "tableMarkdown": "| Time | Errors |\n| --- | ---: |\n| 2026-07-31 | 12 |",
            "chart": {
                "title": "Errors over time",
                "visualization": "area",
                "x_axis": "time",
                "y_axis_unit": "number",
                "series": [
                    {
                        "name": "count()",
                        "data": [{"x": "2026-07-31T12:00:00Z", "y": 12}],
                    }
                ],
            },
            "preferredView": "chart",
            "isEmpty": False,
            "chartUnavailableReason": None,
            "queryLinks": [],
        }
    )

    assert result["schemaVersion"] == 1
    assert result["preferredView"] == "chart"


def test_query_result_contract_rejects_unknown_versions() -> None:
    with pytest.raises(ValidationError):
        validate_query_result(
            {
                "schemaVersion": 2,
                "tableMarkdown": "| Result |\n| --- |",
                "chart": None,
                "preferredView": "table",
                "isEmpty": True,
                "chartUnavailableReason": "No numeric result.",
                "queryLinks": [],
            }
        )


def test_shared_golden_payload_round_trips_without_contract_drift() -> None:
    fixture = Path(__file__).parents[2] / "fixtures" / "investigation_query_result_v1.json"
    payload = json.loads(fixture.read_text())

    assert validate_query_result(payload) == payload


def test_query_result_contract_rejects_an_empty_chart_series() -> None:
    fixture = Path(__file__).parents[2] / "fixtures" / "investigation_query_result_v1.json"
    payload = json.loads(fixture.read_text())
    payload["chart"]["series"] = []

    with pytest.raises(ValidationError):
        validate_query_result(payload)
