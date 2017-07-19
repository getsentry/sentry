from south.db import generic

    
class DatabaseOperations(generic.DatabaseOperations):

    """
    SQLite3 implementation of database operations.
    """
    
    backend_name = "sqlite3"

    # SQLite ignores several constraints. I wish I could.
    supports_foreign_keys = False
    has_check_constraints = False
    has_booleans = False

    def add_column(self, table_name, name, field, *args, **kwds):
        """
        Adds a column.
        """
        # If it's not nullable, and has no default, raise an error (SQLite is picky)
        if (not field.null and
           (not field.has_default() or field.get_default() is None) and
           not field.empty_strings_allowed):
            raise ValueError("You cannot add a null=False column without a default value.")
        # Initialise the field.
        field.set_attributes_from_name(name)
        # We add columns by remaking the table; even though SQLite supports
        # adding columns, it doesn't support adding PRIMARY KEY or UNIQUE cols.
        # We define fields with no default; a default will be used, though, to fill up the remade table
        field_default = None
        if not getattr(field, '_suppress_default', False):
            default = field.get_default()
            if default is not None:
                field_default = "'%s'" % field.get_db_prep_save(default, connection=self._get_connection())
        field._suppress_default = True
        self._remake_table(table_name, added={
            field.column: (self._column_sql_for_create(table_name, name, field, False), field_default)
        })

    def _get_full_table_description(self, connection, cursor, table_name):
        cursor.execute('PRAGMA table_info(%s)' % connection.ops.quote_name(table_name))
        # cid, name, type, notnull, dflt_value, pk
        return [{'name': field[1],
                 'type': field[2],
                 'null_ok': not field[3],
                 'dflt_value': field[4],
                 'pk': field[5]     # undocumented
                 } for field in cursor.fetchall()]

    @generic.invalidate_table_constraints
    def _remake_table(self, table_name, added={}, renames={}, deleted=[], altered={}, primary_key_override=None, uniques_deleted=[]):
        """
        Given a table and three sets of changes (renames, deletes, alters),
        recreates it with the modified schema.
        """
        # Dry runs get skipped completely
        if self.dry_run:
            return
        # Temporary table's name
        temp_name = "_south_new_" + table_name
        # Work out the (possibly new) definitions of each column
        definitions = {}
        cursor = self._get_connection().cursor()
        # Get the index descriptions
        indexes = self._get_connection().introspection.get_indexes(cursor, table_name)
        standalone_indexes = self._get_standalone_indexes(table_name)
        # Work out new column defs.
        for column_info in self._get_full_table_description(self._get_connection(), cursor, table_name):
            name = column_info['name']
            if name in deleted:
                continue
            # Get the type, ignoring PRIMARY KEY (we need to be consistent)
            type = column_info['type'].replace("PRIMARY KEY", "")
            # Add on primary key, not null or unique if needed.
            if (primary_key_override and primary_key_override == name) or \
               (not primary_key_override and name in indexes and
                indexes[name]['primary_key']):
                type += " PRIMARY KEY"
            elif not column_info['null_ok']:
                type += " NOT NULL"
            if (name in indexes and indexes[name]['unique'] and
                name not in uniques_deleted):
                type += " UNIQUE"
            if column_info['dflt_value'] is not None:
                type += " DEFAULT " + column_info['dflt_value']
            # Deal with a rename
            if name in renames:
                name = renames[name]
            # Add to the defs
            definitions[name] = type
        # Add on altered columns
        for name, type in altered.items():
            if (primary_key_override and primary_key_override == name) or \
               (not primary_key_override and name in indexes and
                indexes[name]['primary_key']):
                type += " PRIMARY KEY"
            if (name in indexes and indexes[name]['unique'] and
                name not in uniques_deleted):
                type += " UNIQUE"
            definitions[name] = type
        # Add on the new columns
        for name, (type,_) in added.items():
            if (primary_key_override and primary_key_override == name):
                type += " PRIMARY KEY"
            definitions[name] = type
        # Alright, Make the table
        self.execute("CREATE TABLE %s (%s)" % (
            self.quote_name(temp_name),
            ", ".join(["%s %s" % (self.quote_name(cname), ctype) for cname, ctype in definitions.items()]),
        ))
        # Copy over the data
        self._copy_data(table_name, temp_name, renames, added)
        # Delete the old table, move our new one over it
        self.delete_table(table_name)
        self.rename_table(temp_name, table_name)
        # Recreate multi-valued indexes
        # We can't do that before since it's impossible to rename indexes
        # and index name scope is global
        self._make_standalone_indexes(table_name, standalone_indexes, renames=renames, deleted=deleted, uniques_deleted=uniques_deleted)
        self.deferred_sql = [] # prevent double indexing

    def _copy_data(self, src, dst, field_renames={}, added={}):
        "Used to copy data into a new table"
        # Make a list of all the fields to select
        cursor = self._get_connection().cursor()
        src_fields = [column_info[0] for column_info in self._get_connection().introspection.get_table_description(cursor, src)]
        dst_fields = [column_info[0] for column_info in self._get_connection().introspection.get_table_description(cursor, dst)]
        src_fields_new = []
        dst_fields_new = []
        for field in src_fields:
            if field in field_renames:
                dst_fields_new.append(self.quote_name(field_renames[field]))
            elif field in dst_fields:
                dst_fields_new.append(self.quote_name(field))
            else:
                continue
            src_fields_new.append(self.quote_name(field))
        for field, (_,default) in added.items():
            if default is not None:
                field = self.quote_name(field)
                src_fields_new.append("%s as %s" % (default, field))
                dst_fields_new.append(field)
        # Copy over the data
        self.execute("INSERT INTO %s (%s) SELECT %s FROM %s;" % (
            self.quote_name(dst),
            ', '.join(dst_fields_new),
            ', '.join(src_fields_new),
            self.quote_name(src),
        ))

    def _create_unique(self, table_name, columns):
        self._create_index(table_name, columns, True)

    def _create_index(self, table_name, columns, unique=False, index_name=None):
        if index_name is None:
            index_name = '%s_%s' % (table_name, '__'.join(columns))
        self.execute("CREATE %sINDEX %s ON %s(%s);" % (
            unique and "UNIQUE " or "",
            self.quote_name(index_name),
            self.quote_name(table_name),
            ', '.join(self.quote_name(c) for c in columns),
        ))

    def _get_standalone_indexes(self, table_name):
        indexes = []
        cursor = self._get_connection().cursor()
        cursor.execute('PRAGMA index_list(%s)' % self.quote_name(table_name))
        # seq, name, unique
        for index, unique in [(field[1], field[2]) for field in cursor.fetchall()]:
            cursor.execute('PRAGMA index_info(%s)' % self.quote_name(index))
            info = cursor.fetchall()
            if len(info) == 1 and unique:
                # This index is already specified in the CREATE TABLE columns
                # specification
                continue
            columns = []
            for field in info:
                columns.append(field[2])
            indexes.append((index, columns, unique))
        return indexes

    def _make_standalone_indexes(self, table_name, indexes, deleted=[], renames={}, uniques_deleted=[]):
        for index_name, index, unique in indexes:
            columns = []

            for name in index:
                # Handle deletion
                if name in deleted:
                    columns = []
                    break

                # Handle renames
                if name in renames:
                    name = renames[name]
                columns.append(name)

            if columns and (set(columns) != set(uniques_deleted) or not unique):
                self._create_index(table_name, columns, unique, index_name)

    def _column_sql_for_create(self, table_name, name, field, explicit_name=True):
        "Given a field and its name, returns the full type for the CREATE TABLE (without unique/pk)"
        field.set_attributes_from_name(name)
        if not explicit_name:
            name = field.db_column
        else:
            field.column = name
        sql = self.column_sql(table_name, name, field, with_name=False, field_prepared=True)
        # Remove keywords we don't want (this should be type only, not constraint)
        if sql:
            sql = sql.replace("PRIMARY KEY", "")
        return sql
    
    def alter_column(self, table_name, name, field, explicit_name=True, ignore_constraints=False):
        """
        Changes a column's SQL definition.

        Note that this sqlite3 implementation ignores the ignore_constraints argument.
        The argument is accepted for API compatibility with the generic
        DatabaseOperations.alter_column() method.
        """
        # Change nulls to default if needed
        if not field.null and field.has_default():
            params = {
                "column": self.quote_name(name),
                "table_name": self.quote_name(table_name)
            }            
            self._update_nulls_to_default(params, field)
        # Remake the table correctly
        field._suppress_default = True
        self._remake_table(table_name, altered={
            name: self._column_sql_for_create(table_name, name, field, explicit_name),
        })

    def delete_column(self, table_name, column_name):
        """
        Deletes a column.
        """
        self._remake_table(table_name, deleted=[column_name])
    
    def rename_column(self, table_name, old, new):
        """
        Renames a column from one name to another.
        """
        self._remake_table(table_name, renames={old: new})
    
    def create_unique(self, table_name, columns):
        """
        Create an unique index on columns
        """
        self._create_unique(table_name, columns)
    
    def delete_unique(self, table_name, columns):
        """
        Delete an unique index
        """
        self._remake_table(table_name, uniques_deleted=columns)
    
    def create_primary_key(self, table_name, columns):
        if not isinstance(columns, (list, tuple)):
            columns = [columns]
        assert len(columns) == 1, "SQLite backend does not support multi-column primary keys"
        self._remake_table(table_name, primary_key_override=columns[0])

    # Not implemented this yet.
    def delete_primary_key(self, table_name):
        # By passing True in, we make sure we wipe all existing PKs.
        self._remake_table(table_name, primary_key_override=True)
    
    # No cascades on deletes
    def delete_table(self, table_name, cascade=True):
        generic.DatabaseOperations.delete_table(self, table_name, False)
