"""
Overridden syncdb command
"""

from __future__ import print_function

import sys
from optparse import make_option

from django.core.management.base import NoArgsCommand, BaseCommand 
from django.core.management.color import no_style
from django.utils.datastructures import SortedDict
from django.core.management.commands import syncdb
from django.conf import settings
from django.db import models
from django.db.models.loading import cache
from django.core import management

from south.db import dbs
from south import migration
from south.exceptions import NoMigrations

def get_app_label(app):
    return '.'.join( app.__name__.split('.')[0:-1] )

class Command(NoArgsCommand):
    option_list = syncdb.Command.option_list + ( 
        make_option('--migrate', action='store_true', dest='migrate', default=False,
            help='Tells South to also perform migrations after the sync. Default for during testing, and other internal calls.'),
        make_option('--all', action='store_true', dest='migrate_all', default=False,
            help='Makes syncdb work on all apps, even migrated ones. Be careful!'),
    )
    if '--verbosity' not in [opt.get_opt_string() for opt in syncdb.Command.option_list]:
        option_list += (
            make_option('--verbosity', action='store', dest='verbosity', default='1',
            type='choice', choices=['0', '1', '2'],
            help='Verbosity level; 0=minimal output, 1=normal output, 2=all output'),
        )
    help = "Create the database tables for all apps in INSTALLED_APPS whose tables haven't already been created, except those which use migrations."

    def handle_noargs(self, migrate_all=False, **options):
        
        # Import the 'management' module within each installed app, to register
        # dispatcher events.
        # This is copied from Django, to fix bug #511.
        try:
            from django.utils.importlib import import_module
        except ImportError:
            pass # TODO: Remove, only for Django1.0
        else:
            for app_name in settings.INSTALLED_APPS:
                try:
                    import_module('.management', app_name)
                except ImportError as exc:
                    msg = exc.args[0]
                    if not msg.startswith('No module named') or 'management' not in msg:
                        raise
        
        # Work out what uses migrations and so doesn't need syncing
        apps_needing_sync = []
        apps_migrated = []
        for app in models.get_apps():
            app_label = get_app_label(app)
            if migrate_all:
                apps_needing_sync.append(app_label)
            else:
                try:
                    migrations = migration.Migrations(app_label)
                except NoMigrations:
                    # It needs syncing
                    apps_needing_sync.append(app_label)
                else:
                    # This is a migrated app, leave it
                    apps_migrated.append(app_label)
        verbosity = int(options.get('verbosity', 0))
        
        # Run syncdb on only the ones needed
        if verbosity:
            print("Syncing...")
        
        old_installed, settings.INSTALLED_APPS = settings.INSTALLED_APPS, apps_needing_sync
        old_app_store, cache.app_store = cache.app_store, SortedDict([
            (k, v) for (k, v) in cache.app_store.items()
            if get_app_label(k) in apps_needing_sync
        ])
        
        # This will allow the setting of the MySQL storage engine, for example.
        for db in dbs.values(): 
            db.connection_init() 
        
        # OK, run the actual syncdb
        syncdb.Command().execute(**options)
        
        settings.INSTALLED_APPS = old_installed
        cache.app_store = old_app_store
        
        # Migrate if needed
        if options.get('migrate', True):
            if verbosity:
                print("Migrating...")
            # convert from store_true to store_false
            options['no_initial_data'] = not options.get('load_initial_data', True)
            management.call_command('migrate', **options)
        
        # Be obvious about what we did
        if verbosity:
            print("\nSynced:\n > %s" % "\n > ".join(apps_needing_sync))
        
        if options.get('migrate', True):
            if verbosity:
                print("\nMigrated:\n - %s" % "\n - ".join(apps_migrated))
        else:
            if verbosity:
                print("\nNot synced (use migrations):\n - %s" % "\n - ".join(apps_migrated))
                print("(use ./manage.py migrate to migrate these)")
