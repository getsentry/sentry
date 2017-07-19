"""
Quick conversion command module.
"""

from __future__ import print_function

from optparse import make_option
import sys

from django.core.management.base import BaseCommand
from django.core.management.color import no_style
from django.conf import settings
from django.db import models
from django.core import management
from django.core.exceptions import ImproperlyConfigured

from south.migration import Migrations
from south.hacks import hacks
from south.exceptions import NoMigrations

class Command(BaseCommand):
    
    option_list = BaseCommand.option_list
    if '--verbosity' not in [opt.get_opt_string() for opt in BaseCommand.option_list]:
        option_list += (
            make_option('--verbosity', action='store', dest='verbosity', default='1',
                type='choice', choices=['0', '1', '2'],
                help='Verbosity level; 0=minimal output, 1=normal output, 2=all output'),
        )
    option_list += (
        make_option('--delete-ghost-migrations', action='store_true', dest='delete_ghosts', default=False,
            help="Tells South to delete any 'ghost' migrations (ones in the database but not on disk)."),
        make_option('--ignore-ghost-migrations', action='store_true', dest='ignore_ghosts', default=False,
            help="Tells South to ignore any 'ghost' migrations (ones in the database but not on disk) and continue to apply new migrations."), 
    )

    help = "Quickly converts the named application to use South if it is currently using syncdb."

    def handle(self, app=None, *args, **options):
        
        # Make sure we have an app
        if not app:
            print("Please specify an app to convert.")
            return
        
        # See if the app exists
        app = app.split(".")[-1]
        try:
            app_module = models.get_app(app)
        except ImproperlyConfigured:
            print("There is no enabled application matching '%s'." % app)
            return
        
        # Try to get its list of models
        model_list = models.get_models(app_module)
        if not model_list:
            print("This application has no models; this command is for applications that already have models syncdb'd.")
            print("Make some models, and then use ./manage.py schemamigration %s --initial instead." % app)
            return
        
        # Ask South if it thinks it's already got migrations
        try:
            Migrations(app)
        except NoMigrations:
            pass
        else:
            print("This application is already managed by South.")
            return
        
        # Finally! It seems we've got a candidate, so do the two-command trick
        verbosity = int(options.get('verbosity', 0))
        management.call_command("schemamigration", app, initial=True, verbosity=verbosity)
        
        # Now, we need to re-clean and sanitise appcache
        hacks.clear_app_cache()
        hacks.repopulate_app_cache()
        
        # And also clear our cached Migration classes
        Migrations._clear_cache()
        
        # Now, migrate
        management.call_command(
            "migrate",
            app,
            "0001",
            fake=True,
            verbosity=verbosity,
            ignore_ghosts=options.get("ignore_ghosts", False),
            delete_ghosts=options.get("delete_ghosts", False),
        )
        
        print() 
        print("App '%s' converted. Note that South assumed the application's models matched the database" % app)
        print("(i.e. you haven't changed it since last syncdb); if you have, you should delete the %s/migrations" % app)
        print("directory, revert models.py so it matches the database, and try again.")
