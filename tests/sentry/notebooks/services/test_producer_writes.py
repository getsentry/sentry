from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from django.db import IntegrityError, router, transaction
from django.utils import timezone
from rest_framework import serializers

from sentry.notebooks.contracts import MAX_MARKDOWN_CHARS
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
    append_block_content,
    move_block,
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

    def remove(self, **filters: Any) -> list[str]:
        with notebook_writes(self.notebook) as writes:
            return remove_blocks(writes, **filters)

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

    def test_new_revision_updates_the_block_in_place(self) -> None:
        first = self.upsert(title="Summary")
        comment = self.create_notebook_comment(notebook=self.notebook, block=first)
        first_execution_id = first.current_execution_id

        second = self.upsert(revision=1, content="Rewritten", position=UNSET)

        assert second.id == first.id
        assert second.producer_revision == 1
        assert second.title == "Summary"
        assert second.content == "Rewritten"
        assert second.current_execution_id != first_execution_id
        assert second.current_execution is not None
        assert second.current_execution.input_snapshot["reportRevision"] == 1
        comment.refresh_from_db()
        assert comment.block_id == first.id
        assert NotebookBlock.objects.filter(notebook=self.notebook).count() == 1

    def test_started_rewrite_keeps_showing_the_previous_output(self) -> None:
        first = self.upsert()

        started = self.upsert(revision=1, complete=False, position=UNSET)

        assert started.id == first.id
        assert started.content == "Report"
        assert started.content_execution_id == first.content_execution_id
        assert started.current_execution_id != first.content_execution_id

    def test_older_revision_is_rejected(self) -> None:
        self.upsert(revision=2)

        with pytest.raises(serializers.ValidationError):
            self.upsert(revision=1, content="Late")

        block = NotebookBlock.objects.get(notebook=self.notebook)
        assert block.producer_revision == 2
        assert block.content == "Report"

    def test_removed_block_comes_back_in_its_revision(self) -> None:
        block = self.upsert(revision=1)
        self.remove(key="summary")

        restored = self.upsert(revision=1, content="Restored")

        assert restored.id == block.id
        assert restored.deleted_at is None

    def test_removed_block_still_rejects_an_older_revision(self) -> None:
        self.upsert(revision=1)
        newest = self.upsert(revision=2)
        self.remove(key="summary")

        with pytest.raises(serializers.ValidationError):
            self.upsert(revision=1, content="Late")
        assert not NotebookBlock.objects.filter(
            notebook=self.notebook, deleted_at__isnull=True
        ).exists()

        restored = self.upsert(revision=2, content="Restored")
        assert restored.id == newest.id
        assert restored.deleted_at is None

    def test_removed_block_is_not_reused_by_a_new_revision(self) -> None:
        block = self.upsert(revision=1)
        self.remove(key="summary")

        replacement = self.upsert(revision=2)

        assert replacement.id != block.id

    def test_kind_change_needs_a_new_revision(self) -> None:
        self.upsert()

        with pytest.raises(serializers.ValidationError):
            self.upsert(kind=NotebookBlockKind.QUERY, query_result=QUERY_RESULT)

    def test_kind_change_in_a_new_revision_keeps_the_block(self) -> None:
        text = self.upsert()

        query = self.upsert(
            revision=1,
            kind=NotebookBlockKind.QUERY,
            query_result=QUERY_RESULT,
            content=UNSET,
        )

        assert query.id == text.id
        assert query.kind == NotebookBlockKind.QUERY
        assert query.content == ""

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
            assert remove_blocks(writes, all_blocks=True) == []

        self.notebook.refresh_from_db()
        assert self.notebook.version == 1

    def test_rejects_archived_notebook(self) -> None:
        self.notebook.update(status=NotebookStatus.ARCHIVED)

        with pytest.raises(serializers.ValidationError):
            with notebook_writes(self.notebook) as writes:
                self.upsert(writes, "a")

        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()


class AppendBlockContentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.notebook = self.create_notebook(organization=self.organization)

    def start(self, revision: int = 1, kind: str = NotebookBlockKind.TEXT) -> NotebookBlock:
        with notebook_writes(self.notebook) as writes:
            return upsert_block(
                writes,
                key="summary",
                revision=revision,
                kind=kind,
                request_id=uuid4(),
                complete=False,
                position=0,
                project_ids=[self.project.id],
                input_snapshot={},
            )

    def append(self, **values: Any) -> bool:
        with notebook_writes(self.notebook) as writes:
            return append_block_content(writes, key="summary", **values)

    def test_appends_and_resets_content(self) -> None:
        started = self.start()

        assert self.append(revision=1, text="Hel")
        assert self.append(revision=1, text="lo")
        block = NotebookBlock.objects.get(id=started.id)
        assert block.content == "Hello"
        assert block.generated_content == "Hello"
        assert block.version == started.version + 2

        assert self.append(revision=1, text="Bye", reset=True)
        block.refresh_from_db()
        assert block.content == "Bye"
        assert block.current_execution_id == started.current_execution_id
        assert block.display == started.display

    def test_a_rewrite_ignores_text_until_it_completes(self) -> None:
        self.start(revision=1)
        with notebook_writes(self.notebook) as writes:
            upsert_block(
                writes,
                key="summary",
                revision=1,
                kind=NotebookBlockKind.TEXT,
                request_id=uuid4(),
                complete=True,
                content="Done",
                project_ids=[self.project.id],
                input_snapshot={},
            )
        self.start(revision=2)

        assert not self.append(revision=2, text="more")
        assert NotebookBlock.objects.get(notebook=self.notebook).content == "Done"

    def test_rejects_text_for_a_block_not_started_in_this_revision(self) -> None:
        self.start(revision=1)
        self.append(revision=1, text="Old")

        with pytest.raises(serializers.ValidationError):
            self.append(revision=2, text="New")

        block = NotebookBlock.objects.get(notebook=self.notebook)
        assert block.producer_revision == 1
        assert block.content == "Old"

    def test_needs_a_live_text_block(self) -> None:
        with pytest.raises(serializers.ValidationError):
            self.append(revision=1, text="x")

        self.start(kind=NotebookBlockKind.QUERY)
        with pytest.raises(serializers.ValidationError):
            self.append(revision=1, text="x")

    def test_rejects_an_older_revision(self) -> None:
        self.start(revision=2)

        with pytest.raises(serializers.ValidationError):
            self.append(revision=1, text="x")

    def test_rejects_text_over_the_size_limit(self) -> None:
        self.start()

        with pytest.raises(serializers.ValidationError):
            self.append(
                revision=1,
                text="x" * (MAX_MARKDOWN_CHARS + 1),
            )


class MoveBlockTest(TestCase):
    def test_moves_the_live_block_and_rejects_an_older_revision(self) -> None:
        notebook = self.create_notebook(organization=self.organization)
        block = self.create_notebook_block(notebook=notebook, producer_key="a", producer_revision=1)

        with notebook_writes(notebook) as writes:
            move_block(writes, key="a", revision=2, position=3)
        with pytest.raises(serializers.ValidationError):
            with notebook_writes(notebook) as writes:
                move_block(writes, key="a", revision=0, position=5)

        block.refresh_from_db()
        assert block.position == 3
        assert block.producer_revision == 1


class LiveProducerBlockConstraintTest(TestCase):
    def test_one_live_block_per_key(self) -> None:
        notebook = self.create_notebook(organization=self.organization)
        self.create_notebook_block(
            notebook=notebook, producer_key="a", producer_revision=1, deleted_at=timezone.now()
        )
        self.create_notebook_block(notebook=notebook, producer_key="a", producer_revision=2)

        with pytest.raises(IntegrityError):
            with transaction.atomic(using=router.db_for_write(NotebookBlock)):
                self.create_notebook_block(notebook=notebook, producer_key="a", producer_revision=3)


class RemoveBlocksTest(TestCase):
    def test_soft_deletes_only_matching_producer_blocks(self) -> None:
        notebook = self.create_notebook(organization=self.organization)
        removed = self.create_notebook_block(
            notebook=notebook, producer_key="a", producer_revision=1
        )
        kept = self.create_notebook_block(notebook=notebook, producer_key="b", producer_revision=1)
        user_block = self.create_notebook_block(notebook=notebook)

        with notebook_writes(notebook) as writes:
            assert remove_blocks(writes, revision=1, key="a") == ["a"]

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

            assert remove_blocks(writes, all_blocks=True) == ["a"]
        block.refresh_from_db()
        assert block.deleted_at is not None

    def test_removes_listed_blocks_below_a_revision(self) -> None:
        notebook = self.create_notebook(organization=self.organization)
        replaced = self.create_notebook_block(
            notebook=notebook, producer_key="a", producer_revision=1
        )
        rewritten = self.create_notebook_block(
            notebook=notebook, producer_key="b", producer_revision=2
        )
        kept = self.create_notebook_block(notebook=notebook, producer_key="c", producer_revision=1)

        with notebook_writes(notebook) as writes:
            removed = remove_blocks(writes, block_ids=[replaced.id, rewritten.id], revision_below=2)

        assert removed == ["a"]

        for block in (replaced, rewritten, kept):
            block.refresh_from_db()
        assert replaced.deleted_at is not None
        assert rewritten.deleted_at is None
        assert kept.deleted_at is None
