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


def _validate_create_model_identifier_length(op):
    _validate_identifier_length(op.name)
    # check field names
    for field_name, field in op.fields:
        if hasattr(field, "db_column"):
            _validate_identifier_length(field.db_column)
        else:
            _validate_identifier_length(field_name)
    # check indexes
    if hasattr(op, "options") and op.options:
        indexes = op.options.get("indexes", [])
        for index in indexes:
            if hasattr(index, "name") and index.name:
                _validate_identifier_length(index.name)


def _validate_add_field_identifier_length(op):
    """Validate identifier length for AddField operation."""
    _validate_identifier_length(op.name)
    # Check db_column if specified
    if hasattr(op.field, "db_column") and op.field.db_column:
        _validate_identifier_length(op.field.db_column)


def _validate_rename_field_identifier_length(op):
    """Validate identifier length for RenameField operation."""
    _validate_identifier_length(op.new_name)


def _validate_rename_model_identifier_length(op):
    """Validate identifier length for RenameModel operation."""
    # Model names become table names (usually prefixed with app name)
    _validate_identifier_length(op.new_name)


def _validate_add_index_identifier_length(op):
    """Validate identifier length for AddIndex operation."""
    if hasattr(op.index, "name") and op.index.name:
        _validate_identifier_length(op.index.name)


def _validate_remove_index_identifier_length(op):
    """Validate identifier length for RemoveIndex operation."""
    if hasattr(op, "name") and op.name:
        _validate_identifier_length(op.name)


def _validate_add_constraint_identifier_length(op):
    """Validate identifier length for AddConstraint operation."""
    if hasattr(op.constraint, "name") and op.constraint.name:
        _validate_identifier_length(op.constraint.name)


def _validate_remove_constraint_identifier_length(op):
    """Validate identifier length for RemoveConstraint operation."""
    if hasattr(op, "name") and op.name:
        _validate_identifier_length(op.name)


OPERATION_VALIDATOR = {
    migrations.CreateModel: _validate_create_model_identifier_length,
    migrations.AddField: _validate_add_field_identifier_length,
    migrations.RenameField: _validate_rename_field_identifier_length,
    migrations.RenameModel: _validate_rename_model_identifier_length,
    migrations.AddIndex: _validate_add_index_identifier_length,
    migrations.RemoveIndex: _validate_remove_index_identifier_length,
    migrations.AddConstraint: _validate_add_constraint_identifier_length,
    migrations.RemoveConstraint: _validate_remove_constraint_identifier_length,
}


def _validate_operation_identifiers(op):
    validator = OPERATION_VALIDATOR.get(type(op))
    if validator:
        validator(op)
