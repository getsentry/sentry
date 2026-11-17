from __future__ import annotations

from typing import Any
from uuid import uuid4

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.response import Response

from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.notebooks.contracts import MAX_MARKDOWN_CHARS
from sentry.notebooks.models import (
    Notebook,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockExecutionStatus,
    NotebookProject,
    NotebookStatus,
)
from sentry.notebooks.services.producer_writes import MAX_REVISION_STEP
from sentry.seer import agent_token
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.notebook_producer_sources import register_example_source_type
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context

FEATURE = "organizations:investigations"
SECRET = "notebook-producer-test-secret-thirty-two-bytes"


@with_feature(FEATURE)
class NotebookBlockIndexEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.notebook = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
            title="Block tests",
        )

    def blocks_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-notebook-blocks",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": self.notebook.id,
            },
        )

    def test_create_block(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": 1,
                "kind": "query",
                "content": "find slow transactions",
                "generationPrompt": "Generate the query",
                "display": {"type": "bar", "xAxis": "release", "yAxes": ["count"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["content"] == "find slow transactions"
        assert response.data["generationPrompt"] == "Generate the query"
        assert response.data["generatedContent"] == ""

        block = NotebookBlock.objects.get(id=response.data["id"])
        assert block.notebook_id == self.notebook.id

        self.notebook.refresh_from_db()
        assert self.notebook.version == 2

    def test_display_validation(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "query",
                "display": {"type": "line", "xAxis": "time", "yAxes": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "text",
                "display": {"type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "query",
                "content": "Show error volume",
                "display": {
                    "version": 1,
                    "type": "table",
                    "defaultView": "chart",
                    "queryCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data

    def test_versioned_display_rejects_invalid_field_types(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "query",
                "display": {"version": 1.0, "type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "text",
                "display": {"version": True, "type": "markdown"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "query",
                "display": {"version": 1, "type": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "table",
                    "stacked": "yes",
                },
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "table",
                    "topN": True,
                },
            },
            format="json",
        )
        assert response.status_code == 400

    def test_text_display_accepts_persisted_prompt_collapse(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "notebookVersion": self.notebook.version,
                "kind": "text",
                "generationPrompt": "Summarize the context",
                "display": {
                    "version": 1,
                    "type": "markdown",
                    "promptCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["display"]["promptCollapsed"] is True


@override_settings(SEER_API_SHARED_SECRET=SECRET)
@with_feature(
    {FEATURE: True, "organizations:service-accounts": True, agent_token.FEATURE_FLAG: True}
)
class NotebookProducerBlockTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"], all_projects=True
        )
        self.client.credentials(
            HTTP_X_VIEWER_CONTEXT=encode_viewer_context(
                ViewerContext(
                    actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                    organization_id=self.organization.id,
                ),
                key=SECRET,
            )
        )
        register_example_source_type(self)
        self.notebook = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
            title="Producer blocks",
            source_type="example_issue",
            source_key="example_issue:7",
            source={"type": "example_issue", "ref": {"issueId": 7}},
            source_revision=1,
        )
        self.create_notebook_project(self.notebook, self.project)
        self.url = self.blocks_url(self.notebook)

    def blocks_url(self, notebook: Notebook) -> str:
        return reverse(
            "sentry-api-0-organization-notebook-blocks",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": notebook.id,
            },
        )

    def write(self, **data: Any) -> Response:
        return self.client.post(
            self.url,
            data={"key": "summary", "revision": 1, "kind": "text", "content": "Text", **data},
            format="json",
        )

    def workflow_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-notebook-workflow",
            kwargs={"organization_id_or_slug": self.organization.slug, "workflow_run_id": uuid4()},
        )

    def test_workflow_destinations(self) -> None:
        url = self.workflow_url()
        body = {"title": "Investigation", "projectIds": [self.project.id]}
        first = self.client.post(url, body, format="json")
        assert first.status_code == 200, first.data
        assert self.client.post(url, body, format="json").data == first.data
        second = self.client.post(self.workflow_url(), body, format="json")
        assert second.data["notebookId"] != first.data["notebookId"]
        reopened = self.client.post(
            self.workflow_url(), {**body, "notebookId": first.data["notebookId"]}, format="json"
        )
        assert reopened.data == first.data
        assert (
            self.client.post(
                url, {**body, "notebookId": second.data["notebookId"]}, format="json"
            ).status_code
            == 409
        )

    def test_workflow_embed_lifecycle_and_independent_finalizers(self) -> None:
        run_id = uuid4()
        url = reverse(
            "sentry-api-0-organization-notebook-workflow", args=[self.organization.slug, run_id]
        )
        opened = self.client.post(
            url, {"title": "Initial", "notebookId": self.notebook.id}, format="json"
        )
        assert opened.status_code == 200, opened.data
        block_body = {
            "workflowRunId": str(run_id),
            "key": "evidence",
            "revision": 1,
            "kind": "embed",
            "embed": {"name": "issue", "body": {"id": "123", "shortId": "TEST-123"}},
            "embedSource": "issue TEST-123",
        }
        block = self.client.post(self.url, block_body, format="json")
        assert block.status_code == 201, block.data
        retry = self.client.post(self.url, block_body, format="json")
        assert retry.status_code == 200
        assert retry.data["version"] == block.data["version"]
        summary = {
            "blockId": block.data["id"],
            "version": block.data["version"],
            "finding": "The issue recurred.",
        }
        caption = self.client.patch(url, summary, format="json")
        assert caption.status_code == 200
        assert caption.data == {"version": 2, "summary": "The issue recurred.\nissue TEST-123"}
        assert self.client.patch(url, summary, format="json").data == caption.data
        details = reverse(
            "sentry-api-0-organization-notebook-details",
            args=[self.organization.slug, self.notebook.id],
        )
        saved = self.client.get(details).data["blocks"][0]
        assert saved["embed"] == block_body["embed"]
        assert saved["embedSummary"] == "The issue recurred.\nissue TEST-123"
        revision = self.client.get(url).data["revision"]
        steps = {
            "revision": revision,
            "section": "nextSteps",
            "result": {
                "suggestions": [
                    {"key": "inspect", "title": "Inspect issue", "rationale": "Confirm recurrence."}
                ]
            },
        }
        meta = {
            "revision": revision,
            "section": "metadata",
            "result": {
                "title": "Recurrence",
                "summary": "One issue",
                "description": "One recurring issue.",
            },
        }
        assert self.client.put(url, steps, format="json").status_code == 204
        assert self.client.put(url, meta, format="json").status_code == 204
        assert self.client.put(url, steps, format="json").status_code == 204
        assert self.client.get(details).data["title"] == "Recurrence"
        changed = {**block_body, "revision": 2, "embedSource": "updated issue reference"}
        assert (
            self.client.post(self.url, {**changed, "blockVersion": 1}, format="json").status_code
            == 409
        )
        edited = self.client.post(
            self.url,
            {**changed, "blockVersion": saved["version"]},
            format="json",
        )
        assert edited.status_code == 200
        assert self.client.patch(url, summary, format="json").status_code == 409
        deleted = self.client.delete(
            reverse(
                "sentry-api-0-organization-notebook-block-details",
                args=[self.organization.slug, self.notebook.id, saved["id"]],
            ),
            {
                "version": edited.data["version"],
                "notebookVersion": self.client.get(details).data["version"],
            },
            format="json",
        )
        assert deleted.status_code == 204, deleted.data
        assert self.client.patch(url, summary, format="json").status_code == 409
        assert self.client.get(details).data["blocks"] == []

    def test_creates_then_updates_by_key(self) -> None:
        user_block = self.create_notebook_block(notebook=self.notebook, position=0, kind="text")

        created = self.write(title="Summary", content="First draft")

        assert created.status_code == 201, created.data
        assert created.data["producerKey"] == "summary"
        assert created.data["producerRevision"] == 1
        assert created.data["position"] == user_block.position + 1
        assert created.data["outputStatus"] == "available"
        assert created.data["output"]["markdown"] == "First draft"
        assert created.data["createdBy"] is None
        execution = NotebookBlockExecution.objects.get(block_id=created.data["id"])
        assert execution.status == NotebookBlockExecutionStatus.COMPLETED

        updated = self.write(content="Second draft")

        assert updated.status_code == 200, updated.data
        assert updated.data["id"] == created.data["id"]
        assert updated.data["content"] == "Second draft"
        assert updated.data["title"] == "Summary"
        assert updated.data["position"] == created.data["position"]
        assert NotebookBlockExecution.objects.filter(block_id=created.data["id"]).count() == 1
        self.notebook.refresh_from_db()
        assert self.notebook.version == 3

    def test_stores_the_key_under_the_producer(self) -> None:
        response = self.write()

        assert response.status_code == 201, response.data
        assert response.data["producerKey"] == "summary"
        block = NotebookBlock.objects.get(id=response.data["id"])
        assert block.producer_key == "example:summary"

    def test_key_must_fit_with_the_producer_prefix(self) -> None:
        response = self.write(key="k" * 128)

        assert response.status_code == 400
        assert set(response.data) == {"key"}
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_agent_token_writes_by_key(self) -> None:
        token, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="notebook-producer",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.write()

        assert response.status_code == 201, response.data
        assert response.data["producerKey"] == "summary"

    def test_revision_can_rise_by_at_most_the_step(self) -> None:
        assert self.write(revision=MAX_REVISION_STEP).status_code == 201

        too_far = self.write(revision=2 * MAX_REVISION_STEP + 1)
        assert too_far.status_code == 400, too_far.data
        assert set(too_far.data) == {"revision"}

        within = self.write(revision=2 * MAX_REVISION_STEP)
        assert within.status_code == 200, within.data
        assert within.data["producerRevision"] == 2 * MAX_REVISION_STEP

    def test_a_new_key_cannot_jump_past_the_step(self) -> None:
        response = self.write(revision=MAX_REVISION_STEP + 1)

        assert response.status_code == 400, response.data
        assert set(response.data) == {"revision"}
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_one_write_cannot_fence_a_key(self) -> None:
        created = self.write()
        NotebookBlock.objects.filter(id=created.data["id"]).update(deleted_at=timezone.now())

        fenced = self.write(revision=BoundedPositiveIntegerField.MAX_VALUE)

        assert fenced.status_code == 400, fenced.data
        assert self.write(revision=2).status_code == 201
        assert NotebookBlock.objects.get(id=created.data["id"]).producer_revision == 1

    def test_user_session_cannot_write_by_key(self) -> None:
        self.client.credentials()
        self.login_as(self.user)

        response = self.write()

        assert response.status_code == 403, response.data
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_records_the_notebook_projects_on_the_execution(self) -> None:
        response = self.write()

        assert response.status_code == 201, response.data
        execution = NotebookBlockExecution.objects.get(block_id=response.data["id"])
        assert list(execution.data_project_links.values_list("project_id", flat=True)) == [
            self.project.id
        ]

    def test_writes_to_a_notebook_without_projects(self) -> None:
        NotebookProject.objects.filter(notebook=self.notebook).delete()

        response = self.write()

        assert response.status_code == 201, response.data
        execution = NotebookBlockExecution.objects.get(block_id=response.data["id"])
        assert not execution.data_project_links.exists()

    def test_rejects_oversized_content_on_the_content_field(self) -> None:
        response = self.write(content="a" * (MAX_MARKDOWN_CHARS + 1))

        assert response.status_code == 400
        assert set(response.data) == {"content"}
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def ordered_block_ids(self) -> list[str]:
        return [
            str(block_id)
            for block_id in NotebookBlock.objects.filter(
                notebook=self.notebook, deleted_at__isnull=True
            )
            .order_by("position", "id")
            .values_list("id", flat=True)
        ]

    def test_inserts_at_a_position(self) -> None:
        first = self.create_notebook_block(notebook=self.notebook, position=0, kind="text")
        second = self.create_notebook_block(notebook=self.notebook, position=1, kind="text")

        response = self.write(position=1)

        assert response.status_code == 201, response.data
        assert response.data["position"] == 1
        assert self.ordered_block_ids() == [str(first.id), response.data["id"], str(second.id)]
        second.refresh_from_db()
        assert second.position == 2

    def test_clamps_a_large_position_and_later_appends_still_work(self) -> None:
        user_block = self.create_notebook_block(notebook=self.notebook, position=0, kind="text")

        response = self.write(position=BoundedPositiveIntegerField.MAX_VALUE)

        assert response.status_code == 201, response.data
        assert response.data["position"] == 1
        appended = self.write(key="details")
        assert appended.status_code == 201, appended.data
        assert appended.data["position"] == 2
        assert self.ordered_block_ids() == [
            str(user_block.id),
            response.data["id"],
            appended.data["id"],
        ]

    def test_moves_an_existing_block_to_a_position(self) -> None:
        user_block = self.create_notebook_block(notebook=self.notebook, position=0, kind="text")
        created = self.write()
        assert created.data["position"] == 1

        moved = self.write(revision=2, position=0)

        assert moved.status_code == 200, moved.data
        assert moved.data["position"] == 0
        assert self.ordered_block_ids() == [created.data["id"], str(user_block.id)]

    def test_overwrites_a_user_edit(self) -> None:
        created = self.write(content="Generated")
        block = NotebookBlock.objects.get(id=created.data["id"])
        self.notebook.refresh_from_db()
        edited = self.client.put(
            reverse(
                "sentry-api-0-organization-notebook-block-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "notebook_id": self.notebook.id,
                    "block_id": block.id,
                },
            ),
            data={
                "notebookVersion": self.notebook.version,
                "version": block.version,
                "content": "Edited by a person",
            },
            format="json",
        )
        assert edited.status_code == 200, edited.data

        rewritten = self.write(content="Generated again")

        assert rewritten.status_code == 200, rewritten.data
        assert rewritten.data["content"] == "Generated again"

    def test_brings_back_a_deleted_block(self) -> None:
        created = self.write(content="Generated")
        block = NotebookBlock.objects.get(id=created.data["id"])
        self.notebook.refresh_from_db()
        deleted = self.client.delete(
            reverse(
                "sentry-api-0-organization-notebook-block-details",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "notebook_id": self.notebook.id,
                    "block_id": block.id,
                },
            ),
            data={"notebookVersion": self.notebook.version, "version": block.version},
            format="json",
        )
        assert deleted.status_code == 204

        restored = self.write(content="Generated again")

        assert restored.status_code == 201, restored.data
        assert restored.data["id"] == created.data["id"]
        block.refresh_from_db()
        assert block.deleted_at is None
        assert block.content == "Generated again"

    def test_a_newer_revision_conflicts(self) -> None:
        assert self.write(revision=2, content="Newer").status_code == 201

        response = self.write(revision=1, content="Older")

        assert response.status_code == 409, response.data
        assert NotebookBlock.objects.get(notebook=self.notebook).content == "Newer"

    def test_a_new_revision_updates_the_block(self) -> None:
        created = self.write(content="First")

        revised = self.write(revision=2, content="Second")

        assert revised.status_code == 200, revised.data
        assert revised.data["id"] == created.data["id"]
        assert revised.data["producerRevision"] == 2

    def test_archived_notebook_is_read_only(self) -> None:
        self.notebook.update(status=NotebookStatus.ARCHIVED)

        response = self.write(content="Late")

        assert response.status_code == 400
        assert response.data == {"detail": "Archived investigations are read-only."}
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_needs_one_way_to_write(self) -> None:
        for data in (
            {"kind": "text"},
            {"kind": "text", "key": "summary"},
            {"kind": "text", "revision": 1},
            {"kind": "text", "notebookVersion": 1, "key": "summary", "revision": 1},
            {"kind": "text", "notebookVersion": 1, "position": 0},
            {"kind": "query", "key": "summary", "revision": 1, "content": "Text"},
            {"kind": "text", "key": "summary", "revision": 1},
            {"kind": "text", "key": "summary", "revision": 1, "content": ""},
        ):
            response = self.client.post(self.url, data=data, format="json")

            assert response.status_code == 400, data
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_user_blocks_have_no_producer_fields(self) -> None:
        response = self.client.post(
            self.url, data={"notebookVersion": 1, "kind": "text"}, format="json"
        )

        assert response.status_code == 201, response.data
        assert response.data["producerKey"] is None
        assert response.data["producerRevision"] is None

    def test_refuses_notebooks_without_a_producer_source(self) -> None:
        manual = self.create_notebook(organization=self.organization, title="Manual")
        engine = self.create_notebook(
            organization=self.organization,
            title="Engine",
            source_type="metric_open_period",
            source_key="metric_open_period:1:1",
            source={"type": "metric_open_period", "ref": {}},
            source_revision=1,
        )
        for notebook in (manual, engine):
            self.create_notebook_project(notebook, self.project)
            response = self.client.post(
                self.blocks_url(notebook),
                data={"key": "summary", "revision": 1, "kind": "text", "content": "Text"},
                format="json",
            )

            assert response.status_code == 400, response.data
            assert response.data["detail"][0].code == "not_producer_notebook"
            assert not NotebookBlock.objects.filter(notebook=notebook).exists()
