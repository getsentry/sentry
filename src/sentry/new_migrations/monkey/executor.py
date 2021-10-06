import logging
import os

from django.contrib.contenttypes.management import RenameContentType
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.operations import SeparateDatabaseAndState
from django.db.migrations.operations.fields import FieldOperation
from django.db.migrations.operations.models import IndexOperation, ModelOperation

logger = logging.getLogger(__name__)


class MissingDatabaseRoutingInfo(Exception):
    """
    Raised when migration operation is missing information needed for selecting
    correct database connection.
    """


class SentryMigrationExecutor(MigrationExecutor):
    @staticmethod
    def _check_db_routing(migration):
        """
        Make sure that operations in a given migration provide enough information
        for database router to select correct database connection/alias.

        We use either model or `tables` attribute in hints to select the database.
        See: getsentry/db/router.py#L38-L53

        - FieldOperation, ModelOperation operations are bound to a model
        - RunSQL, RunPython need to provide hints['tables']
        """

        if migration.app_label not in {"sentry", "getsentry"}:
            return

        def _check_operations(operations):
            failed_ops = []
            for operation in operations:
                if isinstance(
                    operation, (FieldOperation, ModelOperation, RenameContentType, IndexOperation)
                ):
                    continue
                elif isinstance(operation, SeparateDatabaseAndState):
                    failed_ops.extend(_check_operations(operation.database_operations))
                    continue
                else:
                    # Check all the other operation types (RunSQL, RunPython, unknown)
                    if operation.hints.get("tables"):
                        continue
                    else:
                        failed_ops.append(operation)
            return failed_ops

        failed_ops = _check_operations(migration.operations)
        if failed_ops:
            ops_msg = "\n".join(str(op) for op in failed_ops)
            raise MissingDatabaseRoutingInfo(
                f"Migration `{migration.app_label} {migration.name}` contains "
                "operation(s) that miss `hints={'tables':..}` argument for "
                "correctly selecting database connection/alias. "
                f"\nOperations:\n{ops_msg}"
            )

    def _check_fake(self, migration, fake):
        if (
            os.environ.get("MIGRATION_SKIP_DANGEROUS", "0") == "1"
            or os.environ.get("SOUTH_SKIP_DANGEROUS", "0") == "1"
        ) and getattr(migration, "is_dangerous", False):
            # If we plan to skip migrations we just set `fake` to True here. This causes
            # Django to skip running the migration, but records the row as expected.
            fake = True
            logger.warning("(too dangerous)")
        return fake

    def apply_migration(self, state, migration, fake=False, fake_initial=False):
        self._check_db_routing(migration)
        fake = self._check_fake(migration, fake)
        return super().apply_migration(state, migration, fake=fake, fake_initial=fake_initial)

    def unapply_migration(self, state, migration, fake=False):
        self._check_db_routing(migration)
        fake = self._check_fake(migration, fake)
        return super().unapply_migration(state, migration, fake=fake)
