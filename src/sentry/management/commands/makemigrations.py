import os
import sys

from django.conf import settings
from django.core.management.commands import makemigrations
from django.db.migrations.loader import MigrationLoader

template = """Django migrations lock file. This helps us avoid migration conflicts on master.
If you have a conflict in this file, it means that someone has committed a migration
ahead of you.

To resolve this, rebase against latest master and regenerate your migration. This file
will then be regenerated, and you should be able to merge without conflicts.

%s
"""


# We check that the latest migration is the one stored in the lockfile
def validate(migrations_filepath, latest_migration_by_app):
    infile = {}
    with open(migrations_filepath, encoding="utf-8") as file:
        for line in file:
            try:
                app_label, name = line.split(": ")
                infile[app_label] = name.strip()
            except ValueError:
                pass

    for app_label, name in sorted(latest_migration_by_app.items()):
        if infile[app_label] != name:
            print(  # noqa: B314
                f"ERROR: The latest migration does not match the one in the lockfile -> `{app_label}` app: {name} vs {infile[app_label]}"
            )
            # makemigrations.Command --check exits with 1 if a migration needs to be generated
            sys.exit(2)


class Command(makemigrations.Command):
    """
    Generates a lockfile so that Git will detect merge conflicts if there's a migration
    on master that doesn't exist in a branch.
    """

    def handle(self, *app_labels, **options):
        if not options["name"] and not options.get("check_changes"):
            self.stderr.write(
                "Please name your migrations using `-n <migration_name>`. "
                "For example, `-n backfill_my_new_table`"
            )
            return
        super().handle(*app_labels, **options)
        loader = MigrationLoader(None, ignore_no_migrations=True)

        latest_migration_by_app = {}
        for migration in loader.disk_migrations.values():
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

        migrations_filepath = os.path.join(
            settings.MIGRATIONS_LOCKFILE_PATH, "migrations_lockfile.txt"
        )
        if options.get("check_changes"):
            validate(migrations_filepath, latest_migration_by_app)
        else:
            result = "\n".join(
                f"{app_label}: {name}"
                for app_label, name in sorted(latest_migration_by_app.items())
            )

            with open(migrations_filepath, "w") as f:
                f.write(template % result)
