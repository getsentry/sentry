"""
Overridden syncdb command
"""

from __future__ import print_function

import sys

from importlib import import_module
from optparse import make_option

from django.core.management.base import NoArgsCommand, BaseCommand, CommandError
from django.core.management.color import no_style
from django.utils.datastructures import SortedDict
from django.core.management.commands import syncdb
from django.conf import settings
from django.db import connections, models
from django.db.models.loading import cache
from django.core import management

try:
    from django.apps import apps
except ImportError:
    apps = None

from south.db import dbs
from south import migration
from south.constants import DJANGO_17
from south.exceptions import NoMigrations
from south.migration.utils import get_app_label


class Command(NoArgsCommand):
    option_list = syncdb.Command.option_list + (
        make_option(
            "--migrate",
            action="store_true",
            dest="migrate",
            default=True,
            help="Tells South to enable migrations after the sync. Default for during testing, and other internal calls.",
        ),
        make_option(
            "--merge",
            action="store_true",
            dest="merge",
            default=True,
            help="Will run out-of-order missing migrations as they are - no rollbacks.",
        ),
        make_option(
            "--delete-ghost-migrations",
            action="store_true",
            dest="delete_ghosts",
            default=False,
            help="Tells South to delete any 'ghost' migrations (ones in the database but not on disk).",
        ),
        make_option(
            "--ignore-ghost-migrations",
            action="store_true",
            dest="ignore_ghosts",
            default=True,
            help="Tells South to ignore any 'ghost' migrations (ones in the database but not on disk) and continue to apply new migrations.",
        ),
    )
    help = "Create the database tables for all apps in INSTALLED_APPS whose tables haven't already been created, except those which use migrations."

    def handle_noargs(self, **options):
        # Import the 'management' module within each installed app, to register
        # dispatcher events.
        if not hasattr(self, "stdout"):
            self.stdout = sys.stdout
            self.stderr = sys.stderr
        if DJANGO_17:
            from django.apps import apps
            from django.utils.module_loading import module_has_submodule

            for app_config in apps.get_app_configs():
                if module_has_submodule(app_config.module, "management"):
                    import_module(".management", app_config.name)
        else:
            for app_name in settings.INSTALLED_APPS:
                try:
                    import_module(".management", app_name)
                except ImportError as exc:
                    msg = exc.args[0]
                    if not msg.startswith("No module named") or "management" not in msg:
                        raise

        # Work out what uses migrations and so doesn't need syncing
        apps_needing_sync = []
        apps_migrated = []
        app_name_to_app_map = {}

        if DJANGO_17:
            for app_config in apps.get_app_configs():
                if not app_config.models_module:
                    continue

                app_label = get_app_label(app_config.models_module)
                app_name_to_app_map[app_label] = app_config
                try:
                    migrations = migration.Migrations(app_label)
                except NoMigrations:
                    # It needs syncing
                    apps_needing_sync.append(app_label)
                else:
                    # This is a migrated app, leave it
                    apps_migrated.append(app_label)
        else:
            for app in models.get_apps():
                app_label = get_app_label(app)
                try:
                    migrations = migration.Migrations(app_label)
                except NoMigrations:
                    # It needs syncing
                    apps_needing_sync.append(app_label)
                else:
                    # This is a migrated app, leave it
                    apps_migrated.append(app_label)

        verbosity = int(options.get("verbosity", 0))

        # Run syncdb on only the ones needed
        if verbosity:
            self.stdout.write("Syncing...\n")

        # This will allow the setting of the storage engine, for example.
        for db in dbs.values():
            db.connection_init()

        # In Django 1.7 we need to actually run migrations (Sentry specifically)
        # as it creates the 'auth' table. To run migrations however we still need
        # to create the south tables ahead of time.
        if DJANGO_17:
            self.sync_apps(["south"], app_name_to_app_map, options)
            apps_needing_sync.remove("south")
        # In 1.6 the constraints dont function/get created in the same way, and
        # additionally contenttypes tries to apply so syncing just south isnt enough
        else:
            self.sync_apps(apps_needing_sync, app_name_to_app_map, options)

        # Migrate if needed
        if options.get("migrate", True):
            if verbosity:
                self.stdout.write("Migrating...\n")
            management.call_command("south_migrate", **options)

        if DJANGO_17:
            self.sync_apps(apps_needing_sync, app_name_to_app_map, options)

        # Be obvious about what we did
        if verbosity:
            self.stdout.write("\nSynced:\n > {}\n".format("\n > ".join(apps_needing_sync)))

        if options.get("migrate", True):
            if verbosity:
                self.stdout.write("\nMigrated:\n - {}\n".format("\n - ".join(apps_migrated)))
        else:
            if verbosity:
                self.stdout.write(
                    "\nNot synced (use migrations):\n - {}\n".format("\n - ".join(apps_migrated))
                )
                self.stdout.write("(use ./manage.py migrate to migrate these)\n")

    def sync_apps(self, app_labels, app_name_to_app_map, options):
        if DJANGO_17:
            from django.db.migrations.executor import MigrationExecutor
            from django.core.management.commands import migrate

            apps_to_sync = []
            for app_label in app_labels:
                app_label = (
                    app_name_to_app_map[app_label].label
                    if app_label in app_name_to_app_map
                    else app_label
                )
                apps_to_sync.append(app_label)

            connection = connections[options.get("database", "default")]

            cmd = migrate.Command()
            cmd.stdout = self.stdout
            cmd.stderr = self.stderr
            cmd.run_syncdb = True
            cmd.verbosity = int(options.get("verbosity"))
            cmd.interactive = options.get("interactive")
            cmd.show_traceback = options.get("traceback")
            cmd.load_initial_data = options.get("load_initial_data")
            cmd.test_database = options.get("test_database", False)
            cmd.sync_apps(connection, apps_to_sync)
        else:
            old_installed, settings.INSTALLED_APPS = settings.INSTALLED_APPS, app_labels
            old_app_store, cache.app_store = (
                cache.app_store,
                SortedDict(
                    [(k, v) for (k, v) in cache.app_store.items() if get_app_label(k) in app_labels]
                ),
            )

            # OK, run the actual syncdb
            syncdb.Command().execute(**options)

            settings.INSTALLED_APPS = old_installed
            cache.app_store = old_app_store
