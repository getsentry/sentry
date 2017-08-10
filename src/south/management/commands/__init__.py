
# Common framework for syncdb actions

import copy

from django.core import management
from django.conf import settings

# Make sure the template loader cache is fixed _now_ (#448)
import django.template.loaders.app_directories

from south.hacks import hacks
from south.management.commands.syncdb import Command as SyncCommand

class MigrateAndSyncCommand(SyncCommand):
    """Used for situations where "syncdb" is called by test frameworks."""

    option_list = copy.deepcopy(SyncCommand.option_list)

    for opt in option_list:
        if "--migrate" == opt.get_opt_string():
            opt.default = True
            break

def patch_for_test_db_setup():
    # Load the commands cache
    management.get_commands()
    # Repoint to the correct version of syncdb
    if hasattr(settings, "SOUTH_TESTS_MIGRATE") and not settings.SOUTH_TESTS_MIGRATE:
        # point at the core syncdb command when creating tests
        # tests should always be up to date with the most recent model structure
        management._commands['syncdb'] = 'django.core'
    else:
        management._commands['syncdb'] = MigrateAndSyncCommand()
        # Avoid flushing data migrations.
        # http://code.djangoproject.com/ticket/14661 introduced change that flushed custom
        # sql during the test database creation (thus flushing the data migrations).
        # we patch flush to be no-op during create_test_db, but still allow flushing
        # after each test for non-transactional backends.
        hacks.patch_flush_during_test_db_creation()
