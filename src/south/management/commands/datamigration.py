"""
Data migration creation command
"""

from __future__ import print_function

import sys
import os
import re
from optparse import make_option

try:
    set
except NameError:
    from sets import Set as set

from django.core.management.base import BaseCommand
from django.core.management.color import no_style
from django.db import models
from django.conf import settings

from south.migration import Migrations
from south.exceptions import NoMigrations
from south.creator import freezer

class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--freeze', action='append', dest='freeze_list', type='string',
            help='Freeze the specified app(s). Provide an app name with each; use the option multiple times for multiple apps'),
        make_option('--stdout', action='store_true', dest='stdout', default=False,
            help='Print the migration to stdout instead of writing it to a file.'),
    )
    help = "Creates a new template data migration for the given app"
    usage_str = "Usage: ./manage.py datamigration appname migrationname [--stdout] [--freeze appname]"
    
    def handle(self, app=None, name="", freeze_list=None, stdout=False, verbosity=1, **options):

        verbosity = int(verbosity)
        
        # Any supposed lists that are None become empty lists
        freeze_list = freeze_list or []

        # --stdout means name = -
        if stdout:
            name = "-"
	
        # Only allow valid names
        if re.search('[^_\w]', name) and name != "-":
            self.error("Migration names should contain only alphanumeric characters and underscores.")
        
        # If not name, there's an error
        if not name:
            self.error("You must provide a name for this migration.\n" + self.usage_str)
        
        if not app:
            self.error("You must provide an app to create a migration for.\n" + self.usage_str)

        # Ensure that verbosity is not a string (Python 3)
        try:
            verbosity = int(verbosity)
        except ValueError:
            self.error("Verbosity must be an number.\n" + self.usage_str)
            
        # Get the Migrations for this app (creating the migrations dir if needed)
        migrations = Migrations(app, force_creation=True, verbose_creation=verbosity > 0)
        
        # See what filename is next in line. We assume they use numbers.
        new_filename = migrations.next_filename(name)
        
        # Work out which apps to freeze
        apps_to_freeze = self.calc_frozen_apps(migrations, freeze_list)
        
        # So, what's in this file, then?
        file_contents = self.get_migration_template() % {
            "frozen_models":  freezer.freeze_apps_to_string(apps_to_freeze),
            "complete_apps": apps_to_freeze and "complete_apps = [%s]" % (", ".join(map(repr, apps_to_freeze))) or ""
        }
        
        # - is a special name which means 'print to stdout'
        if name == "-":
            print(file_contents)
        # Write the migration file if the name isn't -
        else:
            fp = open(os.path.join(migrations.migrations_dir(), new_filename), "w")
            fp.write(file_contents)
            fp.close()
            print("Created %s." % new_filename, file=sys.stderr)
    
    def calc_frozen_apps(self, migrations, freeze_list):
        """
        Works out, from the current app, settings, and the command line options,
        which apps should be frozen.
        """
        apps_to_freeze = []
        for to_freeze in freeze_list:
            if "." in to_freeze:
                self.error("You cannot freeze %r; you must provide an app label, like 'auth' or 'books'." % to_freeze)
            # Make sure it's a real app
            if not models.get_app(to_freeze):
                self.error("You cannot freeze %r; it's not an installed app." % to_freeze)
            # OK, it's fine
            apps_to_freeze.append(to_freeze)
        if getattr(settings, 'SOUTH_AUTO_FREEZE_APP', True):
            apps_to_freeze.append(migrations.app_label())
        return apps_to_freeze
    
    def error(self, message, code=1):
        """
        Prints the error, and exits with the given code.
        """
        print(message, file=sys.stderr)
        sys.exit(code)

    def get_migration_template(self):
        return MIGRATION_TEMPLATE


MIGRATION_TEMPLATE = """# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import DataMigration
from django.db import models

class Migration(DataMigration):

    def forwards(self, orm):
        "Write your forwards methods here."
        # Note: Don't use "from appname.models import ModelName". 
        # Use orm.ModelName to refer to models in this application,
        # and orm['appname.ModelName'] for models in other applications.

    def backwards(self, orm):
        "Write your backwards methods here."

    models = %(frozen_models)s

    %(complete_apps)s
    symmetrical = True
"""
