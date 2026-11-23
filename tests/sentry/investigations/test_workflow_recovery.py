from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.workflow_runtime import (
    PAUSED_RECOVERY_INTERVAL,
    reserve_due_nodes,
    save_nodes,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook
from sentry.tasks.seer.investigation import expire_workflow_runs
from sentry.testutils.cases import TestCase


class WorkflowRecoveryTest(TestCase):
    def make_run(self, organization: Organization, notebook_id: int | None) -> WorkflowRun:
        return WorkflowRun.objects.create(
            organization=organization,
            uuid=uuid4(),
            request_id=uuid4(),
            user_id=self.user.id,
            definition={},
            checkpoint={"notebook_id": notebook_id},
        )

    def test_due_nodes_are_grouped_by_organization_and_reserved_before_redelivery(self) -> None:
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

    def test_missed_resume_is_recovered_behind_a_full_batch(self) -> None:
        run = self.make_run(self.organization, None)
        now = timezone.now()
        paused = uuid4()
        checkpoint = {
            "id": str(paused),
            "node_id": "scan",
            "workflow_run_id": str(run.uuid),
            "organization_id": self.organization.id,
            "status": "awaiting_input",
            "state": {},
            "attempt": 1,
            "item_index": None,
            "explorer_run_id": 42,
            "next_check_at": None,
        }
        save_nodes(run, [checkpoint])
        node = WorkflowNodeRun.objects.get(uuid=paused)
        assert node.next_check_at is not None
        assert node.next_check_at >= now + PAUSED_RECOVERY_INTERVAL
        WorkflowNodeRun.objects.bulk_create(
            [
                WorkflowNodeRun(
                    run=run, uuid=uuid4(), checkpoint={}, next_check_at=now - timedelta(minutes=1)
                )
                for _ in range(100)
            ]
        )
        WorkflowNodeRun.objects.filter(pk=node.pk).update(next_check_at=now)
        assert str(paused) not in reserve_due_nodes()[self.organization.id]
        assert reserve_due_nodes() == {self.organization.id: [str(paused)]}
        node.refresh_from_db()
        assert node.next_check_at is not None
        assert node.next_check_at >= now + PAUSED_RECOVERY_INTERVAL
        assert reserve_due_nodes() == {}
        save_nodes(run, [{**checkpoint, "next_check_at": now.isoformat()}])
        assert reserve_due_nodes() == {self.organization.id: [str(paused)]}

    def test_retention_uses_creation_date_and_preserves_notebook(self) -> None:
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
