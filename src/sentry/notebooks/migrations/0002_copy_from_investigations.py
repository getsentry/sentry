from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapper

# New rows get ids at least this far past the old tables' sequences, so rows that old
# code writes during the deploy never collide with rows that new code writes.
ID_GAP = 1_000_000
BATCH_SIZE = 500

RENAMED = {
    "investigation_id": "notebook_id",
    "stable_agent_key": "producer_key",
    "report_revision": "producer_revision",
}
BLOCK_EXECUTION_POINTERS = ("current_execution_id", "content_execution_id", "result_execution_id")

Values = dict[str, Any]


def _keep_dates(model: type[models.Model]) -> None:
    # These historical classes only live for this migration run.
    for field in model._meta.concrete_fields:
        if isinstance(field, models.DateTimeField):
            field.auto_now = False
            field.auto_now_add = False


def _values(row: models.Model, fields: list[str]) -> Values:
    old_names = {new: old for old, new in RENAMED.items()}
    return {name: getattr(row, old_names.get(name, name)) for name in fields}


def _copy(
    old_rows: models.QuerySet[Any],
    new_model: type[models.Model],
    skip: Iterable[str] = (),
    transform: Callable[[Values], None] | None = None,
) -> set[int]:
    """Insert missing rows and update ones whose old row is at least as new. Returns the ids seen."""
    fields = [f.attname for f in new_model._meta.concrete_fields if f.attname not in skip]
    existing = dict(new_model.objects.values_list("id", "date_updated"))
    update_fields = [name for name in fields if name != "id"]
    seen: set[int] = set()
    creates: list[models.Model] = []
    updates: list[models.Model] = []

    def flush() -> None:
        # Archive first, so a newer active revision doesn't trip the one-active rule.
        updates.sort(key=lambda row: getattr(row, "status", None) != "archived")
        new_model.objects.bulk_update(updates, update_fields)
        new_model.objects.bulk_create(creates)
        updates.clear()
        creates.clear()

    for row in RangeQuerySetWrapper(old_rows, step=BATCH_SIZE):
        seen.add(row.id)
        if row.id in existing and existing[row.id] > row.date_updated:
            continue
        values = _values(row, fields)
        if transform is not None:
            transform(values)
        (updates if row.id in existing else creates).append(new_model(**values))
        if len(creates) + len(updates) >= BATCH_SIZE:
            flush()
    flush()
    return seen


def _notebook_transform(values: Values) -> None:
    if values["source_type"] == "metric_open_period":
        ref = values["source"]["ref"]
        values["source_key"] = f"metric_open_period:{ref['groupId']}:{ref['openPeriodId']}"
    values["filters"] = {k: v for k, v in values["filters"].items() if k != "breachedMetric"}


def _sequence_last_value(schema_editor: BaseDatabaseSchemaEditor, table: str) -> int:
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT pg_get_serial_sequence(%s, 'id')", [table])
        (sequence,) = cursor.fetchone()
        cursor.execute(f"SELECT last_value FROM {sequence}")
        (last_value,) = cursor.fetchone()
    return last_value


def _delete_missing(
    schema_editor: BaseDatabaseSchemaEditor,
    old_model: type[models.Model],
    new_model: type[models.Model],
    seen: set[int],
) -> None:
    # Ids past the old sequence were written by the new code.
    old_last = _sequence_last_value(schema_editor, old_model._meta.db_table)
    new_model.objects.filter(id__lte=old_last).exclude(id__in=seen).delete()


def _advance_sequence(
    schema_editor: BaseDatabaseSchemaEditor,
    old_model: type[models.Model],
    new_model: type[models.Model],
) -> None:
    target = _sequence_last_value(schema_editor, old_model._meta.db_table) + ID_GAP
    if _sequence_last_value(schema_editor, new_model._meta.db_table) >= target:
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT setval(pg_get_serial_sequence(%s, 'id'), %s)",
            [new_model._meta.db_table, target],
        )


def copy_from_investigations(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Copy notebooks from the investigations tables, skipping template notebooks. Safe to run again."""
    pairs = {
        name: (apps.get_model("investigations", old), apps.get_model("notebooks", new))
        for name, old, new in [
            ("notebook", "Investigation", "Notebook"),
            ("project", "InvestigationProject", "NotebookProject"),
            ("favorite", "InvestigationFavoriteUser", "NotebookFavoriteUser"),
            ("seen", "InvestigationSeen", "NotebookSeen"),
            ("block", "InvestigationBlock", "NotebookBlock"),
            ("execution", "InvestigationBlockExecution", "NotebookBlockExecution"),
            (
                "execution_project",
                "InvestigationBlockExecutionProject",
                "NotebookBlockExecutionProject",
            ),
            ("action_request", "InvestigationActionRequest", "NotebookActionRequest"),
            ("comment", "InvestigationComment", "NotebookComment"),
        ]
    }
    for _, new_model in pairs.values():
        _keep_dates(new_model)

    Investigation, Notebook = pairs["notebook"]
    notebook_ids = _copy(
        Investigation.objects.filter(template_key__isnull=True),
        Notebook,
        transform=_notebook_transform,
    )
    InvestigationBlock, NotebookBlock = pairs["block"]
    block_ids = _copy(
        InvestigationBlock.objects.filter(investigation_id__in=notebook_ids),
        NotebookBlock,
        skip=BLOCK_EXECUTION_POINTERS,
    )
    leaves = {}
    for name in ("project", "favorite", "seen", "action_request", "comment"):
        old_model, new_model = pairs[name]
        leaves[name] = _copy(old_model.objects.filter(investigation_id__in=notebook_ids), new_model)

    InvestigationBlockExecution, NotebookBlockExecution = pairs["execution"]
    execution_ids = _copy(
        InvestigationBlockExecution.objects.filter(block_id__in=block_ids), NotebookBlockExecution
    )
    InvestigationBlockExecutionProject, NotebookBlockExecutionProject = pairs["execution_project"]
    leaves["execution_project"] = _copy(
        InvestigationBlockExecutionProject.objects.filter(execution_id__in=execution_ids),
        NotebookBlockExecutionProject,
    )

    # Blocks and executions point at each other, so blocks get their execution
    # pointers once the executions exist.
    copied_dates = dict(NotebookBlock.objects.values_list("id", "date_updated"))
    pointed = [
        NotebookBlock(id=row.id, **{name: getattr(row, name) for name in BLOCK_EXECUTION_POINTERS})
        for row in InvestigationBlock.objects.filter(id__in=block_ids)
        if copied_dates[row.id] <= row.date_updated
    ]
    NotebookBlock.objects.bulk_update(pointed, BLOCK_EXECUTION_POINTERS, batch_size=BATCH_SIZE)

    # Hard deletes in the other tables only happen through organization or project deletion.
    for name, seen in leaves.items():
        _delete_missing(schema_editor, *pairs[name], seen)
    for old_model, new_model in pairs.values():
        _advance_sequence(schema_editor, old_model, new_model)


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("investigations", "0014_add_actor_references"),
        ("notebooks", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            copy_from_investigations,
            migrations.RunPython.noop,
            hints={
                "tables": [
                    "notebooks_notebook",
                    "notebooks_notebookproject",
                    "notebooks_notebookfavoriteuser",
                    "notebooks_notebookseen",
                    "notebooks_notebookblock",
                    "notebooks_notebookblockexecution",
                    "notebooks_notebookblockexecutionproject",
                    "notebooks_notebookactionrequest",
                    "notebooks_notebookcomment",
                ]
            },
        ),
    ]
