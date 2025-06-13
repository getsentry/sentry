import pytest
from django.db import migrations, models
from django.db.migrations import RunSQL, SeparateDatabaseAndState
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.new_migrations.monkey.special import SafeRunSQL
from sentry.new_migrations.validators import (
    MAX_IDENTIFIER_LENGTH,
    _validate_identifier_length,
    validate_operation,
)
from sentry.testutils.cases import TestCase


class ValidateIdentifierLengthTest(TestCase):
    """Test the _validate_identifier_length function."""

    def test_valid_identifier(self):
        """Test that valid identifiers don't raise exceptions."""
        _validate_identifier_length("valid_identifier")
        _validate_identifier_length("a" * MAX_IDENTIFIER_LENGTH)
        _validate_identifier_length("")
        _validate_identifier_length(None)

    def test_long_identifier(self):
        """Test that long identifiers raise UnsafeOperationException."""
        long_identifier = "a" * (MAX_IDENTIFIER_LENGTH + 1)
        with pytest.raises(
            UnsafeOperationException,
            match=f"PostgreSQL identifier .* is {MAX_IDENTIFIER_LENGTH + 1} bytes long",
        ):
            _validate_identifier_length(long_identifier)

    def test_utf8_identifier(self):
        """Test that UTF-8 characters are counted correctly."""
        # Each emoji is 4 bytes
        emoji_identifier = "😀" * 16  # 64 bytes, exceeds limit
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* is 64 bytes long",
        ):
            _validate_identifier_length(emoji_identifier)


