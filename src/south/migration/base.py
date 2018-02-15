from __future__ import print_function

import datetime
import os
import re
import six
import sys

from collections import deque
from django.core.exceptions import ImproperlyConfigured
from django.db import models
from django.conf import settings
from django.utils import importlib
from imp import reload

from south import exceptions
from south.constants import DJANGO_17
from south.migration.utils import app_label_to_app_module, depends, dfs, flatten, get_app_label
from south.orm import FakeORM
from south.utils import memoize, ask_for_it_by_name, datetime_utils


def all_migrations(applications=None):
    """
    Returns all Migrations for all `applications` that are migrated.
    """
    if applications is None:
        applications = models.get_apps()
    for model_module in applications:
        app_label = get_app_label(model_module)
        try:
            yield Migrations(app_label)
        except exceptions.NoMigrations:
            pass


class MigrationsMetaclass(type):
    """
    Metaclass which ensures there is only one instance of a Migrations for
    any given app.

    This implements an identity mapper on ``Migrations(application)`` based on the label.
    """

    def __init__(self, name, bases, dict):
        super(MigrationsMetaclass, self).__init__(name, bases, dict)
        self.instances = {}

    def __call__(self, application_or_app_label, **kwds):
        if isinstance(application_or_app_label, six.string_types):
            app_label = application_or_app_label
        else:
            app_label = get_app_label(application_or_app_label)
        if app_label not in self.instances:
            self.instances[app_label] = super(
                MigrationsMetaclass, self).__call__(
                application_or_app_label, **kwds)
        return self.instances[app_label]

    def _clear_cache(self):
        "Clears the cache of Migration objects."
        self.instances = {}


