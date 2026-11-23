from typing import Any
from uuid import UUID, uuid4

from django.test import override_settings
from django.urls import reverse
from rest_framework.response import Response

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.investigations.services.workflow_runtime import metric_workflow_request_id
from sentry.notebooks.models import NotebookSourceType, NotebookWorkflowRun
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
