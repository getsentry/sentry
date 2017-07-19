# firebird

from __future__ import print_function

import datetime

from django.db import connection, models
from django.core.management.color import no_style
from django.db.utils import DatabaseError

from south.db import generic
from south.utils.py3 import string_types

class DatabaseOperations(generic.DatabaseOperations):
    backend_name = 'firebird'
    alter_string_set_type = 'ALTER %(column)s TYPE %(type)s'
    alter_string_set_default =  'ALTER %(column)s SET DEFAULT %(default)s;'
    alter_string_drop_null = ''
    add_column_string = 'ALTER TABLE %s ADD %s;'
    delete_column_string = 'ALTER TABLE %s DROP %s;'
    rename_table_sql = ''

    # Features
    allows_combined_alters = False
    has_booleans = False

    def _fill_constraint_cache(self, db_name, table_name):
        self._constraint_cache.setdefault(db_name, {})
        self._constraint_cache[db_name][table_name] = {}

        rows = self.execute("""
            SELECT
                rc.RDB$CONSTRAINT_NAME,
                rc.RDB$CONSTRAINT_TYPE,
                cc.RDB$TRIGGER_NAME
            FROM rdb$relation_constraints rc
            JOIN rdb$check_constraints cc
            ON rc.rdb$constraint_name = cc.rdb$constraint_name
            WHERE rc.rdb$constraint_type = 'NOT NULL'
            AND rc.rdb$relation_name = '%s'
            """ % table_name)

        for constraint, kind, column in rows:
           self._constraint_cache[db_name][table_name].setdefault(column, set())
           self._constraint_cache[db_name][table_name][column].add((kind, constraint))
        return

    def _alter_column_set_null(self, table_name, column_name, is_null):
        sql = """
            UPDATE RDB$RELATION_FIELDS SET RDB$NULL_FLAG = %(null_flag)s
            WHERE RDB$FIELD_NAME = '%(column)s'
            AND RDB$RELATION_NAME = '%(table_name)s'
        """
        null_flag = 'NULL' if is_null else '1'
        return sql % {
            'null_flag': null_flag,
            'column': column_name.upper(),
            'table_name': table_name.upper()
        }

    def _column_has_default(self, params):
        sql = """
            SELECT a.RDB$DEFAULT_VALUE
            FROM RDB$RELATION_FIELDS a
            WHERE a.RDB$FIELD_NAME = '%(column)s'
            AND a.RDB$RELATION_NAME = '%(table_name)s'
        """
        value = self.execute(sql % params)
        return True if value else False


    def _alter_set_defaults(self, field, name, params, sqls):
        "Subcommand of alter_column that sets default values (overrideable)"
        # Historically, we used to set defaults here.
        # But since South 0.8, we don't ever set defaults on alter-column -- we only
        # use database-level defaults as scaffolding when adding columns.
        # However, we still sometimes need to remove defaults in alter-column.
        if self._column_has_default(params):
            sqls.append(('ALTER COLUMN %s DROP DEFAULT' % (self.quote_name(name),), []))


    @generic.invalidate_table_constraints
    def create_table(self, table_name, fields):
        columns = []
        autoinc_sql = ''

        for field_name, field in fields:
            # avoid default values in CREATE TABLE statements (#925)
            field._suppress_default = True
            
            col = self.column_sql(table_name, field_name, field)
            if not col:
                continue

            columns.append(col)
            if isinstance(field, models.AutoField):
                field_name = field.db_column or field.column
                autoinc_sql = connection.ops.autoinc_sql(table_name, field_name)

        self.execute(self.create_table_sql % {
            "table": self.quote_name(table_name),
            "columns": ', '.join([col for col in columns if col]),
        })
        
        if autoinc_sql:
            self.execute(autoinc_sql[0])
            self.execute(autoinc_sql[1])

    def rename_table(self, old_table_name, table_name):
        """
        Renames table is not supported by firebird.
        This involve recreate all related objects (store procedure, views, triggers, etc)
        """
        pass

    @generic.invalidate_table_constraints
    def delete_table(self, table_name, cascade=False):
        """
        Deletes the table 'table_name'.
        Firebird will also delete any triggers associated with the table.
        """
        super(DatabaseOperations, self).delete_table(table_name, cascade=False)

        # Also, drop sequence if exists
        sql = connection.ops.drop_sequence_sql(table_name)
        if sql:
            try:
                self.execute(sql)
            except:
                pass

    def column_sql(self, table_name, field_name, field, tablespace='', with_name=True, field_prepared=False):
        """
        Creates the SQL snippet for a column. Used by add_column and add_table.
        """

        # If the field hasn't already been told its attribute name, do so.
        if not field_prepared:
            field.set_attributes_from_name(field_name)

        # hook for the field to do any resolution prior to it's attributes being queried
        if hasattr(field, 'south_init'):
            field.south_init()

        # Possible hook to fiddle with the fields (e.g. defaults & TEXT on MySQL)
        field = self._field_sanity(field)

        try:
            sql = field.db_type(connection=self._get_connection())
        except TypeError:
            sql = field.db_type()

        if sql:
            # Some callers, like the sqlite stuff, just want the extended type.
            if with_name:
                field_output = [self.quote_name(field.column), sql]
            else:
                field_output = [sql]

            if field.primary_key:
                field_output.append('NOT NULL PRIMARY KEY')
            elif field.unique:
                # Just use UNIQUE (no indexes any more, we have delete_unique)
                field_output.append('UNIQUE')

            sql = ' '.join(field_output)
            sqlparams = ()

            # if the field is "NOT NULL" and a default value is provided, create the column with it
            # this allows the addition of a NOT NULL field to a table with existing rows
            if not getattr(field, '_suppress_default', False):
                if field.has_default():
                    default = field.get_default()
                    # If the default is actually None, don't add a default term
                    if default is not None:
                        # If the default is a callable, then call it!
                        if callable(default):
                            default = default()
                        # Now do some very cheap quoting. TODO: Redesign return values to avoid this.
                        if isinstance(default, string_types):
                            default = "'%s'" % default.replace("'", "''")
                        elif isinstance(default, (datetime.date, datetime.time, datetime.datetime)):
                            default = "'%s'" % default
                        elif isinstance(default, bool):
                            default = int(default)
                        # Escape any % signs in the output (bug #317)
                        if isinstance(default, string_types):
                            default = default.replace("%", "%%")
                        # Add it in
                        sql += " DEFAULT %s"
                        sqlparams = (default)
                elif (not field.null and field.blank) or (field.get_default() == ''):
                    if field.empty_strings_allowed and self._get_connection().features.interprets_empty_strings_as_nulls:
                        sql += " DEFAULT ''"
                    # Error here would be nice, but doesn't seem to play fair.
                    #else:
                    #    raise ValueError("Attempting to add a non null column that isn't character based without an explicit default value.")

            # Firebird need set not null after of default value keyword
            if not field.primary_key and not field.null:
                sql += ' NOT NULL'

            if field.rel and self.supports_foreign_keys:
                self.add_deferred_sql(
                    self.foreign_key_sql(
                        table_name,
                        field.column,
                        field.rel.to._meta.db_table,
                        field.rel.to._meta.get_field(field.rel.field_name).column
                    )
                )

        # Things like the contrib.gis module fields have this in 1.1 and below
        if hasattr(field, 'post_create_sql'):
            for stmt in field.post_create_sql(no_style(), table_name):
                self.add_deferred_sql(stmt)

        # Avoid double index creation (#1317)
        # Firebird creates an index implicity for each foreign key field 
        # sql_indexes_for_field tries to create an index for that field too
        if not field.rel:
            # In 1.2 and above, you have to ask the DatabaseCreation stuff for it.
            # This also creates normal indexes in 1.1.
            if hasattr(self._get_connection().creation, "sql_indexes_for_field"):
                # Make a fake model to pass in, with only db_table
                model = self.mock_model("FakeModelForGISCreation", table_name)
                for stmt in self._get_connection().creation.sql_indexes_for_field(model, field, no_style()):
                    self.add_deferred_sql(stmt)

        if sql:
            return sql % sqlparams
        else:
            return None


    def _drop_constraints(self, table_name, name, field):
        if self.has_check_constraints:
            check_constraints = self._constraints_affecting_columns(table_name, [name], "CHECK")
            for constraint in check_constraints:
                self.execute(self.delete_check_sql % {
                    'table': self.quote_name(table_name),
                    'constraint': self.quote_name(constraint),
                })

        # Drop or add UNIQUE constraint
        unique_constraint = list(self._constraints_affecting_columns(table_name, [name], "UNIQUE"))
        if field.unique and not unique_constraint:
            self.create_unique(table_name, [name])
        elif not field.unique and unique_constraint:
            self.delete_unique(table_name, [name])

        # Drop all foreign key constraints
        try:
            self.delete_foreign_key(table_name, name)
        except ValueError:
            # There weren't any
            pass


    @generic.invalidate_table_constraints
    def alter_column(self, table_name, name, field, explicit_name=True, ignore_constraints=False):
        """
        Alters the given column name so it will match the given field.
        Note that conversion between the two by the database must be possible.
        Will not automatically add _id by default; to have this behavour, pass
        explicit_name=False.

        @param table_name: The name of the table to add the column to
        @param name: The name of the column to alter
        @param field: The new field definition to use
        """

        if self.dry_run:
            if self.debug:
                print('   - no dry run output for alter_column() due to dynamic DDL, sorry')
            return


        # hook for the field to do any resolution prior to it's attributes being queried
        if hasattr(field, 'south_init'):
            field.south_init()

        # Add _id or whatever if we need to
        field.set_attributes_from_name(name)
        if not explicit_name:
            name = field.column
        else:
            field.column = name

        if not ignore_constraints:
            # Drop all check constraints. Note that constraints will be added back
            # with self.alter_string_set_type and self.alter_string_drop_null.
            self._drop_constraints(table_name, name, field)

        # First, change the type
        params = {
            "column": self.quote_name(name),
            "type": self._db_type_for_alter_column(field),
            "table_name": table_name
        }

        # SQLs is a list of (SQL, values) pairs.
        sqls = []
        sqls_extra = []

        # Only alter the column if it has a type (Geometry ones sometimes don't)
        if params["type"] is not None:
            sqls.append((self.alter_string_set_type % params, []))

        # Add any field- and backend- specific modifications
        self._alter_add_column_mods(field, name, params, sqls)

        # Next, nullity: modified, firebird doesn't support DROP NOT NULL
        sqls_extra.append(self._alter_column_set_null(table_name, name, field.null))

        # Next, set any default
        self._alter_set_defaults(field, name, params, sqls)

        # Finally, actually change the column
        if self.allows_combined_alters:
            sqls, values = list(zip(*sqls))
            self.execute(
                "ALTER TABLE %s %s;" % (self.quote_name(table_name), ", ".join(sqls)),
                generic.flatten(values),
            )
        else:
            # Databases like e.g. MySQL don't like more than one alter at once.
            for sql, values in sqls:
                try:
                    self.execute("ALTER TABLE %s %s;" % (self.quote_name(table_name), sql), values)
                except DatabaseError as e:
                    print(e)


        # Execute extra sql, which don't need ALTER TABLE statement
        for sql in sqls_extra:
            self.execute(sql)

        if not ignore_constraints:
            # Add back FK constraints if needed
            if field.rel and self.supports_foreign_keys:
                self.execute(
                    self.foreign_key_sql(
                        table_name,
                        field.column,
                        field.rel.to._meta.db_table,
                        field.rel.to._meta.get_field(field.rel.field_name).column
                    )
                )

    @generic.copy_column_constraints
    @generic.delete_column_constraints
    def rename_column(self, table_name, old, new):
        if old == new:
            # Short-circuit out
            return []

        self.execute('ALTER TABLE %s ALTER %s TO %s;' % (
            self.quote_name(table_name),
            self.quote_name(old),
            self.quote_name(new),
        ))
