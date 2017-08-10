from __future__ import print_function

import uuid
from django.db.backends.util import truncate_name
from south.db import generic


class DatabaseOperations(generic.DatabaseOperations):

    """
    PsycoPG2 implementation of database operations.
    """

    backend_name = "postgres"

    def create_index_name(self, table_name, column_names, suffix=""):
        """
        Generate a unique name for the index

        Django's logic for naming field indexes is different in the
        postgresql_psycopg2 backend, so we follow that for single-column
        indexes.
        """

        if len(column_names) == 1:
            return truncate_name(
                '%s_%s%s' % (table_name, column_names[0], suffix),
                self._get_connection().ops.max_name_length()
            )
        return super(DatabaseOperations, self).create_index_name(table_name, column_names, suffix)

    @generic.copy_column_constraints
    @generic.delete_column_constraints
    def rename_column(self, table_name, old, new):
        if old == new:
            # Short-circuit out
            return []
        self.execute('ALTER TABLE %s RENAME COLUMN %s TO %s;' % (
            self.quote_name(table_name),
            self.quote_name(old),
            self.quote_name(new),
        ))

    @generic.invalidate_table_constraints
    def rename_table(self, old_table_name, table_name):
        "will rename the table and an associated ID sequence and primary key index"
        # First, rename the table
        generic.DatabaseOperations.rename_table(self, old_table_name, table_name)
        # Then, try renaming the ID sequence
        # (if you're using other AutoFields... your problem, unfortunately)

        if self.execute(
            """
            SELECT 1
            FROM information_schema.sequences
            WHERE sequence_name = %s
            """,
            [old_table_name + '_id_seq']
        ):
            generic.DatabaseOperations.rename_table(self, old_table_name + "_id_seq", table_name + "_id_seq")

        # Rename primary key index, will not rename other indices on
        # the table that are used by django (e.g. foreign keys). Until
        # figure out how, you need to do this yourself.

        pkey_index_names = self.execute(
            """
            SELECT pg_index.indexrelid::regclass
            FROM pg_index, pg_attribute
            WHERE
              indrelid = %s::regclass AND
              pg_attribute.attrelid = indrelid AND
              pg_attribute.attnum = any(pg_index.indkey)
              AND indisprimary
            """,
            [table_name]
        )
        if old_table_name + "_pkey" in pkey_index_names:
            generic.DatabaseOperations.rename_table(self, old_table_name + "_pkey", table_name + "_pkey")

    def rename_index(self, old_index_name, index_name):
        "Rename an index individually"
        generic.DatabaseOperations.rename_table(self, old_index_name, index_name)

    def _default_value_workaround(self, value):
        "Support for UUIDs on psql"
        if isinstance(value, uuid.UUID):
            return str(value)
        else:
            return super(DatabaseOperations, self)._default_value_workaround(value)

    def _db_type_for_alter_column(self, field):
        return self._db_positive_type_for_alter_column(DatabaseOperations, field)

    def _alter_add_column_mods(self, field, name, params, sqls):
        return self._alter_add_positive_check(DatabaseOperations, field, name, params, sqls)
