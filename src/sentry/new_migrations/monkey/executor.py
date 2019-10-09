from __future__ import absolute_import

import logging
import os

from sentry.new_migrations.django_19_executor.django import Django19MigrationExecutor

logger = logging.getLogger(__name__)


class SentryMigrationExecutor(Django19MigrationExecutor):
    # TODO: Once we're on Django 1.9, just inherit from
    # `django.db.migrations.executor.MigrationExecutor`

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
        return super(SentryMigrationExecutor, self).apply_migration(
            state, migration, fake=fake, fake_initial=fake_initial
        )

    def unapply_migration(self, state, migration, fake=False):
        fake = self._check_fake(migration, fake)
        return super(SentryMigrationExecutor, self).unapply_migration(state, migration, fake=fake)
