import difflib
import logging
import os

from django.contrib.contenttypes.management import RenameContentType
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.migration import Migration
from django.db.migrations.operations import AlterField, SeparateDatabaseAndState
from django.db.migrations.operations.fields import FieldOperation
from django.db.migrations.operations.models import IndexOperation, ModelOperation
from django.db.migrations.state import ProjectState

from bitfield.models import BitField

logger = logging.getLogger(__name__)


class MissingDatabaseRoutingInfo(Exception):
    """
    Raised when migration operation is missing information needed for selecting
    correct database connection.
    """


def _check_bitfield_flags(name: str, old: list[str], new: list[str]) -> None:
    deleted = set(old) - set(new)
    if deleted:
        raise ValueError(
            f"migration `{name}` alters a BitField in an unsafe way!\n\n"
            f'the following flags were removed: {", ".join(sorted(deleted))}\n\n'
            f"unused flags must remain to preserve padding for future flags"
        )

    should_match_old = new[: len(old)]

    inserted = set(should_match_old) - set(old)
    if inserted:
        raise ValueError(
            f"migration `{name}` alters a BitField in an unsafe way!\n\n"
            f'the following flags were inserted between old flags: {", ".join(sorted(inserted))}\n\n'
            f"new flags must be added at the end or flags will change meaning"
        )

    if old != should_match_old:
        diff = "\n".join(
            difflib.unified_diff(old, should_match_old, fromfile="old", tofile="new", lineterm="")
        )

        raise ValueError(
            f"migration `{name}` alters a BitField in an unsafe way!\n\n"
            f"the following old flags were reordered:\n\n"
            f"{diff}\n\n"
            f"flags must retain historical order or flags will change meaning"
        )


class SentryMigrationExecutor(MigrationExecutor):
    @staticmethod
    def _check_db_routing(migration: Migration) -> None:
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

    @staticmethod
    def _check_unsafe_bitfield_alter(state: ProjectState, migration: Migration) -> None:
        if getattr(migration, "skip_invalid_bitfield_change_check", False):
            return

        for operation in migration.operations:
            if isinstance(operation, AlterField) and isinstance(operation.field, BitField):
                try:
                    previous_flags = (
                        state.models[(migration.app_label, operation.model_name)]
                        .fields[operation.name]
                        .flags
                    )
                except KeyError:  # this is a squashed migration
                    continue

                _check_bitfield_flags(migration.name, previous_flags, operation.field.flags)

    def _check_fake(self, migration: Migration, fake: bool) -> bool:
        if (
            os.environ.get("MIGRATION_SKIP_DANGEROUS", "0") == "1"
            or os.environ.get("SOUTH_SKIP_DANGEROUS", "0") == "1"
        ) and getattr(migration, "is_dangerous", False):
            # If we plan to skip migrations we just set `fake` to True here. This causes
            # Django to skip running the migration, but records the row as expected.
            fake = True
            logger.warning("(too dangerous)")
        return fake

    def apply_migration(
        self,
        state: ProjectState,
        migration: Migration,
        fake: bool = False,
        fake_initial: bool = False,
    ) -> ProjectState:
        self._check_db_routing(migration)
        self._check_unsafe_bitfield_alter(state, migration)
        fake = self._check_fake(migration, fake)
        return super().apply_migration(state, migration, fake=fake, fake_initial=fake_initial)

    def unapply_migration(
        self, state: ProjectState, migration: Migration, fake: bool = False
    ) -> ProjectState:
        self._check_db_routing(migration)
        fake = self._check_fake(migration, fake)
        return super().unapply_migration(state, migration, fake=fake)
