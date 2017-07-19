from __future__ import print_function

from copy import copy, deepcopy
import datetime
import inspect
import sys
import traceback

from django.core.management import call_command
from django.core.management.commands import loaddata
from django.db import models
from django import VERSION as DJANGO_VERSION

import south.db
from south import exceptions
from south.db import DEFAULT_DB_ALIAS
from south.models import MigrationHistory
from south.signals import ran_migration
from south.utils.py3 import StringIO, iteritems


class Migrator(object):
    def __init__(self, verbosity=0, interactive=False):
        self.verbosity = int(verbosity)
        self.interactive = bool(interactive)

    @staticmethod
    def title(target):
        raise NotImplementedError()

    def print_title(self, target):
        if self.verbosity:
            print(self.title(target))

    @staticmethod
    def status(target):
        raise NotImplementedError()

    def print_status(self, migration):
        status = self.status(migration)
        if self.verbosity and status:
            print(status)

    @staticmethod
    def orm(migration):
        raise NotImplementedError()

    def backwards(self, migration):
        return self._wrap_direction(migration.backwards(), migration.prev_orm())

    def direction(self, migration):
        raise NotImplementedError()

    @staticmethod
    def _wrap_direction(direction, orm):
        args = inspect.getargspec(direction)
        if len(args[0]) == 1:
            # Old migration, no ORM should be passed in
            return direction
        return (lambda: direction(orm))

    @staticmethod
    def record(migration, database):
        raise NotImplementedError()

    def run_migration_error(self, migration, extra_info=''):
        return (
            ' ! Error found during real run of migration! Aborting.\n'
            '\n'
            ' ! Since you have a database that does not support running\n'
            ' ! schema-altering statements in transactions, we have had \n'
            ' ! to leave it in an interim state between migrations.\n'
            '%s\n'
            ' ! The South developers regret this has happened, and would\n'
            ' ! like to gently persuade you to consider a slightly\n'
            ' ! easier-to-deal-with DBMS (one that supports DDL transactions)\n'
            ' ! NOTE: The error which caused the migration to fail is further up.'
        ) % extra_info

    def run_migration(self, migration, database):
        migration_function = self.direction(migration)
        south.db.db.start_transaction()
        try:
            migration_function()
            south.db.db.execute_deferred_sql()
            if not isinstance(getattr(self, '_wrapper', self), DryRunMigrator):
                # record us as having done this in the same transaction,
                # since we're not in a dry run
                self.record(migration, database)
        except:
            south.db.db.rollback_transaction()
            if not south.db.db.has_ddl_transactions:
                print(self.run_migration_error(migration))
            print("Error in migration: %s" % migration)
            raise
        else:
            try:
                south.db.db.commit_transaction()
            except:
                print("Error during commit in migration: %s" % migration)
                raise


    def run(self, migration, database):
        # Get the correct ORM.
        south.db.db.current_orm = self.orm(migration)
        # If we're not already in a dry run, and the database doesn't support
        # running DDL inside a transaction, *cough*MySQL*cough* then do a dry
        # run first.
        if not isinstance(getattr(self, '_wrapper', self), DryRunMigrator):
            if not south.db.db.has_ddl_transactions:
                dry_run = DryRunMigrator(migrator=self, ignore_fail=False)
                dry_run.run_migration(migration, database)
        return self.run_migration(migration, database)


    def send_ran_migration(self, migration, database):
        ran_migration.send(None,
                           app=migration.app_label(),
                           migration=migration,
                           method=self.__class__.__name__.lower(),
                           verbosity=self.verbosity,
                           interactive=self.interactive,
                           db=database)

    def migrate(self, migration, database):
        """
        Runs the specified migration forwards/backwards, in order.
        """
        app = migration.migrations._migrations
        migration_name = migration.name()
        self.print_status(migration)
        result = self.run(migration, database)
        self.send_ran_migration(migration, database)
        return result

    def migrate_many(self, target, migrations, database):
        raise NotImplementedError()


class MigratorWrapper(object):
    def __init__(self, migrator, *args, **kwargs):
        self._migrator = copy(migrator)
        attributes = dict([(k, getattr(self, k))
                           for k in self.__class__.__dict__
                           if not k.startswith('__')])
        self._migrator.__dict__.update(attributes)
        self._migrator.__dict__['_wrapper'] = self

    def __getattr__(self, name):
        return getattr(self._migrator, name)


class DryRunMigrator(MigratorWrapper):
    def __init__(self, ignore_fail=True, *args, **kwargs):
        super(DryRunMigrator, self).__init__(*args, **kwargs)
        self._ignore_fail = ignore_fail

    def _run_migration(self, migration):
        if migration.no_dry_run():
            if self.verbosity:
                print(" - Migration '%s' is marked for no-dry-run." % migration)
            return
        for name, db in iteritems(south.db.dbs):
            south.db.dbs[name].dry_run = True
        # preserve the constraint cache as it can be mutated by the dry run
        constraint_cache = deepcopy(south.db.db._constraint_cache)
        if self._ignore_fail:
            south.db.db.debug, old_debug = False, south.db.db.debug
        pending_creates = south.db.db.get_pending_creates()
        south.db.db.start_transaction()
        migration_function = self.direction(migration)
        try:
            try:
                migration_function()
                south.db.db.execute_deferred_sql()
            except:
                raise exceptions.FailedDryRun(migration, sys.exc_info())
        finally:
            south.db.db.rollback_transactions_dry_run()
            if self._ignore_fail:
                south.db.db.debug = old_debug
            south.db.db.clear_run_data(pending_creates)
            for name, db in iteritems(south.db.dbs):
                south.db.dbs[name].dry_run = False
            # restore the preserved constraint cache from before dry run was
            # executed
            south.db.db._constraint_cache = constraint_cache

    def run_migration(self, migration, database):
        try:
            self._run_migration(migration)
        except exceptions.FailedDryRun:
            if self._ignore_fail:
                return False
            raise

    def send_ran_migration(self, *args, **kwargs):
        pass


