from __future__ import absolute_import, unicode_literals

import io
import os

import six
from django.conf import settings
from django.db.migrations.loader import MigrationLoader
from django.core.management.commands import makemigrations

template = """Django migrations lock file. This helps us avoid migration conflicts on master.
If you have a conflict in this file, it means that someone has committed a migration
ahead of you.

To resolve this, rebase against latest master and regenerate your migration. This file
will then be regenerated, and you should be able to merge without conflicts.

%s
"""


class Command(makemigrations.Command):
    """
    Generates a lockfile so that Git will detect merge conflicts if there's a migration
    on master that doesn't exist in a branch.
    """

    def handle(self, *app_labels, **options):
        if not options["name"]:
            self.stderr.write(
                "Please name your migrations using `-n <migration_name>`. "
                "For example, `-n backfill_my_new_table`"
            )
            return
        super(Command, self).handle(*app_labels, **options)
        loader = MigrationLoader(None, ignore_no_migrations=True)

        latest_migration_by_app = {}
        for migration in six.itervalues(loader.disk_migrations):
            name = migration.name
            app_label = migration.app_label
            if (
                settings.MIGRATIONS_LOCKFILE_APP_WHITELIST
                and app_label not in settings.MIGRATIONS_LOCKFILE_APP_WHITELIST
            ):
                continue
            latest_migration_by_app[app_label] = max(
                latest_migration_by_app.get(app_label, ""), name
            )

        result = "\n".join(
            "{}: {}".format(app_label, name)
            for app_label, name in sorted(latest_migration_by_app.items())
        )

        with io.open(
            os.path.join(settings.MIGRATIONS_LOCKFILE_PATH, "migrations_lockfile.txt"), "w"
        ) as f:
            f.write(template % result)
