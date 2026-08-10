from __future__ import annotations

import pytest
from django.db import IntegrityError, router, transaction

from sentry.backup.scopes import RelocationScope
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
    InvestigationProject,
    InvestigationSourceType,
)
from sentry.testutils.cases import TestCase


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