class Migrations(six.with_metaclass(MigrationsMetaclass, list)):
    """
    Holds a list of Migration objects for a particular app.
    """

    if getattr(settings, "SOUTH_USE_PYC", False):
        MIGRATION_FILENAME = re.compile(r'(?!__init__)'  # Don't match __init__.py
                                        # Don't match dotfiles, or names with dots/invalid chars in
                                        # them
                                        r'[0-9a-zA-Z_]*'
                                        r'(\.pyc?)?$')     # Match .py or .pyc files, or module dirs
    else:
        MIGRATION_FILENAME = re.compile(r'(?!__init__)'  # Don't match __init__.py
                                        # Don't match dotfiles, or names with dots/invalid chars in
                                        # them
                                        r'[0-9a-zA-Z_]*'
                                        r'(\.py)?$')       # Match only .py files, or module dirs

    def __init__(self, application_or_app_label, force_creation=False, verbose_creation=True):
        "Constructor. Takes the module of the app, NOT its models (like get_app returns)"
        self._cache = {}
        self.set_application(application_or_app_label, force_creation, verbose_creation)

    def __repr__(self):
        return u'<Migrations: {}>'.format(
            self.app_label(),
        )

    def create_migrations_directory(self, verbose=True):
        "Given an application, ensures that the migrations directory is ready."
        migrations_dir = self.migrations_dir()
        # Make the directory if it's not already there
        if not os.path.isdir(migrations_dir):
            if verbose:
                print("Creating migrations directory at '%s'..." % migrations_dir)
            os.mkdir(migrations_dir)
        # Same for __init__.py
        init_path = os.path.join(migrations_dir, "__init__.py")
        if not os.path.isfile(init_path):
            # Touch the init py file
            if verbose:
                print("Creating __init__.py in '%s'..." % migrations_dir)
            open(init_path, "w").close()

    def migrations_dir(self):
        """
        Returns the full path of the migrations directory.
        If it doesn't exist yet, returns where it would exist, based on the
        app's migrations module (defaults to app.migrations)
        """
        module = self.migrations_module()
        return os.path.dirname(module.__file__)

    def migrations_module(self):
        "Returns the module name of the migrations module for this"
        full_name = '{}.south_migrations'.format(self._application.__name__)
        if full_name in sys.modules:
            return sys.modules[full_name]
        return __import__(full_name, {}, {}, ['south_migrations'], -1)

    def get_application(self):
        return self._application

    def set_application(self, application, force_creation=False, verbose_creation=True):
        """
        Called when the application for this Migrations is set.
        Imports the migrations module object, and throws a paddy if it can't.
        """
        if isinstance(application, six.string_types):
            if application in sys.modules:
                application = sys.modules[application]
            else:
                application = app_label_to_app_module(application)

        self._application = application
        if not hasattr(application, 'south_migrations'):
            try:
                module = self.migrations_module()
                self._migrations = application.south_migrations = module
            except ImportError:
                if force_creation:
                    self.create_migrations_directory(verbose_creation)
                    module = self.migrations_module()
                    self._migrations = application.south_migrations = module
                else:
                    six.reraise(exceptions.NoMigrations, exceptions.NoMigrations(application))
        if hasattr(application, 'south_migrations'):
            self._load_migrations_module(application.south_migrations)

    application = property(get_application, set_application)

    def _load_migrations_module(self, module):
        self._migrations = module
        filenames = []
        dirname = self.migrations_dir()
        for f in os.listdir(dirname):
            if self.MIGRATION_FILENAME.match(os.path.basename(f)):
                full_path = os.path.join(dirname, f)
                # If it's a .pyc file, only append if the .py isn't already around
                if f.endswith(".pyc") and (os.path.isfile(full_path[:-1])):
                    continue
                # If it's a module directory, only append if it contains __init__.py[c].
                if os.path.isdir(full_path):
                    if not (os.path.isfile(os.path.join(full_path, "__init__.py")) or
                            (getattr(settings, "SOUTH_USE_PYC", False) and
                             os.path.isfile(os.path.join(full_path, "__init__.pyc")))):
                        continue
                filenames.append(f)
        filenames.sort()
        self.extend(self.migration(f) for f in filenames)

    def migration(self, filename):
        name = Migration.strip_filename(filename)
        if name not in self._cache:
            self._cache[name] = Migration(self, name)
        return self._cache[name]

    def __getitem__(self, value):
        if isinstance(value, six.string_types):
            return self.migration(value)
        return super(Migrations, self).__getitem__(value)

    def _guess_migration(self, prefix):
        prefix = Migration.strip_filename(prefix)
        matches = [m for m in self if m.name().startswith(prefix)]
        if len(matches) == 1:
            return matches[0]
        elif len(matches) > 1:
            raise exceptions.MultiplePrefixMatches(prefix, matches)
        else:
            raise exceptions.UnknownMigration(prefix, None)

    def guess_migration(self, target_name):
        if target_name == 'zero' or not self:
            return
        elif target_name is None:
            return self[-1]
        else:
            return self._guess_migration(prefix=target_name)

    def app_label(self):
        return self._application.__name__

    def full_name(self):
        return self._migrations.__name__

    @classmethod
    def calculate_dependencies(cls, force=False):
        "Goes through all the migrations, and works out the dependencies."
        if getattr(cls, "_dependencies_done", False) and not force:
            return
        for migrations in all_migrations():
            for migration in migrations:
                migration.calculate_dependencies()
        cls._dependencies_done = True

    @staticmethod
    def invalidate_all_modules():
        "Goes through all the migrations, and invalidates all cached modules."
        for migrations in all_migrations():
            for migration in migrations:
                migration.invalidate_module()

    def next_filename(self, name):
        "Returns the fully-formatted filename of what a new migration 'name' would be"
        highest_number = 0
        for migration in self:
            try:
                number = int(migration.name().split("_")[0])
                highest_number = max(highest_number, number)
            except ValueError:
                pass
        # Work out the new filename
        return "%04i_%s.py" % (
            highest_number + 1,
            name,
        )


