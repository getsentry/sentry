"""
Tests for SafeDeleteModel validation that ensures deleted models are added to
historical_silo_assignments.
"""

from typing import cast

import pytest
from django.db import connection, models

from sentry.db.postgres.schema import SafePostgresDatabaseSchemaEditor
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState
from sentry.testutils.cases import TestCase


class SafeDeleteModelTest(TestCase):
    """
    Tests that SafeDeleteModel fails loudly when a deleted model is not in
    historical_silo_assignments.
    """

    def test_delete_model_without_historical_assignment_fails(self) -> None:
        """
        When deleting a model that is not in historical_silo_assignments and
        cannot be found, SafeDeleteModel should raise a ValueError in test
        environments.
        """
        # Create a mock model that mimics a deleted model not in the Django registry
        # This simulates what happens when a model class has been removed but
        # migrations still reference it
        from unittest.mock import Mock

        fake_meta = Mock()
        fake_meta.db_table = "sentry_fake_deleted_table_not_in_router"
        fake_meta.app_label = "sentry"
        fake_meta.model_name = "fakedeletedmodel"

        FakeDeletedModel = Mock()
        FakeDeletedModel._meta = fake_meta

        # Create project states
        from_state = SentryProjectState()
        to_state = SentryProjectState()

        # Manually add the model to pending deletion in the from_state
        # This simulates what happens when a model was marked for pending deletion
        # and is now being deleted
        from_state.pending_deletion_models[("sentry", "fakedeletedmodel")] = FakeDeletedModel

        # Create the SafeDeleteModel operation
        operation = SafeDeleteModel(name="FakeDeletedModel", deletion_action=DeletionAction.DELETE)

        # Get schema editor
        with connection.schema_editor() as schema_editor:
            # This should raise ValueError because the table is not in historical_silo_assignments
            with pytest.raises(ValueError) as exc_info:
                operation.database_forwards(
                    "sentry",
                    cast(SafePostgresDatabaseSchemaEditor, schema_editor),
                    from_state,
                    to_state,
                )

            assert "Cannot determine database for deleted model" in str(exc_info.value)
            assert "sentry_fake_deleted_table_not_in_router" in str(exc_info.value)
            assert "historical_silo_assignments" in str(exc_info.value)

    def test_delete_model_with_move_to_pending_skips_validation(self) -> None:
        """
        MOVE_TO_PENDING operations should not trigger the validation check
        since the model class still exists at that point.
        """

        class FakeModel(models.Model):
            class Meta:
                app_label = "sentry"
                db_table = "sentry_fake_table"

        from_state = SentryProjectState()
        to_state = SentryProjectState()

        operation = SafeDeleteModel(
            name="FakeModel", deletion_action=DeletionAction.MOVE_TO_PENDING
        )

        with connection.schema_editor() as schema_editor:
            # Should not raise - MOVE_TO_PENDING exits early
            operation.database_forwards(
                "sentry",
                cast(SafePostgresDatabaseSchemaEditor, schema_editor),
                from_state,
                to_state,
            )
