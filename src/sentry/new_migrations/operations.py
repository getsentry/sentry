from typing import Any, LiteralString

from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.operations.base import Operation
from django.db.migrations.operations.models import CreateModel, ModelOperation
from django.db.migrations.state import ProjectState

from sentry.db.partitions.manager import ensure_range_partitions, get_range_table
from sentry.db.partitions.spec import PartitioningSpec
from sentry.new_migrations.monkey.special import SafeRunSQL


def to_jsonb(table: LiteralString, column: LiteralString) -> SafeRunSQL:
    """
    Returns a SafeRunSQL operation that converts a column from text to jsonb in-place.
    Use inside SeparateDatabaseAndState.database_operations.
    """
    return SafeRunSQL(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE jsonb USING {column}::jsonb;",
        reverse_sql=f"ALTER TABLE {table} ALTER COLUMN {column} TYPE text;",
        hints={"tables": [table]},
    )


class CreatePartitionedModel(CreateModel):
    """
    ``CreateModel`` for a model that declares ``__partitioning__``.

    The partitioning is recorded in the migration, so replaying migrations on a new
    database creates each table the way it was originally created. A plain
    ``CreateModel`` always creates a plain table, even for a table whose model later
    declares partitioning. The table is created partitioned only in environments that
    list it in ``SENTRY_PARTITIONED_TABLES``.

    ``makemigrations`` generates a ``CreateModel``: replace it with this and pass the
    model's ``__partitioning__``.
    """

    def __init__(
        self,
        name: str,
        fields: list[tuple[str, Any]],
        options: dict[str, Any] | None = None,
        bases: tuple[Any, ...] | None = None,
        managers: list[tuple[str, Any]] | None = None,
        *,
        partitioning: PartitioningSpec,
    ) -> None:
        super().__init__(name, fields, options, bases, managers)
        self.partitioning = partitioning

    def deconstruct(self) -> tuple[str, list[Any], dict[str, Any]]:
        name, args, kwargs = super().deconstruct()
        return name, list(args), {**kwargs, "partitioning": self.partitioning}

    def database_forwards(
        self,
        app_label: str,
        schema_editor: BaseDatabaseSchemaEditor,
        from_state: ProjectState,
        to_state: ProjectState,
    ) -> None:
        model = to_state.apps.get_model(app_label, self.name)
        if not self.allow_migrate_model(schema_editor.connection.alias, model):
            return
        create_partitioned_model = getattr(schema_editor, "create_partitioned_model")
        create_partitioned_model(model, self.partitioning)

    def reduce(self, operation: Operation, app_label: str) -> bool | list[Operation]:
        # CreateModel folds later operations into a new plain CreateModel, which would
        # drop the partitioning, so this is never merged with other operations.
        return ModelOperation.reduce(self, operation, app_label)

    def describe(self) -> str:
        return f"Create partitioned model {self.name}"


class EnsurePartitions(Operation):
    """
    Create the current and upcoming partitions of a range partitioned table.

    ``CreatePartitionedModel`` already creates them, and the partition maintenance task keeps
    them created ahead of time. Use this when a migration writes rows right away. It
    does nothing when the table isn't range partitioned in this environment.
    """

    reduces_to_sql = False
    reversible = True

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    def deconstruct(self) -> tuple[str, list[Any], dict[str, Any]]:
        return self.__class__.__name__, [], {"model_name": self.model_name}

    def state_forwards(self, app_label: str, state: ProjectState) -> None:
        pass

    def database_forwards(
        self,
        app_label: str,
        schema_editor: BaseDatabaseSchemaEditor,
        from_state: ProjectState,
        to_state: ProjectState,
    ) -> None:
        model = to_state.apps.get_model(app_label, self.model_name)
        if not self.allow_migrate_model(schema_editor.connection.alias, model):
            return
        target = get_range_table(model, connection=schema_editor.connection)
        if target is not None:
            ensure_range_partitions(target)

    def database_backwards(
        self,
        app_label: str,
        schema_editor: BaseDatabaseSchemaEditor,
        from_state: ProjectState,
        to_state: ProjectState,
    ) -> None:
        pass

    def describe(self) -> str:
        return f"Ensure partitions exist for {self.model_name}"
