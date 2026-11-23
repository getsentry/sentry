from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.workflow_runtime import reserve_due_nodes
from sentry.notebooks.models import Notebook
from sentry.tasks.seer.investigation import expire_workflow_runs
from sentry.testutils.cases import TestCase


class WorkflowRecoveryTest(TestCase):
    def make_run(self, organization, notebook_id):
        return WorkflowRun.objects.create(
            organization=organization,
            uuid=uuid4(),
            request_id=uuid4(),
            user_id=self.user.id,
            definition={},
            checkpoint={"notebook_id": notebook_id},
        )

    def test_due_nodes_are_grouped_by_organization_and_reserved_before_redelivery(self):
        now = timezone.now()
        batches = {}
        for org in (self.organization, self.create_organization()):
            run = self.make_run(org, None)
            due = WorkflowNodeRun.objects.create(
                run=run, uuid=uuid4(), checkpoint={}, next_check_at=now
            )
            WorkflowNodeRun.objects.create(run=run, uuid=uuid4(), checkpoint={}, next_check_at=None)
            batches[org.id] = [str(due.uuid)]
        assert reserve_due_nodes() == batches
        assert reserve_due_nodes() == {}

    def test_retention_uses_creation_date_and_preserves_notebook(self):
        notebook = Notebook.objects.create(
            organization=self.organization, created_by_id=self.user.id, title="Retained notebook"
        )
        current = self.make_run(self.organization, notebook.id)
        current_node = WorkflowNodeRun.objects.create(run=current, uuid=uuid4(), checkpoint={})
        for org in (self.organization, self.create_organization()):
            expired = self.make_run(org, notebook.id if org == self.organization else None)
            WorkflowNodeRun.objects.create(run=expired, uuid=uuid4(), checkpoint={})
            WorkflowRun.objects.filter(pk=expired.pk).update(
                date_added=timezone.now() - timedelta(days=92)
            )
        expire_workflow_runs()
        assert list(WorkflowRun.objects.values_list("pk", flat=True)) == [current.pk]
        assert list(WorkflowNodeRun.objects.values_list("pk", flat=True)) == [current_node.pk]
        assert Notebook.objects.filter(pk=notebook.pk).exists()
