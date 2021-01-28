import logging
import os

from django.db.migrations.executor import MigrationExecutor

logger = logging.getLogger(__name__)


class SentryMigrationExecutor(MigrationExecutor):
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
        fake = self._check_fake(migration, fake)
        return super().apply_migration(state, migration, fake=fake, fake_initial=fake_initial)

    def unapply_migration(self, state, migration, fake=False):
        fake = self._check_fake(migration, fake)
        return super().unapply_migration(state, migration, fake=fake)