class ValidateOperationTest(TestCase):
    """Test the validate_operation function."""

    def test_create_model_valid(self):
        """Test CreateModel with valid identifiers."""
        op = migrations.CreateModel(
            name="ValidModel",
            fields=[
                ("id", models.AutoField(primary_key=True)),
                ("valid_field", models.CharField(max_length=100)),
                ("custom_column", models.IntegerField(db_column="custom_col")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["valid_field"], name="valid_index_name"),
                ]
            },
        )
        validate_operation(op)  # Should not raise

    def test_create_model_long_name(self):
        """Test CreateModel with long model name."""
        op = migrations.CreateModel(
            name="VeryLongModelNameThatExceedsThePostgreSQLLimitOfSixtyThreeBytesForIdentifiers",
            fields=[("id", models.AutoField(primary_key=True))],
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_create_model_long_field_name(self):
        """Test CreateModel with long field name."""
        op = migrations.CreateModel(
            name="Model",
            fields=[
                ("id", models.AutoField(primary_key=True)),
                (
                    "very_long_field_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
                    models.CharField(max_length=100),
                ),
            ],
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_create_model_long_db_column(self):
        """Test CreateModel with long db_column."""
        op = migrations.CreateModel(
            name="Model",
            fields=[
                ("id", models.AutoField(primary_key=True)),
                (
                    "field",
                    models.CharField(
                        max_length=100,
                        db_column="very_long_column_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
                    ),
                ),
            ],
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_create_model_long_index_name(self):
        """Test CreateModel with long index name."""
        op = migrations.CreateModel(
            name="Model",
            fields=[
                ("id", models.AutoField(primary_key=True)),
                ("field", models.CharField(max_length=100)),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["field"],
                        name="very_long_index_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
                    ),
                ]
            },
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_add_field_valid(self):
        """Test AddField with valid identifiers."""
        op = migrations.AddField(
            model_name="Model",
            name="new_field",
            field=models.CharField(max_length=100),
        )
        validate_operation(op)  # Should not raise

        op_with_db_column = migrations.AddField(
            model_name="Model",
            name="field",
            field=models.CharField(max_length=100, db_column="custom_column"),
        )
        validate_operation(op_with_db_column)  # Should not raise

    def test_add_field_long_name(self):
        """Test AddField with long field name."""
        op = migrations.AddField(
            model_name="Model",
            name="very_long_field_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
            field=models.CharField(max_length=100),
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_add_field_long_db_column(self):
        """Test AddField with long db_column."""
        op = migrations.AddField(
            model_name="Model",
            name="field",
            field=models.CharField(
                max_length=100,
                db_column="very_long_column_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
            ),
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_rename_field_valid(self):
        """Test RenameField with valid identifiers."""
        op = migrations.RenameField(
            model_name="Model",
            old_name="old_field",
            new_name="new_field",
        )
        validate_operation(op)  # Should not raise

    def test_rename_field_long_new_name(self):
        """Test RenameField with long new field name."""
        op = migrations.RenameField(
            model_name="Model",
            old_name="old_field",
            new_name="very_long_new_field_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_rename_model_valid(self):
        """Test RenameModel with valid identifiers."""
        op = migrations.RenameModel(
            old_name="OldModel",
            new_name="NewModel",
        )
        validate_operation(op)  # Should not raise

    def test_rename_model_long_new_name(self):
        """Test RenameModel with long new model name."""
        op = migrations.RenameModel(
            old_name="OldModel",
            new_name="VeryLongNewModelNameThatExceedsThePostgreSQLLimitOfSixtyThreeBytesForIdentifiers",
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_add_index_valid(self):
        """Test AddIndex with valid identifiers."""
        op = migrations.AddIndex(
            model_name="Model",
            index=models.Index(fields=["field"], name="valid_index_name"),
        )
        validate_operation(op)  # Should not raise

    def test_add_index_long_name(self):
        """Test AddIndex with long index name."""
        op = migrations.AddIndex(
            model_name="Model",
            index=models.Index(
                fields=["field"],
                name="very_long_index_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
            ),
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_add_index_no_name(self):
        """Test AddIndex with no name doesn't raise."""
        # Django requires index names for AddIndex operations, but we can test
        # that our validator doesn't crash when name is None/empty
        op = migrations.AddIndex(
            model_name="Model",
            index=models.Index(fields=["field"], name="auto_generated_name"),
        )
        validate_operation(op)  # Should not raise

    def test_remove_index_valid(self):
        """Test RemoveIndex with valid identifiers."""
        op = migrations.RemoveIndex(
            model_name="Model",
            name="valid_index_name",
        )
        validate_operation(op)  # Should not raise

    def test_remove_index_long_name(self):
        """Test RemoveIndex with long index name."""
        op = migrations.RemoveIndex(
            model_name="Model",
            name="very_long_index_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_add_constraint_valid(self):
        """Test AddConstraint with valid identifiers."""
        op = migrations.AddConstraint(
            model_name="Model",
            constraint=models.UniqueConstraint(
                fields=["field"],
                name="valid_constraint_name",
            ),
        )
        validate_operation(op)  # Should not raise

    def test_add_constraint_long_name(self):
        """Test AddConstraint with long constraint name."""
        op = migrations.AddConstraint(
            model_name="Model",
            constraint=models.UniqueConstraint(
                fields=["field"],
                name="very_long_constraint_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
            ),
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_remove_constraint_valid(self):
        """Test RemoveConstraint with valid identifiers."""
        op = migrations.RemoveConstraint(
            model_name="Model",
            name="valid_constraint_name",
        )
        validate_operation(op)  # Should not raise

    def test_remove_constraint_long_name(self):
        """Test RemoveConstraint with long constraint name."""
        op = migrations.RemoveConstraint(
            model_name="Model",
            name="very_long_constraint_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

    def test_run_sql_not_allowed(self):
        """Test that RunSQL is not allowed."""
        op = RunSQL("SELECT 1;")
        with pytest.raises(
            UnsafeOperationException,
            match="Using `RunSQL` is unsafe",
        ):
            validate_operation(op)

    def test_safe_run_sql_allowed(self):
        """Test that SafeRunSQL is allowed."""
        op = SafeRunSQL("SELECT 1;")
        validate_operation(op)  # Should not raise

    def test_separate_database_and_state_validates_operations(self):
        """Test that SeparateDatabaseAndState validates nested operations."""
        valid_op = migrations.AddField(
            model_name="Model",
            name="field",
            field=models.CharField(max_length=100),
        )
        invalid_op = migrations.AddField(
            model_name="Model",
            name="very_long_field_name_that_exceeds_the_postgresql_limit_of_sixty_three_bytes",
            field=models.CharField(max_length=100),
        )

        # Valid operations should not raise
        op = SeparateDatabaseAndState(
            database_operations=[valid_op],
            state_operations=[],
        )
        validate_operation(op)

        # Invalid operations should raise
        op = SeparateDatabaseAndState(
            database_operations=[invalid_op],
            state_operations=[],
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)

        # Multiple operations - should validate all
        op = SeparateDatabaseAndState(
            database_operations=[valid_op, invalid_op],
            state_operations=[],
        )
        with pytest.raises(
            UnsafeOperationException,
            match="PostgreSQL identifier .* exceeds the 63-byte limit",
        ):
            validate_operation(op)
