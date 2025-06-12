import pytest
from django.db import migrations, models
from django.db.models import Index

from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from sentry.new_migrations.validators import (
    _validate_identifier_length,
    validate_operation,
)
from sentry.new_migrations.monkey.special import SafeRunSQL


class TestIdentifierLengthValidation:
    def test_validate_identifier_length_valid(self):
        """Test that valid identifiers pass validation."""
        _validate_identifier_length("valid_name")
        _validate_identifier_length("a" * 63)  # Max length
        _validate_identifier_length("")  # Empty string
        _validate_identifier_length(None)  # None value

    def test_validate_identifier_length_invalid(self):
        """Test that identifiers exceeding 63 bytes raise an exception."""
        with pytest.raises(UnsafeOperationException) as exc:
            _validate_identifier_length("a" * 64)  # 64 bytes, exceeds limit

        assert "exceeds the 63-byte limit" in str(exc.value)
        assert "64 bytes long" in str(exc.value)

    def test_validate_identifier_length_unicode(self):
        """Test that unicode characters are properly counted in bytes."""
        # Each of these characters is 3 bytes in UTF-8
        unicode_str = "★" * 21  # 21 * 3 = 63 bytes
        _validate_identifier_length(unicode_str)  # Should pass

        # 22 * 3 = 66 bytes, should fail
        with pytest.raises(UnsafeOperationException) as exc:
            _validate_identifier_length("★" * 22)

        assert "66 bytes long" in str(exc.value)


