from __future__ import annotations

from django.db import migrations
from django.db.migrations import RunSQL, SeparateDatabaseAndState
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.new_migrations.monkey.special import SafeRunSQL


def validate_operation(op):
    if isinstance(op, RunSQL) and not isinstance(op, SafeRunSQL):
        raise UnsafeOperationException(
            "Using `RunSQL` is unsafe because our migrations safety framework can't detect problems with the "
            "migration, and doesn't apply timeout and statement locks. Use `SafeRunSQL` instead, and get "
            "approval from `owners-migrations` to make sure that it's safe."
        )

    if isinstance(op, SeparateDatabaseAndState):
        for db_op in op.database_operations:
            validate_operation(db_op)

    # Check identifier lengths for various operation types
    _validate_operation_identifiers(op)


MAX_IDENTIFIER_LENGTH = 63  # max identifier length in postgres in bytes


def _validate_identifier_length(identifier):
    """
    Validate that PostgreSQL identifiers don't exceed 63 bytes.

    Args:
        identifier: The identifier to check
    """
    if identifier and len(identifier.encode("utf-8")) > MAX_IDENTIFIER_LENGTH:
        raise UnsafeOperationException(
            f"PostgreSQL identifier '{identifier}' is {len(identifier.encode('utf-8'))} bytes long, "
            f"which exceeds the {MAX_IDENTIFIER_LENGTH}-byte limit for identifiers in Postgres (e.g. table names, column names, index names)."
        )


def _validate_field_identifier(field_name, field):
    """
    Validate field identifier, checking db_column if present, otherwise field name.
    """
    if hasattr(field, "db_column") and field.db_column:
        _validate_identifier_length(field.db_column)
    else:
        _validate_identifier_length(field_name)


def _validate_create_model_identifier_length(op):
    _validate_identifier_length(op.name)
    # check field names
    for field_name, field in op.fields:
        _validate_field_identifier(field_name, field)
    # check indexes
    if hasattr(op, "options") and op.options:
        indexes = op.options.get("indexes", [])
        for index in indexes:
            if hasattr(index, "name") and index.name:
                _validate_identifier_length(index.name)
        # check constraints
        constraints = op.options.get("constraints", [])
        for constraint in constraints:
            if hasattr(constraint, "name") and constraint.name:
                _validate_identifier_length(constraint.name)


def _validate_add_field(op):
    _validate_identifier_length(op.name)
    _validate_field_identifier(op.name, op.field)


def _validate_rename_field(op):
    _validate_identifier_length(op.old_name)
    _validate_identifier_length(op.new_name)


def _validate_rename_model(op):
    _validate_identifier_length(op.old_name)
    _validate_identifier_length(op.new_name)


def _validate_delete_model(op):
    _validate_identifier_length(op.name)


def _validate_add_index(op):
    if hasattr(op.index, "name") and op.index.name:
        _validate_identifier_length(op.index.name)


def _validate_remove_index(op):
    _validate_identifier_length(op.name)


def _validate_alter_model_table(op):
    if op.table:  # table can be None to reset to default
        _validate_identifier_length(op.table)


def _validate_add_constraint(op):
    if hasattr(op.constraint, "name") and op.constraint.name:
        _validate_identifier_length(op.constraint.name)


def _validate_remove_constraint(op):
    _validate_identifier_length(op.name)


def _validate_alter_field(op):
    _validate_identifier_length(op.name)
    _validate_field_identifier(op.name, op.field)


def _validate_rename_index(op):
    if op.old_name:
        _validate_identifier_length(op.old_name)
    _validate_identifier_length(op.new_name)


def _validate_remove_field(op):
    _validate_identifier_length(op.name)


def _validate_alter_together_option(op):
    """Validate AlterUniqueTogether and AlterIndexTogether operations."""
    if hasattr(op, "unique_together"):
        fields_list = op.unique_together
    elif hasattr(op, "index_together"):
        fields_list = op.index_together
    else:
        return

    if fields_list:
        for fields in fields_list:
            for field in fields:
                _validate_identifier_length(field)


def _validate_alter_constraint(op):
    _validate_identifier_length(op.name)
    if hasattr(op.constraint, "name") and op.constraint.name:
        _validate_identifier_length(op.constraint.name)


OPERATION_VALIDATOR = {
    migrations.CreateModel: _validate_create_model_identifier_length,
    migrations.DeleteModel: _validate_delete_model,
    migrations.AddField: _validate_add_field,
    migrations.RenameField: _validate_rename_field,
    migrations.RenameModel: _validate_rename_model,
    migrations.AddIndex: _validate_add_index,
    migrations.RemoveIndex: _validate_remove_index,
    migrations.AlterModelTable: _validate_alter_model_table,
    migrations.AddConstraint: _validate_add_constraint,
    migrations.RemoveConstraint: _validate_remove_constraint,
    migrations.AlterField: _validate_alter_field,
    migrations.RenameIndex: _validate_rename_index,
    migrations.RemoveField: _validate_remove_field,
    migrations.AlterUniqueTogether: _validate_alter_together_option,
    migrations.AlterIndexTogether: _validate_alter_together_option,
}

# Django 5.2+ operations
if hasattr(migrations, "AlterConstraint"):
    OPERATION_VALIDATOR[migrations.AlterConstraint] = _validate_alter_constraint


def _validate_operation_identifiers(op):
    validator = OPERATION_VALIDATOR.get(type(op))
    if validator:
        validator(op)
