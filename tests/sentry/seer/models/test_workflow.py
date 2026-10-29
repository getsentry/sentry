import pytest
from django.db import IntegrityError, router, transaction
from pydantic import ValidationError

from sentry.notebooks.models.notebook import Notebook
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SEER_LEGACY_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowFilters,
    SeerWorkflowOutput,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class SeerWorkflowConfigTest(TestCase):
    def test_every_strategy_is_legacy_or_configurable(self) -> None:
        assert SEER_LEGACY_WORKFLOW_STRATEGIES | SEER_CONFIGURABLE_WORKFLOW_STRATEGIES == set(
            SeerWorkflowStrategy
        )
        assert not SEER_LEGACY_WORKFLOW_STRATEGIES & SEER_CONFIGURABLE_WORKFLOW_STRATEGIES

    def test_get_or_create_for_strategy_rejects_configurable_strategy(self) -> None:
        with pytest.raises(ValueError):
            SeerWorkflowConfig.get_or_create_for_strategy(
                self.organization.id,
                SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            )

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_legacy_lookup_rejects_breached_metric_automations(self) -> None:
        with pytest.raises(ValueError):
            SeerWorkflowConfig.get_or_create_for_strategy(
                self.organization.id,
                SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            )

        assert not SeerWorkflowConfig.objects.filter(organization=self.organization).exists()

    def test_legacy_strategy_has_one_config_per_organization_and_v2_has_many(self) -> None:
        legacy = SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        assert legacy == SeerWorkflowConfig.get_or_create_for_strategy(
            self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(SeerWorkflowConfig)),
        ):
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE
            )

        v2_configs = [
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
            for _ in range(2)
        ]

        assert v2_configs[0] != v2_configs[1]
        assert (
            SeerWorkflowConfig.get_or_create_for_strategy(
                self.organization.id, SeerWorkflowStrategy.AGENTIC_TRIAGE
            )
            == legacy
        )


def test_filters_default_to_selected_projects_in_all_environments() -> None:
    filters = SeerWorkflowFilters.parse_obj({})

    assert filters.all_projects is False
    assert filters.environments == []


def test_filters_read_saved_values_and_ignore_unknown_keys() -> None:
    filters = SeerWorkflowFilters.parse_obj(
        {"all_projects": True, "environments": ["production"], "min_event_count": 10}
    )

    assert filters.all_projects is True
    assert filters.environments == ["production"]


@pytest.mark.parametrize("filters", [{"all_projects": "maybe"}, {"environments": "production"}])
def test_filters_reject_wrong_types(filters: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        SeerWorkflowFilters.parse_obj(filters)


class SeerWorkflowOutputTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        run = Factories.create_seer_workflow_run(self.organization)
        self.execution = Factories.create_seer_workflow_run_execution(run)
        self.notebook = self.create_notebook()

    def create_notebook(self) -> Notebook:
        return Notebook.objects.create(organization=self.organization, title="Notebook")

    def test_execution_links_many_notebooks(self) -> None:
        other_notebook = self.create_notebook()
        SeerWorkflowOutput.objects.create(execution=self.execution, notebook=self.notebook)
        SeerWorkflowOutput.objects.create(execution=self.execution, notebook=other_notebook)

        assert {output.notebook_id for output in self.execution.outputs.all()} == {
            self.notebook.id,
            other_notebook.id,
        }

    def test_notebook_links_executions_from_many_runs(self) -> None:
        other_run = Factories.create_seer_workflow_run(self.organization)
        other_execution = Factories.create_seer_workflow_run_execution(other_run)
        SeerWorkflowOutput.objects.create(execution=self.execution, notebook=self.notebook)
        SeerWorkflowOutput.objects.create(execution=other_execution, notebook=self.notebook)

        assert {output.execution_id for output in self.notebook.workflow_outputs.all()} == {
            self.execution.id,
            other_execution.id,
        }

    def test_rejects_duplicate_notebook_link(self) -> None:
        SeerWorkflowOutput.objects.create(execution=self.execution, notebook=self.notebook)

        with pytest.raises(IntegrityError):
            with transaction.atomic(using=router.db_for_write(SeerWorkflowOutput)):
                SeerWorkflowOutput.objects.create(execution=self.execution, notebook=self.notebook)

    def test_allows_many_outputs_without_a_notebook(self) -> None:
        SeerWorkflowOutput.objects.create(execution=self.execution)
        SeerWorkflowOutput.objects.create(execution=self.execution)

        assert self.execution.outputs.count() == 2

    def test_deleting_execution_deletes_its_outputs(self) -> None:
        SeerWorkflowOutput.objects.create(execution=self.execution, notebook=self.notebook)

        self.execution.delete()

        assert not SeerWorkflowOutput.objects.exists()
        assert Notebook.objects.filter(id=self.notebook.id).exists()

    def test_deleting_notebook_deletes_its_outputs(self) -> None:
        SeerWorkflowOutput.objects.create(execution=self.execution, notebook=self.notebook)

        self.notebook.delete()

        assert not SeerWorkflowOutput.objects.exists()
        assert SeerWorkflowRunExecution.objects.filter(id=self.execution.id).exists()
