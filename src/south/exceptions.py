from __future__ import print_function

from traceback import format_exception, format_exc

class SouthError(RuntimeError):
    pass

class SouthWarning(RuntimeWarning):
    pass

class BrokenMigration(SouthError):
    def __init__(self, migration, exc_info):
        self.migration = migration
        self.exc_info = exc_info
        if self.exc_info:
            self.traceback = ''.join(format_exception(*self.exc_info))
        else:
            try:
                self.traceback = format_exc()
            except AttributeError: # Python3 when there is no previous exception
                self.traceback = None

    def __str__(self):
        return ("While loading migration '%(migration)s':\n"
                '%(traceback)s' % self.__dict__)


class UnknownMigration(BrokenMigration):
    def __str__(self):
        if not hasattr(self, "traceback"):
            self.traceback = ""
        return ("Migration '%(migration)s' probably doesn't exist.\n"
                '%(traceback)s' % self.__dict__)


class InvalidMigrationModule(SouthError):
    def __init__(self, application, module):
        self.application = application
        self.module = module
    
    def __str__(self):
        return ('The migration module specified for %(application)s, %(module)r, is invalid; the parent module does not exist.' % self.__dict__)


class NoMigrations(SouthError):
    def __init__(self, application):
        self.application = application

    def __str__(self):
        return "Application '%(application)s' has no migrations." % self.__dict__


class MultiplePrefixMatches(SouthError):
    def __init__(self, prefix, matches):
        self.prefix = prefix
        self.matches = matches

    def __str__(self):
        self.matches_list = "\n    ".join([str(m) for m in self.matches])
        return ("Prefix '%(prefix)s' matches more than one migration:\n"
                "    %(matches_list)s") % self.__dict__


class GhostMigrations(SouthError):
    def __init__(self, ghosts):
        self.ghosts = ghosts

    def __str__(self):
        self.ghosts_list = "\n    ".join([str(m) for m in self.ghosts])
        return ("\n\n ! These migrations are in the database but not on disk:\n"
                "    %(ghosts_list)s\n"
                " ! I'm not trusting myself; either fix this yourself by fiddling\n"
                " ! with the south_migrationhistory table, or pass --delete-ghost-migrations\n"
                " ! to South to have it delete ALL of these records (this may not be good).") % self.__dict__


class CircularDependency(SouthError):
    def __init__(self, trace):
        self.trace = trace

    def __str__(self):
        trace = " -> ".join([str(s) for s in self.trace])
        return ("Found circular dependency:\n"
                "    %s") % trace


class InconsistentMigrationHistory(SouthError):
    def __init__(self, problems):
        self.problems = problems

    def __str__(self):
        return ('Inconsistent migration history\n'
                'The following options are available:\n'
                '    --merge: will just attempt the migration ignoring any potential dependency conflicts.')


class DependsOnHigherMigration(SouthError):
    def __init__(self, migration, depends_on):
        self.migration = migration
        self.depends_on = depends_on

    def __str__(self):
        return "Lower migration '%(migration)s' depends on a higher migration '%(depends_on)s' in the same app." % self.__dict__


class DependsOnUnknownMigration(SouthError):
    def __init__(self, migration, depends_on):
        self.migration = migration
        self.depends_on = depends_on

    def __str__(self):
        print("Migration '%(migration)s' depends on unknown migration '%(depends_on)s'." % self.__dict__)


class DependsOnUnmigratedApplication(SouthError):
    def __init__(self, migration, application):
        self.migration = migration
        self.application = application

    def __str__(self):
        return "Migration '%(migration)s' depends on unmigrated application '%(application)s'." % self.__dict__


class FailedDryRun(SouthError):
    def __init__(self, migration, exc_info):
        self.migration = migration
        self.name = migration.name()
        self.exc_info = exc_info
        self.traceback = ''.join(format_exception(*self.exc_info))

    def __str__(self):
        return (" ! Error found during dry run of '%(name)s'! Aborting.\n"
                "%(traceback)s") % self.__dict__


class ORMBaseNotIncluded(SouthError):
    """Raised when a frozen model has something in _ormbases which isn't frozen."""
    pass


class UnfreezeMeLater(Exception):
    """An exception, which tells the ORM unfreezer to postpone this model."""
    pass


class ImpossibleORMUnfreeze(SouthError):
    """Raised if the ORM can't manage to unfreeze all the models in a linear fashion."""
    pass

class ConstraintDropped(SouthWarning):
    def __init__(self, constraint, table, column=None):
        self.table = table
        if column:
            self.column = ".%s" % column
        else:
            self.column = ""
        self.constraint = constraint
    
    def __str__(self):
        return "Constraint %(constraint)s was dropped from %(table)s%(column)s -- was this intended?" % self.__dict__  