class TestMigrationOperations:
    def test_create_model_valid(self):
        """Test CreateModel with valid identifiers."""
        op = migrations.CreateModel(
            name="ValidModel",
            fields=[
                ("id", models.IntegerField(primary_key=True)),
                ("name", models.CharField(max_length=100)),
                ("custom_column", models.CharField(max_length=50, db_column="custom")),
            ],
            options={
                "indexes": [Index(name="valid_idx", fields=["name"])],
                "constraints": [models.UniqueConstraint(fields=["name"], name="valid_constraint")],
            },
        )
        validate_operation(op)  # Should not raise

    def test_create_model_invalid_table_name(self):
        """Test CreateModel with table name exceeding limit."""
        op = migrations.CreateModel(
            name="A" * 64,  # Exceeds 63 bytes
            fields=[("id", models.IntegerField(primary_key=True))],
        )
        with pytest.raises(UnsafeOperationException) as exc:
            validate_operation(op)
        assert "64 bytes long" in str(exc.value)

    def test_create_model_invalid_field_name(self):
        """Test CreateModel with field name exceeding limit."""
        op = migrations.CreateModel(
            name="ValidModel",
            fields=[
                ("id", models.IntegerField(primary_key=True)),
                ("a" * 64, models.CharField(max_length=100)),  # Field name too long
            ],
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_create_model_invalid_db_column(self):
        """Test CreateModel with db_column exceeding limit."""
        op = migrations.CreateModel(
            name="ValidModel",
            fields=[
                ("id", models.IntegerField(primary_key=True)),
                (
                    "name",
                    models.CharField(max_length=100, db_column="a" * 64),
                ),  # db_column too long
            ],
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_create_model_invalid_index_name(self):
        """Test CreateModel with index name exceeding limit."""
        op = migrations.CreateModel(
            name="ValidModel",
            fields=[("id", models.IntegerField(primary_key=True))],
            options={
                "indexes": [Index(name="a" * 64, fields=["id"])],  # Index name too long
            },
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_delete_model_valid(self):
        """Test DeleteModel with valid identifier."""
        op = migrations.DeleteModel(name="ValidModel")
        validate_operation(op)  # Should not raise

    def test_delete_model_invalid(self):
        """Test DeleteModel with name exceeding limit."""
        op = migrations.DeleteModel(name="A" * 64)
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_add_field_valid(self):
        """Test AddField with valid identifiers."""
        op = migrations.AddField(
            model_name="MyModel",
            name="new_field",
            field=models.CharField(max_length=100),
        )
        validate_operation(op)

    def test_add_field_invalid_name(self):
        """Test AddField with field name exceeding limit."""
        op = migrations.AddField(
            model_name="MyModel",
            name="a" * 64,  # Field name too long
            field=models.CharField(max_length=100),
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_add_field_invalid_db_column(self):
        """Test AddField with db_column exceeding limit."""
        op = migrations.AddField(
            model_name="MyModel",
            name="new_field",
            field=models.CharField(max_length=100, db_column="a" * 64),  # db_column too long
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_rename_field_valid(self):
        """Test RenameField with valid identifiers."""
        op = migrations.RenameField(
            model_name="MyModel",
            old_name="old_field",
            new_name="new_field",
        )
        validate_operation(op)

    def test_rename_field_invalid(self):
        """Test RenameField with names exceeding limit."""
        # Old name too long
        op = migrations.RenameField(
            model_name="MyModel",
            old_name="a" * 64,
            new_name="new_field",
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

        # New name too long
        op = migrations.RenameField(
            model_name="MyModel",
            old_name="old_field",
            new_name="a" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_rename_model_valid(self):
        """Test RenameModel with valid identifiers."""
        op = migrations.RenameModel(
            old_name="OldModel",
            new_name="NewModel",
        )
        validate_operation(op)

    def test_rename_model_invalid(self):
        """Test RenameModel with names exceeding limit."""
        # Old name too long
        op = migrations.RenameModel(
            old_name="A" * 64,
            new_name="NewModel",
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

        # New name too long
        op = migrations.RenameModel(
            old_name="OldModel",
            new_name="A" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_add_index_valid(self):
        """Test AddIndex with valid identifier."""
        op = migrations.AddIndex(
            model_name="MyModel",
            index=Index(name="valid_index", fields=["field1"]),
        )
        validate_operation(op)

    def test_add_index_invalid(self):
        """Test AddIndex with name exceeding limit."""
        op = migrations.AddIndex(
            model_name="MyModel",
            index=Index(name="a" * 64, fields=["field1"]),
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_remove_index_valid(self):
        """Test RemoveIndex with valid identifier."""
        op = migrations.RemoveIndex(
            model_name="MyModel",
            name="valid_index",
        )
        validate_operation(op)

    def test_remove_index_invalid(self):
        """Test RemoveIndex with name exceeding limit."""
        op = migrations.RemoveIndex(
            model_name="MyModel",
            name="a" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_alter_model_table_valid(self):
        """Test AlterModelTable with valid identifier."""
        op = migrations.AlterModelTable(
            name="MyModel",
            table="new_table_name",
        )
        validate_operation(op)

    def test_alter_model_table_invalid(self):
        """Test AlterModelTable with table name exceeding limit."""
        op = migrations.AlterModelTable(
            name="MyModel",
            table="a" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_alter_model_table_none(self):
        """Test AlterModelTable with None table (reset to default)."""
        op = migrations.AlterModelTable(
            name="MyModel",
            table=None,
        )
        validate_operation(op)  # Should not raise

    def test_add_constraint_valid(self):
        """Test AddConstraint with valid identifier."""
        op = migrations.AddConstraint(
            model_name="MyModel",
            constraint=models.UniqueConstraint(fields=["field1"], name="valid_constraint"),
        )
        validate_operation(op)

    def test_add_constraint_invalid(self):
        """Test AddConstraint with name exceeding limit."""
        op = migrations.AddConstraint(
            model_name="MyModel",
            constraint=models.UniqueConstraint(fields=["field1"], name="a" * 64),
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_remove_constraint_valid(self):
        """Test RemoveConstraint with valid identifier."""
        op = migrations.RemoveConstraint(
            model_name="MyModel",
            name="valid_constraint",
        )
        validate_operation(op)

    def test_remove_constraint_invalid(self):
        """Test RemoveConstraint with name exceeding limit."""
        op = migrations.RemoveConstraint(
            model_name="MyModel",
            name="a" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_alter_field_valid(self):
        """Test AlterField with valid identifiers."""
        op = migrations.AlterField(
            model_name="MyModel",
            name="field_name",
            field=models.CharField(max_length=200),
        )
        validate_operation(op)

    def test_alter_field_invalid_name(self):
        """Test AlterField with field name exceeding limit."""
        op = migrations.AlterField(
            model_name="MyModel",
            name="a" * 64,
            field=models.CharField(max_length=200),
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_alter_field_invalid_db_column(self):
        """Test AlterField with db_column exceeding limit."""
        op = migrations.AlterField(
            model_name="MyModel",
            name="field_name",
            field=models.CharField(max_length=200, db_column="a" * 64),
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_rename_index_valid(self):
        """Test RenameIndex with valid identifiers."""
        op = migrations.RenameIndex(
            model_name="MyModel",
            old_name="old_index",
            new_name="new_index",
        )
        validate_operation(op)

    def test_rename_index_invalid(self):
        """Test RenameIndex with names exceeding limit."""
        # Old name too long
        op = migrations.RenameIndex(
            model_name="MyModel",
            old_name="a" * 64,
            new_name="new_index",
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

        # New name too long
        op = migrations.RenameIndex(
            model_name="MyModel",
            old_name="old_index",
            new_name="a" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_remove_field_valid(self):
        """Test RemoveField with valid identifier."""
        op = migrations.RemoveField(
            model_name="MyModel",
            name="field_name",
        )
        validate_operation(op)

    def test_remove_field_invalid(self):
        """Test RemoveField with name exceeding limit."""
        op = migrations.RemoveField(
            model_name="MyModel",
            name="a" * 64,
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_alter_unique_together_valid(self):
        """Test AlterUniqueTogether with valid identifiers."""
        op = migrations.AlterUniqueTogether(
            name="MyModel",
            unique_together=[["field1", "field2"]],
        )
        validate_operation(op)

    def test_alter_unique_together_invalid(self):
        """Test AlterUniqueTogether with field names exceeding limit."""
        op = migrations.AlterUniqueTogether(
            name="MyModel",
            unique_together=[["field1", "a" * 64]],  # Second field too long
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

    def test_alter_index_together_valid(self):
        """Test AlterIndexTogether with valid identifiers."""
        op = migrations.AlterIndexTogether(
            name="MyModel",
            index_together=[["field1", "field2"]],
        )
        validate_operation(op)

    def test_alter_index_together_invalid(self):
        """Test AlterIndexTogether with field names exceeding limit."""
        op = migrations.AlterIndexTogether(
            name="MyModel",
            index_together=[["a" * 64, "field2"]],  # First field too long
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)


class TestSpecialOperations:
    def test_run_sql_unsafe(self):
        """Test that RunSQL raises exception when not using SafeRunSQL."""
        op = migrations.RunSQL("SELECT 1;")
        with pytest.raises(UnsafeOperationException) as exc:
            validate_operation(op)
        assert "Using `RunSQL` is unsafe" in str(exc.value)

    def test_safe_run_sql(self):
        """Test that SafeRunSQL passes validation."""
        op = SafeRunSQL("SELECT 1;")
        validate_operation(op)  # Should not raise

    def test_separate_database_and_state(self):
        """Test SeparateDatabaseAndState validates nested operations."""
        # With unsafe RunSQL
        op = migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL("SELECT 1;"),  # Unsafe
            ]
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)

        # With safe operations
        op = migrations.SeparateDatabaseAndState(
            database_operations=[
                SafeRunSQL("SELECT 1;"),  # Safe
            ]
        )
        validate_operation(op)  # Should not raise

        # With identifier validation
        op = migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.AddField(
                    model_name="MyModel",
                    name="a" * 64,  # Too long
                    field=models.CharField(max_length=100),
                ),
            ]
        )
        with pytest.raises(UnsafeOperationException):
            validate_operation(op)


# Test for Django 5.2+ operations
if hasattr(migrations, "AlterConstraint"):

    class TestAlterConstraint:
        def test_alter_constraint_valid(self):
            """Test AlterConstraint with valid identifiers."""
            op = migrations.AlterConstraint(
                model_name="MyModel",
                name="old_constraint",
                constraint=models.UniqueConstraint(fields=["field1"], name="new_constraint"),
            )
            validate_operation(op)

        def test_alter_constraint_invalid_name(self):
            """Test AlterConstraint with old name exceeding limit."""
            op = migrations.AlterConstraint(
                model_name="MyModel",
                name="a" * 64,  # Old name too long
                constraint=models.UniqueConstraint(fields=["field1"], name="new_constraint"),
            )
            with pytest.raises(UnsafeOperationException):
                validate_operation(op)

        def test_alter_constraint_invalid_new_name(self):
            """Test AlterConstraint with new constraint name exceeding limit."""
            op = migrations.AlterConstraint(
                model_name="MyModel",
                name="old_constraint",
                constraint=models.UniqueConstraint(fields=["field1"], name="a" * 64),
            )
            with pytest.raises(UnsafeOperationException):
                validate_operation(op)