class Migration(object):

    """
    Class which represents a particular migration file on-disk.
    """

    def __init__(self, migrations, filename):
        """
        Returns the migration class implied by 'filename'.
        """
        self.migrations = migrations
        self.filename = filename
        self.dependencies = set()
        self.dependents = set()

    def __str__(self):
        return self.app_label() + ':' + self.name()

    def __repr__(self):
        return '<Migration: %s>' % str(self)

    def __eq__(self, other):
        return self.app_label() == other.app_label() and self.name() == other.name()

    def __hash__(self):
        return hash(str(self))

    def app_label(self):
        return self.migrations.app_label()

    @staticmethod
    def strip_filename(filename):
        return os.path.splitext(os.path.basename(filename))[0]

    def name(self):
        return self.strip_filename(os.path.basename(self.filename))

    def full_name(self):
        return self.migrations.full_name() + '.' + self.name()

    def migration(self):
        "Tries to load the actual migration module"
        full_name = self.full_name()
        try:
            migration = sys.modules[full_name]
        except KeyError:
            try:
                migration = __import__(full_name, {}, {}, ['Migration'])
            except ImportError as e:
                raise exceptions.UnknownMigration(self, sys.exc_info())
            except Exception as e:
                raise exceptions.BrokenMigration(self, sys.exc_info())
        # Override some imports
        migration._ = lambda x: x  # Fake i18n
        migration.datetime = datetime_utils
        return migration
    migration = memoize(migration)

    def migration_class(self):
        "Returns the Migration class from the module"
        return self.migration().Migration

    def migration_instance(self):
        "Instantiates the migration_class"
        return self.migration_class()()
    migration_instance = memoize(migration_instance)

    def previous(self):
        "Returns the migration that comes before this one in the sequence."
        index = self.migrations.index(self) - 1
        if index < 0:
            return None
        return self.migrations[index]
    previous = memoize(previous)

    def next(self):
        "Returns the migration that comes after this one in the sequence."
        index = self.migrations.index(self) + 1
        if index >= len(self.migrations):
            return None
        return self.migrations[index]
    next = memoize(next)

    def _get_dependency_objects(self, attrname):
        """
        Given the name of an attribute (depends_on or needed_by), either yields
        a list of migration objects representing it, or errors out.
        """
        for app, name in getattr(self.migration_class(), attrname, []):
            try:
                migrations = Migrations(app)
            except ImproperlyConfigured:
                raise exceptions.DependsOnUnmigratedApplication(self, app)
            migration = migrations.migration(name)
            try:
                migration.migration()
            except exceptions.UnknownMigration:
                raise exceptions.DependsOnUnknownMigration(self, migration)
            if migration.is_before(self) == False:
                raise exceptions.DependsOnHigherMigration(self, migration)
            yield migration

    def calculate_dependencies(self):
        """
        Loads dependency info for this migration, and stores it in itself
        and any other relevant migrations.
        """
        # Normal deps first
        for migration in self._get_dependency_objects("depends_on"):
            self.dependencies.add(migration)
            migration.dependents.add(self)
        # And reverse deps
        for migration in self._get_dependency_objects("needed_by"):
            self.dependents.add(migration)
            migration.dependencies.add(self)
        # And implicit ordering deps
        previous = self.previous()
        if previous:
            self.dependencies.add(previous)
            previous.dependents.add(self)

    def invalidate_module(self):
        """
        Removes the cached version of this migration's module import, so we
        have to re-import it. Used when south.db.db changes.
        """
        reload(self.migration())
        self.migration._invalidate()

    def forwards(self):
        return self.migration_instance().forwards

    def backwards(self):
        return self.migration_instance().backwards

    def forwards_plan(self):
        """
        Returns a list of Migration objects to be applied, in order.

        This list includes `self`, which will be applied last.
        """
        return depends(self, lambda x: x.dependencies)

    def _backwards_plan(self):
        return depends(self, lambda x: x.dependents)

    def backwards_plan(self):
        """
        Returns a list of Migration objects to be unapplied, in order.

        This list includes `self`, which will be unapplied last.
        """
        return list(self._backwards_plan())

    def is_before(self, other):
        if self.migrations == other.migrations:
            if self.filename < other.filename:
                return True
            return False

    def is_after(self, other):
        if self.migrations == other.migrations:
            if self.filename > other.filename:
                return True
            return False

    def prev_orm(self):
        if getattr(self.migration_class(), 'symmetrical', False):
            return self.orm()
        previous = self.previous()
        if previous is None:
            # First migration? The 'previous ORM' is empty.
            return FakeORM(None, self.app_label())
        return previous.orm()
    prev_orm = memoize(prev_orm)

    def orm(self):
        return FakeORM(self.migration_class(), self.app_label())
    orm = memoize(orm)

    def no_dry_run(self):
        migration_class = self.migration_class()
        try:
            return migration_class.no_dry_run
        except AttributeError:
            return False
