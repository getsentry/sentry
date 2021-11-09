import sys

from django.db.backends.postgresql.creation import DatabaseCreation
from psycopg2 import errorcodes


class SentryDatabaseCreation(DatabaseCreation):
    def _execute_create_test_db(self, cursor, parameters, keepdb=False):
        """
        This is just copied from the base class and should behave the same. The only difference is
        that as well as checking `pgcode` we also do string matching on the Exception. This is to
        work around an issue where `pgcode` is missing when we run tests.
        """
        try:
            # Explicitly skip the overridden `_execute_create_test_db` and just call the one from
            # its superclass
            super(DatabaseCreation, self)._execute_create_test_db(cursor, parameters, keepdb)
        except Exception as e:
            if (
                getattr(e.__cause__, "pgcode", "") != errorcodes.DUPLICATE_DATABASE
                and "DuplicateDatabase" not in str(e)
                and "already exists" not in str(e)
            ):
                # All errors except "database already exists" cancel tests.
                sys.stderr.write("Got an error creating the test database: %s\n" % e)
                sys.exit(2)
            elif not keepdb:
                # If the database should be kept, ignore "database already
                # exists".
                raise e
