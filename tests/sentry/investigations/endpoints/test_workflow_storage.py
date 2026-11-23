from typing import Any
from uuid import UUID, uuid4

from django.test import override_settings
from django.urls import reverse
from rest_framework.response import Response

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.workflow_runtime import metric_workflow_request_id
from sentry.notebooks.models import Notebook, NotebookSourceType, NotebookWorkflowRun
from sentry.notebooks.services.notebooks import default_notebook_title
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


@override_settings(SEER_API_SHARED_SECRET="signed-system-workflow-integration-test")
@with_feature("organizations:investigations")
class WorkflowStorageTest(APITestCase):
    endpoint = "sentry-api-0-workflow-storage"

    def setUp(self) -> None:
        super().setUp()
        self.run_id = str(UUID("e225e501-619a-8f73-952b-fd7ad14beadb"))
        self.node = str(UUID("be92e441-ac8e-828e-b725-e94ba689ffff"))
        self.system = {
            "HTTP_X_VIEWER_CONTEXT": encode_viewer_context(
                ViewerContext(
                    actor=Actor(type=ActorType.SYSTEM), organization_id=self.organization.id
                )
            )
        }
        self.url = reverse(self.endpoint, args=[self.organization.slug, self.run_id])
        self.checkpoint = {
            "id": self.run_id,
            "request_id": str(uuid4()),
            "workflow_id": str(uuid4()),
            "input": {},
            "organization_id": self.organization.id,
            "execution_identity": {
                "actor_type": "user",
                "actor_id": self.user.id,
                "organization_id": self.organization.id,
            },
            "max_attempts": 1,
            "status": "running",
        }
        self.leaf: dict[str, Any] = {
            "id": self.node,
            "workflow_run_id": self.run_id,
            "node_id": "scan",
            "organization_id": self.organization.id,
            "status": "running",
            "state": {"output_schema": "BroadScanArtifact"},
            "attempt": 1,
            "explorer_run_id": 100,
            "next_check_at": None,
            "item_index": None,
        }
        self.payload = {
            "run": self.checkpoint,
            "nodes": [self.leaf],
            "definition": {
                "name": "Example",
                "nodes": {"scan": {}},
                "output": "$scan",
                "notebook": True,
            },
            "destination": {"projectIds": []},
        }

    def test_monitor_launch_can_name_its_preallocated_draft(self) -> None:
        notebook = self.create_notebook(
            organization=self.organization,
            source_type=NotebookSourceType.METRIC_OPEN_PERIOD,
            source_key="v2:metric:example",
            source_revision=1,
            title=default_notebook_title(NotebookSourceType.METRIC_OPEN_PERIOD),
        )
        self.checkpoint["request_id"] = str(metric_workflow_request_id(notebook.id))
        self.payload["destination"] = {"projectIds": [], "notebookId": str(notebook.id)}
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 200, response.data
        assert not NotebookWorkflowRun.objects.get(
            notebook=notebook, run_id=self.run_id
        ).preserve_title

    def test_atomic_creation_checkpoint_activity_and_notebook_projection(self) -> None:
        def create() -> Response:
            return self.client.post(self.url, self.payload, format="json", **self.system)

        response = create()
        assert response.status_code == 200, response.data
        assert response.data["created"]
        assert not create().data["created"]
        run = WorkflowRun.objects.get(uuid=self.run_id)
        notebook = run.checkpoint["notebook_id"]
        request = {
            **self.leaf,
            "status": "succeeded",
            "state": {
                "output_schema": "BroadScanArtifact",
                "output": {
                    "summary": "A spike",
                    "hypotheses": [
                        {
                            "statement": "Bad release",
                            "rationale": "Errors after deploy",
                            "verificationSteps": [
                                {
                                    "title": "Compare releases",
                                    "method": "Group by release",
                                    "objective": "Check regression",
                                }
                            ],
                        }
                    ],
                },
            },
        }
        update = {"version": 1, "run": {"status": "running"}, "nodes": [request]}
        assert self.client.put(self.url, update, format="json", **self.system).status_code == 204
        assert (
            self.client.put(
                self.url, {**update, "nodes": [self.leaf]}, format="json", **self.system
            ).status_code
            == 409
        )
        node_url = reverse(self.endpoint, args=[self.organization.slug, self.node])
        activity = {
            "explorer_run_id": 100,
            "updatedAt": "2026-01-02T00:00:00Z",
            "session": {
                "blocks": [{"message": {"role": "assistant", "content": "Checking releases"}}]
            },
        }
        assert (
            self.client.patch(node_url, activity, format="json", **self.system).status_code == 204
        )
        assert (
            self.client.patch(
                node_url,
                {**activity, "session": {"blocks": []}, "updatedAt": "2026-01-01T00:00:00Z"},
                format="json",
                **self.system,
            ).status_code
            == 204
        )
        self.login_as(self.user)
        public_url = reverse(
            "sentry-api-0-organization-investigation-workflow-run",
            args=[self.organization.slug, self.run_id],
        )
        public = self.client.get(public_url, {"activity": 1})
        assert public.status_code == 200
        assert public.data["notebookId"] == str(notebook)
        assert public.data["nodes"][0]["attempts"] == [activity]
        assert "execution_identity" not in public.data
        notebook_response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/notebooks/{notebook}/"
        )
        assert notebook_response.status_code == 200
        report = notebook_response.data["workflowReport"]
        assert report["active"]
        assert report["activity"] == ["Checking releases"]
        assert report["hypotheses"][0]["verificationSteps"][0]["title"] == "Compare releases"
        terminal = {
            "version": 2,
            "run": {
                "status": "failed",
                "started_at": "2026-11-21T23:30:58Z",
                "finished_at": "2026-11-21T23:40:15Z",
            },
            "nodes": [],
        }
        assert self.client.put(self.url, terminal, format="json", **self.system).status_code == 204
        final = self.client.get(notebook_response.wsgi_request.path).data["workflowReport"]
        assert not final["active"]
        assert final["elapsedSeconds"] == 557
        # Signing in as a member cannot grant access to the worker API.
        assert self.client.get(self.url).status_code in (401, 403)

    def test_archive_stops_the_run_and_fences_inflight_worker_updates(self) -> None:
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 200
        run = WorkflowRun.objects.get(uuid=self.run_id)
        notebook = Notebook.objects.get(pk=run.checkpoint["notebook_id"])
        self.login_as(self.user)
        response = self.client.delete(
            f"/api/0/organizations/{self.organization.slug}/notebooks/{notebook.id}/",
            {"notebookVersion": notebook.version},
            format="json",
        )
        assert response.status_code == 204, response.data
        run.refresh_from_db()
        assert run.checkpoint["status"] == "cancelled"
        child = run.nodes.get()
        assert child.checkpoint["status"] == "cancelled" and child.next_check_at
        stale = {"version": 1, "run": {"status": "running"}, "nodes": [self.leaf]}
        assert self.client.put(self.url, stale, format="json", **self.system).status_code == 409

    def test_two_rechecks_cannot_take_over_the_same_notebook(self) -> None:
        assert (
            self.client.post(self.url, self.payload, format="json", **self.system).status_code
            == 200
        )
        parent = WorkflowRun.objects.get(uuid=self.run_id)
        binding = NotebookWorkflowRun.objects.get(run_id=self.run_id)
        old_suggestion = self.create_notebook_action_request(
            notebook=binding.notebook, workflow_run=binding, key="check-the-threshold"
        )
        self.payload["destination"] = {
            "projectIds": [],
            "notebookId": parent.checkpoint["notebook_id"],
            "previousRunId": self.run_id,
        }
        for expected in (200, 409):
            run_id = str(uuid4())
            self.payload.update(
                run={**self.checkpoint, "id": run_id, "request_id": str(uuid4())}, nodes=[]
            )
            url = reverse(self.endpoint, args=[self.organization.slug, run_id])
            response = self.client.post(url, self.payload, format="json", **self.system)
            assert response.status_code == expected, response.data
            if expected == 200:
                old_suggestion.refresh_from_db()
                assert old_suggestion.state == "superseded"
                assert not NotebookWorkflowRun.objects.get(run_id=run_id).preserve_title
                assert not self.client.post(url, self.payload, format="json", **self.system).data[
                    "created"
                ]

    def test_specific_breach_must_resolve_unless_a_destination_is_explicit(self) -> None:
        self.payload["definition"]["name"] = "breached_metrics"
        self.checkpoint["input"] = {
            "detector_id": 1,
            "seed": {"metricIssueId": 1, "openPeriodId": 1},
        }
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 400, response.data
        assert not WorkflowRun.objects.filter(uuid=self.run_id).exists()
        assert not Notebook.objects.filter(organization=self.organization).exists()

        target = self.create_notebook(organization=self.organization, created_by=self.user)
        self.payload["destination"]["notebookId"] = target.id
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 200, response.data
        assert WorkflowRun.objects.get(uuid=self.run_id).checkpoint["notebook_id"] == target.id

    def test_monitor_without_a_breach_reference_gets_a_manual_notebook(self) -> None:
        self.payload["definition"]["name"] = "breached_metrics"
        self.checkpoint["input"] = {"detector_id": 1, "seed": {}}
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 200, response.data
        notebook = Notebook.objects.get(
            pk=WorkflowRun.objects.get(uuid=self.run_id).checkpoint["notebook_id"]
        )
        assert notebook.source_type == NotebookSourceType.MANUAL
        assert notebook.source_key is None

    def test_queue_time_activity_and_reporting_phases(self) -> None:
        self.checkpoint.update(status="pending", created_at="2025-01-01T00:00:00Z")
        self.leaf.update(status="ready", explorer_run_id=None)
        created = self.client.post(self.url, self.payload, format="json", **self.system)
        assert created.status_code == 200, created.data
        notebook = WorkflowRun.objects.get(uuid=self.run_id).checkpoint["notebook_id"]
        self.login_as(self.user)
        detail = f"/api/0/organizations/{self.organization.slug}/notebooks/{notebook}/"
        queued = self.client.get(detail).data["workflowReport"]
        collection = f"/api/0/organizations/{self.organization.slug}/notebooks/"
        queued_list = self.client.get(collection, {"runStatus": "pending"})
        assert [(item["id"], item["workflowStatus"]) for item in queued_list.data] == [
            (str(notebook), "pending")
        ]
        assert queued["elapsedSeconds"] > 0
        assert queued["awaitingHypotheses"]
        assert queued["phase"] == "broad_scan"
        assert not queued["currentActivity"]

        self.leaf.update(status="running", explorer_run_id=100)
        update = {
            "version": 1,
            "run": {"status": "running", "started_at": "2025-01-01T00:01:00Z"},
            "nodes": [self.leaf],
        }
        self.client.put(self.url, update, format="json", **self.system)
        node_url = reverse(self.endpoint, args=[self.organization.slug, self.node])
        block = {
            "id": "call",
            "message": {"role": "tool_use", "tool_calls": [{"id": "c", "function": "query"}]},
            "tool_results": [
                {
                    "tool_call_id": "c",
                    "structuredContent": {
                        "calls": [
                            {"id": 1, "title": "Count errors", "status": 200},
                            {"id": 2, "parent": 1, "title": "Nested"},
                            {
                                "id": 3,
                                "llm_description": "Reading traces",
                                "error": "Tool call failed",
                            },
                        ]
                    },
                }
            ],
        }
        activity = {
            "explorer_run_id": 100,
            "updatedAt": "2025-01-01T00:01:05Z",
            "session": {"blocks": [block]},
        }
        assert (
            self.client.patch(node_url, activity, format="json", **self.system).status_code == 204
        )
        live = self.client.get(detail).data["workflowReport"]
        assert [(entry["title"], entry["status"]) for entry in live["currentActivity"]] == [
            ("Count errors", "completed"),
            ("Reading traces", "failed"),
        ]

        self.leaf.update(status="succeeded")
        writer = {
            **self.leaf,
            "id": str(uuid4()),
            "node_id": "notebook/write",
            "status": "running",
            "state": {"output_schema": "NotebookReceipt"},
        }
        update = {"version": 2, "run": {}, "nodes": [self.leaf, writer]}
        assert self.client.put(self.url, update, format="json", **self.system).status_code == 204
        writing = self.client.get(detail).data["workflowReport"]
        assert writing["phase"] == "reporting"
        assert not writing["awaitingHypotheses"]

        final = {
            "version": 3,
            "run": {"status": "succeeded", "finished_at": "2025-01-01T00:02:00Z"},
            "nodes": [],
        }
        assert self.client.put(self.url, final, format="json", **self.system).status_code == 204
        assert self.client.get(detail).data["workflowReport"]["elapsedSeconds"] == 120
        assert self.client.get(collection, {"runStatus": "pending"}).data == []
        assert (
            self.client.get(collection, {"runStatus": "completed"}).data[0]["workflowStatus"]
            == "succeeded"
        )

    def test_saved_evidence_is_attached_to_the_verdict_and_check_that_produced_it(self) -> None:
        hypothesis = {"statement": "Slow downloads", "rationale": "Requests waited"}
        check = {
            "id": "latency",
            "title": "Check latency",
            "method": "Compare requests",
            "objective": "Check the timeout",
        }
        evidence = {
            "kind": "trace",
            "title": "Slow trace",
            "url": "/trace/",
            "summary": "Eight seconds",
            "data": {},
        }
        self.leaf.update(
            status="succeeded",
            state={"output_schema": "BroadScanArtifact", "output": {"hypotheses": [hypothesis]}},
        )
        judge = {
            **self.leaf,
            "id": str(uuid4()),
            "node_id": "judgment",
            "state": {
                "output_schema": "HypothesisJudgmentArtifact",
                "input": {
                    "hypothesis": hypothesis,
                    "evidence": [evidence],
                    "checks": [
                        {
                            "check": check,
                            "status": "succeeded",
                            "output": {"finding": "Deadline reached", "evidence": [evidence]},
                        }
                    ],
                },
                "output": {
                    "verdict": "supported",
                    "confidence": 0.9,
                    "rationale": "The deadline expired",
                    "supportingEvidenceIndexes": [0],
                    "refutingEvidenceIndexes": [],
                },
            },
        }
        self.payload["nodes"].extend(
            [
                judge,
                {
                    **self.leaf,
                    "id": str(uuid4()),
                    "node_id": "notebook/metadata",
                    "state": {
                        "output_schema": "InvestigationNotebookMetadata",
                        "output": {"primaryHypothesisKey": f"hypothesis-{judge['id']}"},
                    },
                },
            ]
        )
        assert (
            self.client.post(self.url, self.payload, format="json", **self.system).status_code
            == 200
        )
        notebook = WorkflowRun.objects.get(uuid=self.run_id).checkpoint["notebook_id"]
        self.login_as(self.user)
        detail = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/notebooks/{notebook}/"
        )
        card = detail.data["workflowReport"]["hypotheses"][0]
        assert detail.data["workflowReport"]["primaryHypothesisId"] == card["id"]
        assert card["agentVerdict"]["supportingEvidenceIds"] == [card["evidence"][0]["id"]]
        assert card["verificationSteps"][0]["evidence"][0]["url"] == evidence["url"]

    def test_unrelated_workflow_does_not_promise_hypotheses(self) -> None:
        self.leaf.update(
            status="pending", state={"definition": {"output_schema": "CustomArtifact"}}
        )
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 200
        notebook = WorkflowRun.objects.get(uuid=self.run_id).checkpoint["notebook_id"]
        self.login_as(self.user)
        report = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/notebooks/{notebook}/"
        ).data["workflowReport"]
        assert report["phase"] == "workflow"
        assert not report["awaitingHypotheses"]

    def test_rejects_cross_org_and_rolls_back_an_invalid_graph(self) -> None:
        self.leaf["organization_id"] += 1
        response = self.client.post(self.url, self.payload, format="json", **self.system)
        assert response.status_code == 400
        assert not WorkflowRun.objects.filter(uuid=self.run_id).exists()
        assert not WorkflowNodeRun.objects.filter(uuid=self.node).exists()
        self.system["HTTP_X_VIEWER_CONTEXT"] = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SYSTEM), organization_id=self.organization.id + 1
            )
        )
        assert self.client.post(
            self.url, self.payload, format="json", **self.system
        ).status_code in (403, 404)
