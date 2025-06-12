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


OPERATION_VALIDATOR = {
    migrations.CreateModel: _validate_create_model_identifier_length,
    migrations.AddField: None,
    migrations.RenameField: None,
    migrations.RenameModel: None,
    migrations.AddIndex: None,
    migrations.RemoveIndex: None,
}


def _validate_operation_identifiers(op):
    validator = OPERATION_VALIDATOR.get(type(op))
    if validator:
        validator(op)
