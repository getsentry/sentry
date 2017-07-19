from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command, CommandError
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import loading
from django.test import simple

from south.migration import Migrations
from south.exceptions import NoMigrations
from south.hacks import hacks

class Command(BaseCommand):
    help = "Runs migrations for each app in turn, detecting missing depends_on values."
    usage_str = "Usage: ./manage.py migrationcheck"

    def handle(self, check_app_name=None, **options):
        runner = simple.DjangoTestSuiteRunner(verbosity=0)
        err_msg = "Failed to migrate %s; see output for hints at missing dependencies:\n"
        hacks.patch_flush_during_test_db_creation()
        failures = 0
        if check_app_name is None:
            app_names = settings.INSTALLED_APPS
        else:
            app_names = [check_app_name]
        for app_name in app_names:
            app_label = app_name.split(".")[-1]
            if app_name == 'south':
                continue

            try:
                Migrations(app_name)
            except (NoMigrations, ImproperlyConfigured):
                continue
            app = loading.get_app(app_label)

            verbosity = int(options.get('verbosity', 1))
            if verbosity >= 1:
                self.stderr.write("processing %s\n" % app_name)

            old_config = runner.setup_databases()
            try:
                call_command('migrate', app_label, noinput=True, verbosity=verbosity)
                for model in loading.get_models(app):
                    dummy = model._default_manager.exists()
            except (KeyboardInterrupt, SystemExit):
                raise
            except Exception as e:
                failures += 1
                if verbosity >= 1:
                    self.stderr.write(err_msg % app_name)
                    self.stderr.write("%s\n" % e)
            finally:
                runner.teardown_databases(old_config)
        if failures > 0:
            raise CommandError("Missing depends_on found in %s app(s)." % failures)
        self.stderr.write("No missing depends_on found.\n")
#
#for each app:
#    start with blank db.
#    syncdb only south (and contrib?)
#
#    migrate a single app all the way up.  any errors is missing depends_on.
#    for all models of that app, try the default manager:
#        from django.db.models import loading
#        for m in loading.get_models(loading.get_app('a')):
#            m._default_manager.exists()
#    Any error is also a missing depends on.
