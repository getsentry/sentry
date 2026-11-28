from datetime import timedelta
from typing import Any
from unittest.mock import call, patch
from uuid import uuid4

import orjson
from django.utils import timezone
from urllib3.exceptions import HTTPError
from urllib3.response import HTTPResponse

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.workflow_runtime import (
    PAUSED_RECOVERY_INTERVAL,
    RECOVERY_BATCH_SIZE,
    RECOVERY_CLAIM_TTL,
    claim_due_nodes,
    save_nodes,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook
from sentry.tasks.seer import investigation
from sentry.tasks.seer.investigation import (
    expire_workflow_runs,
    recover_workflow_nodes,
    recover_workflow_nodes_for_organization,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import metrics
from sentry.viewer_context import ActorType, get_viewer_context


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

    @freeze_time()
    def test_scheduler_rotates_even_when_publishing_fails_and_jobs_are_waiting(self) -> None:
        now = timezone.now()
        orgs = [self.organization, self.create_organization(), self.create_organization()]
        for index, org in enumerate(orgs, start=1):
            run = self.make_run(org, None)
            for _ in range(index):
                WorkflowNodeRun.objects.create(
                    run=run,
                    uuid=uuid4(),
                    checkpoint={},
                    next_check_at=now - timedelta(minutes=index),
                )
            WorkflowNodeRun.objects.create(run=run, uuid=uuid4(), checkpoint={}, next_check_at=None)
        with (
            patch.object(investigation, "RECOVERY_ORGS_PER_TICK", 2),
            patch.object(recover_workflow_nodes_for_organization, "delay") as enqueue,
            patch.object(metrics, "gauge") as gauge,
            patch.object(metrics, "distribution") as distribution,
        ):
            enqueue.side_effect = [RuntimeError("publish failed"), None, None, None]
            recover_workflow_nodes()
            assert enqueue.call_args_list == [call(organization_id=org.id) for org in orgs[:2]]
            gauge.assert_called_with(
                "seer.workflow.recovery.oldest_due_seconds", 180, unit="second"
            )
            distribution.assert_any_call("seer.workflow.recovery.organization_due_nodes", 2)
            distribution.assert_any_call(
                "seer.workflow.recovery.organization_oldest_due_seconds", 120, unit="second"
            )
            enqueue.reset_mock()
            recover_workflow_nodes()
            assert enqueue.call_args_list == [
                call(organization_id=orgs[2].id),
                call(organization_id=orgs[0].id),
            ]
            assert WorkflowNodeRun.objects.filter(next_check_at__lte=now).count() == 6

            WorkflowNodeRun.objects.update(next_check_at=now + timedelta(hours=1))
            enqueue.reset_mock()
            recover_workflow_nodes()
            enqueue.assert_not_called()
            gauge.assert_called_with("seer.workflow.recovery.oldest_due_seconds", 0, unit="second")

    @freeze_time()
    def test_workers_claim_independent_batches_when_one_organization_times_out(self) -> None:
        now = timezone.now()
        busy, other = self.organization, self.create_organization()
        busy_run = self.make_run(busy, None)
        busy_ids = [uuid4() for _ in range(RECOVERY_BATCH_SIZE + 1)]
        WorkflowNodeRun.objects.bulk_create(
            [
                WorkflowNodeRun(run=busy_run, uuid=node_id, checkpoint={}, next_check_at=now)
                for node_id in busy_ids
            ]
        )
        paused = WorkflowNodeRun.objects.create(
            run=self.make_run(other, None),
            uuid=uuid4(),
            checkpoint={"status": "awaiting_input", "next_check_at": None},
            next_check_at=now,
        )
        contexts = []

        def dispatch(*args: Any, **kwargs: Any) -> HTTPResponse:
            ctx = get_viewer_context()
            assert ctx is not None and ctx.actor.type == ActorType.SYSTEM
            contexts.append((ctx.organization_id, orjson.loads(kwargs["body"])["nodes"]))
            if ctx.organization_id == busy.id:
                raise HTTPError("Seer timed out")
            return HTTPResponse(status=200, body=b'{"accepted":1}')

        with (
            self.tasks(),
            patch.object(investigation, "make_signed_seer_api_request", side_effect=dispatch),
        ):
            recover_workflow_nodes()
            recover_workflow_nodes_for_organization(other.id)
        assert contexts == [
            (busy.id, [str(node_id) for node_id in busy_ids[:-1]]),
            (other.id, [str(paused.uuid)]),
        ]
        assert list(
            WorkflowNodeRun.objects.filter(next_check_at=now).values_list("uuid", flat=True)
        ) == [busy_ids[-1]]
        paused.refresh_from_db()
        assert paused.next_check_at == now + PAUSED_RECOVERY_INTERVAL

    @freeze_time()
    def test_lost_worker_partial_ack_and_late_ack_do_not_park_a_paused_node(self) -> None:
        org = self.organization
        now = timezone.now()
        run = self.make_run(org, None)
        paused = WorkflowNodeRun.objects.create(
            run=run,
            uuid=uuid4(),
            checkpoint={"status": "awaiting_input", "next_check_at": None},
            next_check_at=now,
        )
        lost = claim_due_nodes(org.id)
        assert lost.node_ids == [paused.uuid]
        assert claim_due_nodes(org.id).node_ids == []
        with (
            freeze_time(lost.retry_at),
            patch.object(
                investigation,
                "make_signed_seer_api_request",
                return_value=HTTPResponse(status=200, body=b'{"accepted":0}'),
            ),
        ):
            recover_workflow_nodes_for_organization(org.id)
            lost.acknowledge()
            paused.refresh_from_db()
            assert paused.next_check_at == lost.retry_at + RECOVERY_CLAIM_TTL

        with freeze_time(lost.retry_at + RECOVERY_CLAIM_TTL):
            latest = claim_due_nodes(org.id)
            assert latest.node_ids == [paused.uuid]
            # Explorer wakes the node while the recovery request is in flight.
            WorkflowNodeRun.objects.filter(pk=paused.pk).update(next_check_at=timezone.now())
            latest.acknowledge()
            assert claim_due_nodes(org.id).node_ids == [paused.uuid]

    def test_run_scoped_claim_leaves_other_due_runs_available(self) -> None:
        org = self.organization
        runs = [self.make_run(org, None) for _ in range(2)]
        nodes = [
            WorkflowNodeRun.objects.create(
                run=run, uuid=uuid4(), checkpoint={}, next_check_at=timezone.now()
            )
            for run in runs
        ]
        assert claim_due_nodes(org.id, run=runs[1]).node_ids == [nodes[1].uuid]
        assert claim_due_nodes(org.id).node_ids == [nodes[0].uuid]

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
        assert paused not in claim_due_nodes(self.organization.id).node_ids
        claim = claim_due_nodes(self.organization.id)
        assert claim.node_ids == [paused]
        claim.acknowledge()
        node.refresh_from_db()
        assert node.next_check_at is not None
        assert node.next_check_at >= now + PAUSED_RECOVERY_INTERVAL
        assert claim_due_nodes(self.organization.id).node_ids == []
        save_nodes(run, [{**checkpoint, "next_check_at": now.isoformat()}])
        assert claim_due_nodes(self.organization.id).node_ids == [paused]

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
