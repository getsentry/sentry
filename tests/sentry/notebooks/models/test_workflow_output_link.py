import pytest
from django.db import IntegrityError, router, transaction

from sentry.notebooks.models.notebook import Notebook
from sentry.notebooks.models.workflow_output_link import SeerWorkflowOutputLink
from sentry.seer.models.workflow import SeerWorkflowRunExecution
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class SeerWorkflowOutputLinkTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        run = Factories.create_seer_workflow_run(self.organization)
        self.execution = Factories.create_seer_workflow_run_execution(run)
        self.notebook = self.create_notebook()

    def create_notebook(self) -> Notebook:
        return Notebook.objects.create(organization=self.organization, title="Notebook")

    def test_execution_links_many_notebooks(self) -> None:
        other_notebook = self.create_notebook()
        SeerWorkflowOutputLink.objects.create(execution=self.execution, notebook=self.notebook)
        SeerWorkflowOutputLink.objects.create(execution=self.execution, notebook=other_notebook)

        assert {link.notebook_id for link in self.execution.output_links.all()} == {
            self.notebook.id,
            other_notebook.id,
        }

    def test_notebook_links_executions_from_many_runs(self) -> None:
        other_run = Factories.create_seer_workflow_run(self.organization)
        other_execution = Factories.create_seer_workflow_run_execution(other_run)
        SeerWorkflowOutputLink.objects.create(execution=self.execution, notebook=self.notebook)
        SeerWorkflowOutputLink.objects.create(execution=other_execution, notebook=self.notebook)

        assert {link.execution_id for link in self.notebook.workflow_output_links.all()} == {
            self.execution.id,
            other_execution.id,
        }

    def test_rejects_duplicate_notebook_link(self) -> None:
        SeerWorkflowOutputLink.objects.create(execution=self.execution, notebook=self.notebook)

        with pytest.raises(IntegrityError):
            with transaction.atomic(using=router.db_for_write(SeerWorkflowOutputLink)):
                SeerWorkflowOutputLink.objects.create(
                    execution=self.execution, notebook=self.notebook
                )

    def test_allows_many_links_without_a_notebook(self) -> None:
        SeerWorkflowOutputLink.objects.create(execution=self.execution)
        SeerWorkflowOutputLink.objects.create(execution=self.execution)

        assert self.execution.output_links.count() == 2

    def test_deleting_execution_deletes_its_links(self) -> None:
        SeerWorkflowOutputLink.objects.create(execution=self.execution, notebook=self.notebook)

        self.execution.delete()

        assert not SeerWorkflowOutputLink.objects.exists()
        assert Notebook.objects.filter(id=self.notebook.id).exists()

    def test_deleting_notebook_deletes_its_links(self) -> None:
        SeerWorkflowOutputLink.objects.create(execution=self.execution, notebook=self.notebook)

        self.notebook.delete()

        assert not SeerWorkflowOutputLink.objects.exists()
        assert SeerWorkflowRunExecution.objects.filter(id=self.execution.id).exists()
