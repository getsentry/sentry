"""
Now-obsolete startmigration command.
"""

from __future__ import print_function

from optparse import make_option

from django.core.management.base import BaseCommand
from django.core.management.color import no_style

class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--model', action='append', dest='added_model_list', type='string',
            help='Generate a Create Table migration for the specified model.  Add multiple models to this migration with subsequent --add-model parameters.'),
        make_option('--add-field', action='append', dest='added_field_list', type='string',
            help='Generate an Add Column migration for the specified modelname.fieldname - you can use this multiple times to add more than one column.'),
        make_option('--add-index', action='append', dest='added_index_list', type='string',
            help='Generate an Add Index migration for the specified modelname.fieldname - you can use this multiple times to add more than one column.'),
        make_option('--initial', action='store_true', dest='initial', default=False,
            help='Generate the initial schema for the app.'),
        make_option('--auto', action='store_true', dest='auto', default=False,
            help='Attempt to automatically detect differences from the last migration.'),
        make_option('--freeze', action='append', dest='freeze_list', type='string',
            help='Freeze the specified model(s). Pass in either an app name (to freeze the whole app) or a single model, as appname.modelname.'),
        make_option('--stdout', action='store_true', dest='stdout', default=False,
            help='Print the migration to stdout instead of writing it to a file.'),
    )
    help = "Deprecated command"
    
    def handle(self, app=None, name="", added_model_list=None, added_field_list=None, initial=False, freeze_list=None, auto=False, stdout=False, added_index_list=None, **options):
        
        print("The 'startmigration' command is now deprecated; please use the new 'schemamigration' and 'datamigration' commands.")
