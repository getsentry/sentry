from __future__ import annotations

from pathlib import Path
from unittest import mock

import pytest
from django.db import IntegrityError, router, transaction
from rest_framework.exceptions import ValidationError

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel
from sentry.investigations.contracts import validate_query_result
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockParameter,
    InvestigationCell,
    InvestigationCellDependency,
    InvestigationCellExecution,
    InvestigationCellExecutionProject,
    InvestigationCellParameter,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationPermissions,
    InvestigationPermissionsTeam,
    InvestigationProject,
    InvestigationSourceType,
)
from sentry.investigations.services.investigations import create_template_investigation
from sentry.testutils.cases import TestCase
from sentry.utils import json


class InvestigationModelTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Investigation",
        )
        self.cell = self.create_investigation_cell(investigation=self.investigation)

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

    def test_public_entities_use_inherent_primary_keys(self) -> None:
        models = (
            Investigation,
            InvestigationCell,
            InvestigationParameter,
            InvestigationCellExecution,
        )

        assert all("uuid" not in {field.name for field in model._meta.fields} for model in models)

    def assert_invalid_source_fields(
        self, *, source_type: str, source_key: str | None, source_revision: int | None
    ) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(Investigation)),
        ):
            self.create_investigation(
                organization=self.organization,
                created_by=self.user,
                title="Invalid source",
                source_type=source_type,
                source_key=source_key,
                source_revision=source_revision,
            )

    def test_manual_source_cannot_have_lineage_fields(self) -> None:
        self.assert_invalid_source_fields(
            source_type=InvestigationSourceType.MANUAL,
            source_key="source",
            source_revision=1,
        )

    def test_source_backed_investigation_requires_key_and_revision(self) -> None:
        self.assert_invalid_source_fields(
            source_type=InvestigationSourceType.ISSUE,
            source_key=None,
            source_revision=None,
        )
        self.assert_invalid_source_fields(
            source_type=InvestigationSourceType.ISSUE,
            source_key="source",
            source_revision=None,
        )
        self.assert_invalid_source_fields(
            source_type=InvestigationSourceType.ISSUE,
            source_key=None,
            source_revision=1,
        )

    def test_source_revision_is_unique_within_lineage(self) -> None:
        values = {
            "organization": self.organization,
            "created_by": self.user,
            "source_type": InvestigationSourceType.ISSUE,
            "source_key": "issue:1",
            "source_revision": 1,
        }
        self.create_investigation(title="First", **values)

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(Investigation)),
        ):
            self.create_investigation(title="Duplicate", **values)

        second = self.create_investigation(title="Second", **{**values, "source_revision": 2})
        assert second.source_revision == 2

    def test_validation_constraints_are_persisted(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
            validation_constraints={"maxLength": 64},
        )
        assert parameter.validation_constraints == {"maxLength": 64}

    def test_dependency_cannot_reference_itself(self) -> None:
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(using=router.db_for_write(InvestigationCellDependency)),
        ):
            self.create_investigation_cell_dependency(cell=self.cell, depends_on=self.cell)

    def test_relationship_models_record_timestamps(self) -> None:
        project = self.create_project(organization=self.organization)
        project_link = self.create_investigation_project(
            investigation=self.investigation, project=project
        )
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        parameter_link = self.create_investigation_cell_parameter(
            cell=self.cell, parameter=parameter
        )
        execution = self.create_investigation_cell_execution(
            cell=self.cell,
            executor="manual",
            cell_version=1,
            input_fingerprint="f" * 64,
        )
        execution_project = self.create_investigation_cell_execution_project(
            execution=execution, project=project
        )

        assert project_link.date_added is not None
        assert parameter_link.date_added is not None
        assert execution_project.date_added is not None

    def test_permission_requires_active_team_membership(self) -> None:
        team = self.create_team(organization=self.organization)
        permissions = self.create_investigation_permissions(
            investigation=self.investigation,
            teams=[team],
            is_editable_by_everyone=False,
        )
        editor = self.create_user()
        member = self.create_member(
            organization=self.organization, user=editor, role="member", teams=[]
        )

        assert not permissions.has_edit_permissions(editor.id)
        membership = self.create_team_membership(team=team, member=member)
        assert permissions.has_edit_permissions(editor.id)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        assert not permissions.has_edit_permissions(editor.id)

    def test_permissions_use_default_timestamp_fields(self) -> None:
        assert issubclass(InvestigationPermissions, DefaultFieldsModel)

    def test_all_investigation_models_are_excluded_from_relocation(self) -> None:
        models = (
            Investigation,
            InvestigationProject,
            InvestigationFavoriteUser,
            InvestigationBlock,
            InvestigationBlockDependency,
            InvestigationBlockParameter,
            InvestigationBlockExecution,
            InvestigationBlockExecutionProject,
            InvestigationCell,
            InvestigationCellDependency,
            InvestigationParameter,
            InvestigationCellParameter,
            InvestigationCellExecution,
            InvestigationCellExecutionProject,
            InvestigationPermissions,
            InvestigationPermissionsTeam,
        )
        assert all(model.__relocation_scope__ == RelocationScope.Excluded for model in models)

    def test_block_schema_is_independent_from_cell_schema(self) -> None:
        block = self.create_investigation_block(investigation=self.investigation)
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="project",
            label="Project",
            type="project",
            position=0,
        )
        parameter_link = self.create_investigation_block_parameter(block=block, parameter=parameter)
        execution = self.create_investigation_block_execution(
            block=block,
            executor="manual",
            block_version=1,
            input_fingerprint="b" * 64,
        )

        assert block._meta.db_table == "investigations_investigationblock"
        assert block.investigation.blocks.get() == block
        assert parameter_link.block == block
        assert execution.block == block
        assert self.cell.investigation.cells.get() == self.cell


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


def test_template_creation_retries_revision_uniqueness_collisions() -> None:
    created = mock.sentinel.investigation
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=[IntegrityError(), created],
    ) as create:
        result = create_template_investigation(
            organization=mock.sentinel.organization,
            user_id=1,
            template_key="breached_metric",
            template_version=1,
            source_ref={},
            supplied_parameters={},
            accessible_project_ids=set(),
        )

    assert result is created
    assert create.call_count == 2


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


def test_query_result_contract_rejects_non_bar_category_chart() -> None:
    fixture = Path(__file__).parents[2] / "fixtures" / "investigation_query_result_v1.json"
    payload = json.loads(fixture.read_text())
    payload["chart"]["x_axis"] = "category"
    payload["chart"]["visualization"] = "line"

    with pytest.raises(ValidationError):
        validate_query_result(payload)