class FakeMigrator(MigratorWrapper):
    def run(self, migration, database):
        # Don't actually run, just record as if ran
        self.record(migration, database)
        if self.verbosity:
            print('   (faked)')

    def send_ran_migration(self, *args, **kwargs):
        pass


class LoadInitialDataMigrator(MigratorWrapper):

    def load_initial_data(self, target, db='default'):
        if target is None or target != target.migrations[-1]:
            return
        # Load initial data, if we ended up at target
        if self.verbosity:
            print(" - Loading initial data for %s." % target.app_label())
        if DJANGO_VERSION < (1, 6):
            self.pre_1_6(target, db)
        else:
            self.post_1_6(target, db)

    def pre_1_6(self, target, db):
        # Override Django's get_apps call temporarily to only load from the
        # current app
        old_get_apps = models.get_apps
        new_get_apps = lambda: [models.get_app(target.app_label())]
        models.get_apps = new_get_apps
        loaddata.get_apps = new_get_apps
        try:
            call_command('loaddata', 'initial_data', verbosity=self.verbosity, database=db)
        finally:
            models.get_apps = old_get_apps
            loaddata.get_apps = old_get_apps

    def post_1_6(self, target, db):
        import django.db.models.loading
        ## build a new 'AppCache' object with just the app we care about.
        old_cache = django.db.models.loading.cache
        new_cache = django.db.models.loading.AppCache()
        new_cache.get_apps = lambda: [new_cache.get_app(target.app_label())]

        ## monkeypatch
        django.db.models.loading.cache = new_cache
        try:
            call_command('loaddata', 'initial_data', verbosity=self.verbosity, database=db)
        finally:
            ## unmonkeypatch
            django.db.models.loading.cache = old_cache

    def migrate_many(self, target, migrations, database):
        migrator = self._migrator
        result = migrator.__class__.migrate_many(migrator, target, migrations, database)
        if result:
            self.load_initial_data(target, db=database)
        return True


class Forwards(Migrator):
    """
    Runs the specified migration forwards, in order.
    """
    torun = 'forwards'

    @staticmethod
    def title(target):
        if target is not None:
            return " - Migrating forwards to %s." % target.name()
        else:
            assert False, "You cannot migrate forwards to zero."

    @staticmethod
    def status(migration):
        return ' > %s' % migration

    @staticmethod
    def orm(migration):
        return migration.orm()

    def forwards(self, migration):
        return self._wrap_direction(migration.forwards(), migration.orm())

    direction = forwards

    @staticmethod
    def record(migration, database):
        # Record us as having done this
        record = MigrationHistory.for_migration(migration, database)
        try:
            from django.utils.timezone import now
            record.applied = now()
        except ImportError:
            record.applied = datetime.datetime.utcnow()
        if database != DEFAULT_DB_ALIAS:
            record.save(using=database)
        else:
            # Django 1.1 and below always go down this branch.
            record.save()

    def format_backwards(self, migration):
        if migration.no_dry_run():
            return "   (migration cannot be dry-run; cannot discover commands)"
        old_debug, old_dry_run = south.db.db.debug, south.db.db.dry_run
        south.db.db.debug = south.db.db.dry_run = True
        stdout = sys.stdout
        sys.stdout = StringIO()
        try:
            try:
                self.backwards(migration)()
                return sys.stdout.getvalue()
            except:
                raise
        finally:
            south.db.db.debug, south.db.db.dry_run = old_debug, old_dry_run
            sys.stdout = stdout

    def run_migration_error(self, migration, extra_info=''):
        extra_info = ('\n'
                      '! You *might* be able to recover with:'
                      '%s'
                      '%s' %
                      (self.format_backwards(migration), extra_info))
        return super(Forwards, self).run_migration_error(migration, extra_info)

    def migrate_many(self, target, migrations, database):
        try:
            for migration in migrations:
                result = self.migrate(migration, database)
                if result is False: # The migrations errored, but nicely.
                    return False
        finally:
            # Call any pending post_syncdb signals
            south.db.db.send_pending_create_signals(verbosity=self.verbosity,
                                                    interactive=self.interactive)
        return True


class Backwards(Migrator):
    """
    Runs the specified migration backwards, in order.
    """
    torun = 'backwards'

    @staticmethod
    def title(target):
        if target is None:
            return " - Migrating backwards to zero state."
        else:
            return " - Migrating backwards to just after %s." % target.name()

    @staticmethod
    def status(migration):
        return ' < %s' % migration

    @staticmethod
    def orm(migration):
        return migration.prev_orm()

    direction = Migrator.backwards

    @staticmethod
    def record(migration, database):
        # Record us as having not done this
        record = MigrationHistory.for_migration(migration, database)
        if record.id is not None:
            if database != DEFAULT_DB_ALIAS:
                record.delete(using=database)
            else:
                # Django 1.1 always goes down here
                record.delete()

    def migrate_many(self, target, migrations, database):
        for migration in migrations:
            self.migrate(migration, database)
        return True



