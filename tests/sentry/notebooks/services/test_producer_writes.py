from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from django.db import IntegrityError, router, transaction
from rest_framework import serializers

from sentry.notebooks.models import (
    Notebook,
    NotebookBlock,
    NotebookBlockExecutionStatus,
    NotebookBlockKind,
    NotebookStatus,
)
from sentry.notebooks.services.producer_writes import (
    UNSET,
    NotebookWrites,
    notebook_writes,
    remove_blocks,
    upsert_block,
)
from sentry.testutils.cases import TestCase

QUERY_RESULT = {
    "schemaVersion": 1,
    "table": {"columns": [], "rows": []},
    "chart": None,
}


class UpsertBlockTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.notebook = self.create_notebook(organization=self.organization)

    def upsert(self, notebook: Notebook | None = None, **values: Any) -> NotebookBlock:
        arguments: dict[str, Any] = {
            "key": "summary",
            "revision": 0,
            "kind": NotebookBlockKind.TEXT,
            "request_id": uuid4(),
            "complete": True,
            "position": 0,
            "content": "Report",
            "project_ids": [self.project.id],
            "input_snapshot": {"orchestrationRunId": 1},
            **values,
        }
        with notebook_writes(notebook or self.notebook) as writes:
            return upsert_block(writes, **arguments)

    def test_creates_block_and_completed_execution(self) -> None:
        block = self.upsert(title="Summary")

        assert block.producer_key == "summary"
        assert block.producer_revision == 0
        assert block.title == "Summary"
        assert block.content == "Report"
        assert block.generated_content == "Report"
        assert block.display == {"type": "markdown"}
        execution = block.current_execution
        assert execution is not None
        assert block.content_execution_id == execution.id
        assert execution.status == NotebookBlockExecutionStatus.COMPLETED
        assert execution.result == {"schemaVersion": 1, "markdown": "Report"}
        assert execution.input_snapshot == {
            "orchestrationRunId": 1,
            "reportRevision": 0,
            "stableAgentKey": "summary",
            "projectIds": [self.project.id],
        }
        assert list(execution.data_project_links.values_list("project_id", flat=True)) == [
            self.project.id
        ]

    def test_new_block_requires_position(self) -> None:
        with pytest.raises(serializers.ValidationError):
            self.upsert(position=UNSET)

        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_rejected_project_scope_leaves_no_block(self) -> None:
        foreign_project = self.create_project(organization=self.create_organization())

        with pytest.raises(serializers.ValidationError):
            self.upsert(project_ids=[foreign_project.id])

        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_updates_block_with_same_key_and_revision_in_place(self) -> None:
        request_id = uuid4()
        started = self.upsert(request_id=request_id, complete=False, title="Summary")
        assert started.current_execution is not None
        assert started.current_execution.status == NotebookBlockExecutionStatus.RUNNING
        assert started.content == ""

        completed = self.upsert(request_id=request_id, content="Final report", position=UNSET)

        assert completed.id == started.id
        assert completed.version == started.version + 1
        assert completed.title == "Summary"
        assert completed.position == 0
        assert completed.content == "Final report"
        assert completed.current_execution_id == started.current_execution_id
        assert completed.current_execution is not None
        assert completed.current_execution.status == NotebookBlockExecutionStatus.COMPLETED
        assert NotebookBlock.objects.filter(notebook=self.notebook).count() == 1

    def test_unset_fields_keep_the_block_values(self) -> None:
        self.upsert(title="Summary", prompt="Explain")

        block = self.upsert(content="Updated", position=UNSET)

        assert block.title == "Summary"
        assert block.prompt == "Explain"
        assert block.generated_content == "Updated"

    def test_explicit_none_title_is_written(self) -> None:
        self.upsert(title="Summary")

        with pytest.raises(IntegrityError):
            with transaction.atomic(using=router.db_for_write(NotebookBlock)):
                self.upsert(title=None)

    def test_new_revision_creates_another_block(self) -> None:
        first = self.upsert()
        second = self.upsert(revision=1)

        assert second.id != first.id

    def test_kind_change_needs_a_new_revision(self) -> None:
        self.upsert()

        with pytest.raises(serializers.ValidationError):
            self.upsert(kind=NotebookBlockKind.QUERY, query_result=QUERY_RESULT)

    def test_kind_change_from_snapshot_keeps_block_and_clears_content(self) -> None:
        text = self.upsert(title="Summary", prompt="Explain")

        query = self.upsert(
            kind=NotebookBlockKind.QUERY,
            query_result=QUERY_RESULT,
            from_snapshot=True,
            content=UNSET,
        )

        assert query.id == text.id
        assert query.kind == NotebookBlockKind.QUERY
        assert query.content == ""
        assert query.prompt == ""
        assert query.title == "Summary"
        assert query.display["type"] == "table"
        assert query.content_execution_id is None
        assert query.result_execution_id == query.current_execution_id
        assert query.current_execution is not None
        assert query.current_execution.result == QUERY_RESULT

    def test_request_id_of_another_block_is_rejected(self) -> None:
        request_id = uuid4()
        other = self.upsert(
            notebook=self.create_notebook(organization=self.organization),
            request_id=request_id,
        )

        with pytest.raises(serializers.ValidationError) as error:
            self.upsert(request_id=request_id)

        assert error.value.detail == {"requestId": "This execution request ID is already in use."}
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()
        assert other.current_execution is not None
        other.current_execution.refresh_from_db()
        assert other.current_execution.block_id == other.id


class NotebookWritesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.notebook = self.create_notebook(organization=self.organization)

    def upsert(self, writes: NotebookWrites, key: str) -> NotebookBlock:
        return upsert_block(
            writes,
            key=key,
            revision=0,
            kind=NotebookBlockKind.TEXT,
            request_id=uuid4(),
            complete=True,
            position=0,
            content="Report",
            project_ids=[self.project.id],
            input_snapshot={},
        )

    def test_bumps_version_once_when_writes_change_the_notebook(self) -> None:
        with notebook_writes(self.notebook) as writes:
            self.upsert(writes, "a")
            self.upsert(writes, "b")

        self.notebook.refresh_from_db()
        assert self.notebook.version == 2

    def test_keeps_version_when_nothing_changed(self) -> None:
        with notebook_writes(self.notebook) as writes:
            assert remove_blocks(writes, all_blocks=True) == 0

        self.notebook.refresh_from_db()
        assert self.notebook.version == 1

    def test_rejects_archived_notebook(self) -> None:
        self.notebook.update(status=NotebookStatus.ARCHIVED)

        with pytest.raises(serializers.ValidationError):
            with notebook_writes(self.notebook) as writes:
                self.upsert(writes, "a")

        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()


class RemoveBlocksTest(TestCase):
    def test_soft_deletes_only_matching_producer_blocks(self) -> None:
        notebook = self.create_notebook(organization=self.organization)
        removed = self.create_notebook_block(
            notebook=notebook, producer_key="a", producer_revision=1
        )
        kept = self.create_notebook_block(notebook=notebook, producer_key="b", producer_revision=1)
        user_block = self.create_notebook_block(notebook=notebook)

        with notebook_writes(notebook) as writes:
            assert remove_blocks(writes, revision=1, key="a") == 1

        removed.refresh_from_db()
        kept.refresh_from_db()
        user_block.refresh_from_db()
        assert removed.deleted_at is not None
        assert kept.deleted_at is None
        assert user_block.deleted_at is None

    def test_requires_a_filter(self) -> None:
        notebook = self.create_notebook(organization=self.organization)
        block = self.create_notebook_block(notebook=notebook, producer_key="a", producer_revision=1)

        with notebook_writes(notebook) as writes:
            with pytest.raises(ValueError):
                remove_blocks(writes)

            assert remove_blocks(writes, all_blocks=True) == 1
        block.refresh_from_db()
        assert block.deleted_at is not None
