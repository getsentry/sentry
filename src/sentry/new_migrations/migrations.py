from django.db.migrations import Migration
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.new_migrations.validators import validate_operation


class CheckedMigration(Migration):
    """
    Migrations subclassing this will perform safety checks to help ensure that they
    won't cause production issues during deploy.
    """

    # This flag is used to decide whether to run this migration in a transaction or not. Generally
    # we don't want to run in a transaction here, since for long running operations like data
    # back-fills this results in us locking an increasing number of rows until we finally commit.
    atomic = False

    # This can be set to `False` to disable safety checks. Don't do this without approval from
    # the `owners-migrations` team.
    checked = True

    def apply(self, project_state, schema_editor, collect_sql=False):
        if self.checked:
            schema_editor.safe = True
        for op in self.operations:
            validate_operation(op)

        return super().apply(project_state, schema_editor, collect_sql)


def validate_identifier_length(identifier, identifier_type, operation_description=""):
    """
    Validate that PostgreSQL identifiers don't exceed 63 bytes.

    Args:
        identifier: The identifier to check
        identifier_type: Type of identifier (e.g., "table name", "column name", "index name")
        operation_description: Description of the operation for better error messages
    """
    if identifier and len(identifier.encode("utf-8")) > 63:
        raise UnsafeOperationException(
            f"PostgreSQL identifier '{identifier}' is {len(identifier.encode('utf-8'))} bytes long, "
            f"which exceeds the 63-byte limit for {identifier_type}. "
            f"{operation_description.strip()} "
            f"Please use a shorter {identifier_type}."
        )


def _validate_operation_identifiers(op):
    """Validate identifier lengths for different migration operation types."""
    from django.db import migrations

    # CreateModel: check table name and field names
    if isinstance(op, migrations.CreateModel):
        # Check table name (model name becomes table name with app prefix)
        validate_identifier_length(
            op.name.lower(), "table name", f"When creating model '{op.name}'."
        )

        # Check field names
        for field_name, field in op.fields:
            validate_identifier_length(
                field_name,
                "column name",
                f"When creating model '{op.name}' with field '{field_name}'.",
            )
            if hasattr(field, "db_column"):
                validate_identifier_length(
                    field.db_column,
                    "column name",
                    f"When creating model '{op.name}' with field '{field_name}'.",
                )

        # Check indexes defined in Meta
        if hasattr(op, "options") and op.options:
            indexes = op.options.get("indexes", [])
            for index in indexes:
                if hasattr(index, "name") and index.name:
                    validate_identifier_length(
                        index.name,
                        "index name",
                        f"When creating model '{op.name}' with index '{index.name}'.",
                    )

    # AddField: check field name
    elif isinstance(op, migrations.AddField):
        validate_identifier_length(
            op.name, "column name", f"When adding field '{op.name}' to model '{op.model_name}'."
        )
        if hasattr(op.field, "db_column"):
            validate_identifier_length(
                op.field.db_column,
                "column name",
                f"When adding field '{op.name}' to model '{op.model_name}'.",
            )

    # RenameField: check new field name
    elif isinstance(op, migrations.RenameField):
        validate_identifier_length(
            op.new_name,
            "column name",
            f"When renaming field '{op.old_name}' to '{op.new_name}' in model '{op.model_name}'.",
        )

    # RenameModel: check new model name
    elif isinstance(op, migrations.RenameModel):
        validate_identifier_length(
            op.new_name.lower(),
            "table name",
            f"When renaming model '{op.old_name}' to '{op.new_name}'.",
        )

    # AddIndex: check index name
    elif isinstance(op, migrations.AddIndex):
        if hasattr(op.index, "name") and op.index.name:
            validate_identifier_length(
                op.index.name,
                "index name",
                f"When adding index '{op.index.name}' to model '{op.model_name}'.",
            )

    # RemoveIndex: check index name
    elif isinstance(op, migrations.RemoveIndex):
        if hasattr(op, "name") and op.name:
            validate_identifier_length(
                op.name,
                "index name",
                f"When removing index '{op.name}' from model '{op.model_name}'.",
            )
