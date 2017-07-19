import datetime
from warnings import filterwarnings

from south.db import db, generic
from django.db import connection, models, IntegrityError as DjangoIntegrityError

from south.tests import unittest, skipIf, skipUnless
from south.utils.py3 import text_type, with_metaclass

# Create a list of error classes from the various database libraries
errors = []
try:
    from psycopg2 import ProgrammingError
    errors.append(ProgrammingError)
except ImportError:
    pass
errors = tuple(errors)

# On SQL Server, the backend's IntegrityError is not (a subclass of) Django's.
try:
    from sql_server.pyodbc.base import IntegrityError as SQLServerIntegrityError
    IntegrityError = (DjangoIntegrityError, SQLServerIntegrityError)
except ImportError:
    IntegrityError = DjangoIntegrityError

try:
    from south.db import mysql
except ImportError:
    mysql = None


class TestOperations(unittest.TestCase):

    """
    Tests if the various DB abstraction calls work.
    Can only test a limited amount due to DB differences.
    """

    def setUp(self):
        db.debug = False
        try:
            import MySQLdb
        except ImportError:
            pass
        else:
            filterwarnings('ignore', category=MySQLdb.Warning)
        db.clear_deferred_sql()
        db.start_transaction()
    
    def tearDown(self):
        db.rollback_transaction()

    def test_create(self):
        """
        Test creation of tables.
        """
        cursor = connection.cursor()
        # It needs to take at least 2 args
        self.assertRaises(TypeError, db.create_table)
        self.assertRaises(TypeError, db.create_table, "test1")
        # Empty tables (i.e. no columns) are not fine, so make at least 1
        db.create_table("test1", [('email_confirmed', models.BooleanField(default=False))])
        # And should exist
        cursor.execute("SELECT * FROM test1")
        # Make sure we can't do the same query on an empty table
        try:
            cursor.execute("SELECT * FROM nottheretest1")
        except:
            pass
        else:
            self.fail("Non-existent table could be selected!")
    
    @skipUnless(db.raises_default_errors, 'This database does not raise errors on missing defaults.')
    def test_create_default(self):
        """
        Test creation of tables, make sure defaults are not left in the database
        """
        db.create_table("test_create_default", [('a', models.IntegerField()),
                                                ('b', models.IntegerField(default=17))])
        cursor = connection.cursor()
        self.assertRaises(IntegrityError, cursor.execute, "INSERT INTO test_create_default(a) VALUES (17)")
        
    def test_delete(self):
        """
        Test deletion of tables.
        """
        cursor = connection.cursor()
        db.create_table("test_deltable", [('email_confirmed', models.BooleanField(default=False))])
        db.delete_table("test_deltable")
        # Make sure it went
        try:
            cursor.execute("SELECT * FROM test_deltable")
        except:
            pass
        else:
            self.fail("Just-deleted table could be selected!")
    
    def test_nonexistent_delete(self):
        """
        Test deletion of nonexistent tables.
        """
        try:
            db.delete_table("test_nonexistdeltable")
        except:
            pass
        else:
            self.fail("Non-existent table could be deleted!")
    
    def test_foreign_keys(self):
        """
        Tests foreign key creation, especially uppercase (see #61)
        """
        Test = db.mock_model(model_name='Test', db_table='test5a',
                             db_tablespace='', pk_field_name='ID',
                             pk_field_type=models.AutoField, pk_field_args=[])
        db.create_table("test5a", [('ID', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True))])
        db.create_table("test5b", [
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('UNIQUE', models.ForeignKey(Test)),
        ])
        db.execute_deferred_sql()
        
    @skipUnless(db.supports_foreign_keys, 'Foreign keys can only be deleted on '
                                          'engines that support them.')
    def test_recursive_foreign_key_delete(self):
        """
        Test that recursive foreign keys are deleted correctly (see #1065)
        """
        Test = db.mock_model(model_name='Test', db_table='test_rec_fk_del',
                             db_tablespace='', pk_field_name='id',
                             pk_field_type=models.AutoField, pk_field_args=[])
        db.create_table('test_rec_fk_del', [
            ('id', models.AutoField(primary_key=True, auto_created=True)),
            ('fk', models.ForeignKey(Test)),
        ])
        db.execute_deferred_sql()
        db.delete_foreign_key('test_rec_fk_del', 'fk_id')
    
    def test_rename(self):
        """
        Test column renaming
        """
        cursor = connection.cursor()
        db.create_table("test_rn", [('spam', models.BooleanField(default=False))])
        # Make sure we can select the column
        cursor.execute("SELECT spam FROM test_rn")
        # Rename it
        db.rename_column("test_rn", "spam", "eggs")
        cursor.execute("SELECT eggs FROM test_rn")
        db.commit_transaction()
        db.start_transaction()
        try:
            cursor.execute("SELECT spam FROM test_rn")
        except:
            pass
        else:
            self.fail("Just-renamed column could be selected!")
        db.rollback_transaction()
        db.delete_table("test_rn")
        db.start_transaction()
    
    def test_dry_rename(self):
        """
        Test column renaming while --dry-run is turned on (should do nothing)
        See ticket #65
        """
        cursor = connection.cursor()
        db.create_table("test_drn", [('spam', models.BooleanField(default=False))])
        # Make sure we can select the column
        cursor.execute("SELECT spam FROM test_drn")
        # Rename it
        db.dry_run = True
        db.rename_column("test_drn", "spam", "eggs")
        db.dry_run = False
        cursor.execute("SELECT spam FROM test_drn")
        db.commit_transaction()
        db.start_transaction()
        try:
            cursor.execute("SELECT eggs FROM test_drn")
        except:
            pass
        else:
            self.fail("Dry-renamed new column could be selected!")
        db.rollback_transaction()
        db.delete_table("test_drn")
        db.start_transaction()
    
    def test_table_rename(self):
        """
        Test column renaming
        """
        cursor = connection.cursor()
        db.create_table("testtr", [('spam', models.BooleanField(default=False))])
        # Make sure we can select the column
        cursor.execute("SELECT spam FROM testtr")
        # Rename it
        db.rename_table("testtr", "testtr2")
        cursor.execute("SELECT spam FROM testtr2")
        db.commit_transaction()
        db.start_transaction()
        try:
            cursor.execute("SELECT spam FROM testtr")
        except:
            pass
        else:
            self.fail("Just-renamed column could be selected!")
        db.rollback_transaction()
        db.delete_table("testtr2")
        db.start_transaction()
    
    def test_percents_in_defaults(self):
        """
        Test that % in a default gets escaped to %%.
        """
        try:
            db.create_table("testpind", [('cf', models.CharField(max_length=255, default="It should be 2%!"))])
        except IndexError:
            self.fail("% was not properly escaped in column SQL.")
        db.delete_table("testpind")
    
    def test_index(self):
        """
        Test the index operations
        """
        db.create_table("test3", [
            ('SELECT', models.BooleanField(default=False)),
            ('eggs', models.IntegerField(unique=True)),
        ])
        db.execute_deferred_sql()
        # Add an index on that column
        db.create_index("test3", ["SELECT"])
        # Add another index on two columns
        db.create_index("test3", ["SELECT", "eggs"])
        # Delete them both
        db.delete_index("test3", ["SELECT"])
        db.delete_index("test3", ["SELECT", "eggs"])
        # Delete the unique index/constraint
        if db.backend_name != "sqlite3":
            db.delete_unique("test3", ["eggs"])
        db.delete_table("test3")
    
    def test_primary_key(self):
        """
        Test the primary key operations
        """
        
        db.create_table("test_pk", [
            ('id', models.IntegerField(primary_key=True)),
            ('new_pkey', models.IntegerField()),
            ('eggs', models.IntegerField(unique=True)),
        ])
        db.execute_deferred_sql()
        # Remove the default primary key, and make eggs it
        db.delete_primary_key("test_pk")
        db.create_primary_key("test_pk", "new_pkey")
        # Try inserting a now-valid row pair
        db.execute("INSERT INTO test_pk (id, new_pkey, eggs) VALUES (1, 2, 3)")
        db.execute("INSERT INTO test_pk (id, new_pkey, eggs) VALUES (1, 3, 4)")
        db.delete_table("test_pk")
    
    def test_primary_key_implicit(self):
        """
        Tests that changing primary key implicitly fails.
        """
        db.create_table("test_pki", [
            ('id', models.IntegerField(primary_key=True)),
            ('new_pkey', models.IntegerField()),
            ('eggs', models.IntegerField(unique=True)),
        ])
        db.execute_deferred_sql()
        # Fiddle with alter_column to attempt to make it remove the primary key
        db.alter_column("test_pki", "id", models.IntegerField())
        db.alter_column("test_pki", "new_pkey", models.IntegerField(primary_key=True))
        # Try inserting a should-be-valid row pair
        db.execute("INSERT INTO test_pki (id, new_pkey, eggs) VALUES (1, 2, 3)")
        db.execute("INSERT INTO test_pki (id, new_pkey, eggs) VALUES (2, 2, 4)")
        db.delete_table("test_pki")
    
    def test_add_columns(self):
        """
        Test adding columns
        """
        db.create_table("test_addc", [
            ('spam', models.BooleanField(default=False)),
            ('eggs', models.IntegerField()),
        ])
        # Add a column
        db.add_column("test_addc", "add1", models.IntegerField(default=3))
        User = db.mock_model(model_name='User', db_table='auth_user', db_tablespace='', pk_field_name='id', pk_field_type=models.AutoField, pk_field_args=[], pk_field_kwargs={})
        # insert some data so we can test the default value of the added fkey
        db.execute("INSERT INTO test_addc (spam, eggs, add1) VALUES (%s, 1, 2)", [False])
        db.add_column("test_addc", "user", models.ForeignKey(User, null=True))
        db.execute_deferred_sql()
        # try selecting from the user_id column to make sure it was actually created
        val = db.execute("SELECT user_id FROM test_addc")[0][0]
        self.assertEquals(val, None)
        db.delete_column("test_addc", "add1")
        # make sure adding an indexed field works
        db.add_column("test_addc", "add2", models.CharField(max_length=15, db_index=True, default='pi'))
        db.execute_deferred_sql()
        db.delete_table("test_addc")

    def test_delete_columns(self):
        """
        Test deleting columns
        """
        db.create_table("test_delc", [
            ('spam', models.BooleanField(default=False)),
            ('eggs', models.IntegerField(db_index=True, unique=True)),
        ])
        db.delete_column("test_delc", "eggs")

    def test_add_nullbool_column(self):
        """
        Test adding NullBoolean columns
        """
        db.create_table("test_addnbc", [
            ('spam', models.BooleanField(default=False)),
            ('eggs', models.IntegerField()),
        ])
        # Add a column
        db.add_column("test_addnbc", "add1", models.NullBooleanField())
        # Add a column with a default
        db.add_column("test_addnbc", "add2", models.NullBooleanField(default=True))
        # insert some data so we can test the default values of the added column
        db.execute("INSERT INTO test_addnbc (spam, eggs) VALUES (%s, 1)", [False])
        # try selecting from the new columns to make sure they were properly created
        false, null1, null2 = db.execute("SELECT spam,add1,add2 FROM test_addnbc")[0][0:3]
        self.assertIsNone(null1, "Null boolean field with no value inserted returns non-null")
        self.assertIsNone(null2, "Null boolean field (added with default) with no value inserted returns non-null")
        self.assertEquals(false, False)
        db.delete_table("test_addnbc")
    
    def test_alter_columns(self):
        """
        Test altering columns
        """
        db.create_table("test_alterc", [
            ('spam', models.BooleanField(default=False)),
            ('eggs', models.IntegerField()),
        ])
        db.execute_deferred_sql()
        # Change eggs to be a FloatField
        db.alter_column("test_alterc", "eggs", models.FloatField())
        db.execute_deferred_sql()
        db.delete_table("test_alterc")
        db.execute_deferred_sql()
    
    def test_alter_char_default(self):
        """
        Test altering column defaults with char fields
        """
        db.create_table("test_altercd", [
            ('spam', models.CharField(max_length=30)),
            ('eggs', models.IntegerField()),
        ])
        # Change spam default
        db.alter_column("test_altercd", "spam", models.CharField(max_length=30, default="loof", null=True))
        # Assert the default is not in the database
        db.execute("INSERT INTO test_altercd (eggs) values (12)")
        null = db.execute("SELECT spam FROM test_altercd")[0][0]
        self.assertFalse(null, "Default for char field was installed into database")

        # Change again to a column with default and not null
        db.alter_column("test_altercd", "spam", models.CharField(max_length=30, default="loof", null=False))
        # Assert the default is not in the database
        if 'oracle' in db.backend_name:
            # Oracle special treatment -- nulls are always allowed in char columns, so 
            # inserting doesn't raise an integrity error; so we check again as above
            db.execute("DELETE FROM test_altercd")
            db.execute("INSERT INTO test_altercd (eggs) values (12)")
            null = db.execute("SELECT spam FROM test_altercd")[0][0]
            self.assertFalse(null, "Default for char field was installed into database")
        else:
            # For other backends, insert should now just fail
            self.assertRaises(IntegrityError,
                              db.execute, "INSERT INTO test_altercd (eggs) values (12)")

    @skipIf('oracle' in db.backend_name, "Oracle does not differentiate empty trings from null")
    def test_default_empty_string(self):
        """
        Test altering column defaults with char fields
        """
        db.create_table("test_cd_empty", [
            ('spam', models.CharField(max_length=30, default='')),
            ('eggs', models.CharField(max_length=30)),
        ])
        # Create a record
        db.execute("INSERT INTO test_cd_empty (spam, eggs) values ('1','2')")
        # Add a column
        db.add_column("test_cd_empty", "ham", models.CharField(max_length=30, default=''))
        
        empty = db.execute("SELECT ham FROM test_cd_empty")[0][0]
        self.assertEquals(empty, "", "Empty Default for char field isn't empty string")
        
    @skipUnless('oracle' in db.backend_name, "Oracle does not differentiate empty trings from null")
    def test_oracle_strings_null(self):
        """
        Test that under Oracle, CherFields are created as null even when specified not-null,
        because otherwise they would not be able to hold empty strings (which Oracle equates
        with nulls).
        Verify fix of #1269.
        """
        db.create_table("test_ora_char_nulls", [
            ('spam', models.CharField(max_length=30, null=True)),
            ('eggs', models.CharField(max_length=30)),
        ])
        db.add_column("test_ora_char_nulls", "ham", models.CharField(max_length=30))
        db.alter_column("test_ora_char_nulls", "spam", models.CharField(max_length=30, null=False))
        # So, by the look of it, we should now have three not-null columns
        db.execute("INSERT INTO test_ora_char_nulls VALUES (NULL, NULL, NULL)")
        

    def test_mysql_defaults(self):
        """
        Test MySQL default handling for BLOB and TEXT.
        """
        db.create_table("test_altermyd", [
            ('spam', models.BooleanField(default=False)),
            ('eggs', models.TextField()),
        ])
        # Change eggs to be a FloatField
        db.alter_column("test_altermyd", "eggs", models.TextField(null=True))
        db.delete_table("test_altermyd")
    
    def test_alter_column_postgres_multiword(self):
        """
        Tests altering columns with multiple words in Postgres types (issue #125)
        e.g. 'datetime with time zone', look at django/db/backends/postgresql/creation.py
        """
        db.create_table("test_multiword", [
            ('col_datetime', models.DateTimeField(null=True)),
            ('col_integer', models.PositiveIntegerField(null=True)),
            ('col_smallint', models.PositiveSmallIntegerField(null=True)),
            ('col_float', models.FloatField(null=True)),
        ])
        
        # test if 'double precision' is preserved
        db.alter_column('test_multiword', 'col_float', models.FloatField('float', null=True))

        # test if 'CHECK ("%(column)s" >= 0)' is stripped
        db.alter_column('test_multiword', 'col_integer', models.PositiveIntegerField(null=True))
        db.alter_column('test_multiword', 'col_smallint', models.PositiveSmallIntegerField(null=True))

        # test if 'with timezone' is preserved
        if db.backend_name == "postgres":
            db.execute("INSERT INTO test_multiword (col_datetime) VALUES ('2009-04-24 14:20:55+02')")
            db.alter_column('test_multiword', 'col_datetime', models.DateTimeField(auto_now=True))
            assert db.execute("SELECT col_datetime = '2009-04-24 14:20:55+02' FROM test_multiword")[0][0]

        db.delete_table("test_multiword")
    
    @skipUnless(db.has_check_constraints, 'Only applies to databases that '
                                          'support CHECK constraints.')
    def test_alter_constraints(self):
        """
        Tests that going from a PostiveIntegerField to an IntegerField drops
        the constraint on the database.
        """
        # Make the test table
        db.create_table("test_alterc", [
            ('num', models.PositiveIntegerField()),
        ])
        db.execute_deferred_sql()
        # Add in some test values
        db.execute("INSERT INTO test_alterc (num) VALUES (1)")
        db.execute("INSERT INTO test_alterc (num) VALUES (2)")
        # Ensure that adding a negative number is bad
        db.commit_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alterc (num) VALUES (-3)")
        except:
            db.rollback_transaction()
        else:
            self.fail("Could insert a negative integer into a PositiveIntegerField.")
        # Alter it to a normal IntegerField
        db.alter_column("test_alterc", "num", models.IntegerField())
        db.execute_deferred_sql()
        # It should now work
        db.execute("INSERT INTO test_alterc (num) VALUES (-3)")
        db.delete_table("test_alterc")
        # We need to match up for tearDown
        db.start_transaction()
    
    @skipIf(db.backend_name == "sqlite3", "SQLite backend doesn't support this "
                                          "yet.")
    def test_unique(self):
        """
        Tests creating/deleting unique constraints.
        """
        db.create_table("test_unique2", [
            ('id', models.AutoField(primary_key=True)),
        ])
        db.create_table("test_unique", [
            ('spam', models.BooleanField(default=False)),
            ('eggs', models.IntegerField()),
            ('ham', models.ForeignKey(db.mock_model('Unique2', 'test_unique2'))),
        ])
        db.execute_deferred_sql()
        # Add a constraint
        db.create_unique("test_unique", ["spam"])
        db.execute_deferred_sql()
        # Shouldn't do anything during dry-run
        db.dry_run = True
        db.delete_unique("test_unique", ["spam"])
        db.dry_run = False
        db.delete_unique("test_unique", ["spam"])
        db.create_unique("test_unique", ["spam"])
        # Special preparations for Sql Server
        if db.backend_name == "pyodbc":
            db.execute("SET IDENTITY_INSERT test_unique2 ON;")
        db.execute("INSERT INTO test_unique2 (id) VALUES (1)")
        db.execute("INSERT INTO test_unique2 (id) VALUES (2)")
        db.commit_transaction()
        db.start_transaction()

        
        # Test it works
        TRUE = (True,)
        FALSE = (False,)
        db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 0, 1)", TRUE)
        db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 1, 2)", FALSE)
        try:
            db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 2, 1)", FALSE)
        except:
            db.rollback_transaction()
        else:
            self.fail("Could insert non-unique item.")
        
        # Drop that, add one only on eggs
        db.delete_unique("test_unique", ["spam"])
        db.execute("DELETE FROM test_unique")
        db.create_unique("test_unique", ["eggs"])
        db.start_transaction()
        
        # Test similarly
        db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 0, 1)", TRUE)
        db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 1, 2)", FALSE)
        try:
            db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 1, 1)", TRUE)
        except:
            db.rollback_transaction()
        else:
            self.fail("Could insert non-unique item.")
        
        # Drop those, test combined constraints
        db.delete_unique("test_unique", ["eggs"])
        db.execute("DELETE FROM test_unique")
        db.create_unique("test_unique", ["spam", "eggs", "ham_id"])
        db.start_transaction()
        # Test similarly
        db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 0, 1)", TRUE)
        db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 1, 1)", FALSE)
        try:
            db.execute("INSERT INTO test_unique (spam, eggs, ham_id) VALUES (%s, 0, 1)", TRUE)
        except:
            db.rollback_transaction()
        else:
            self.fail("Could insert non-unique pair.")
        db.delete_unique("test_unique", ["spam", "eggs", "ham_id"])
        db.start_transaction()
    
    def test_alter_unique(self):
        """
        Tests that unique constraints are not affected when
        altering columns (that's handled by create_/delete_unique)
        """
        db.create_table("test_alter_unique", [
            ('spam', models.IntegerField()),
            ('eggs', models.IntegerField(unique=True)),
        ])
        db.execute_deferred_sql()
        
        # Make sure the unique constraint is created
        db.execute('INSERT INTO test_alter_unique (spam, eggs) VALUES (0, 42)')
        db.commit_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique (spam, eggs) VALUES (1, 42)")
        except:
            pass
        else:
            self.fail("Could insert the same integer twice into a unique field.")
        db.rollback_transaction()

        # Alter without unique=True (should not affect anything)
        db.alter_column("test_alter_unique", "eggs", models.IntegerField())

        # Insertion should still fail
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique (spam, eggs) VALUES (1, 42)")
        except:
            pass
        else:
            self.fail("Could insert the same integer twice into a unique field after alter_column with unique=False.")
        db.rollback_transaction()
        
        # Delete the unique index/constraint
        if db.backend_name != "sqlite3":
            db.delete_unique("test_alter_unique", ["eggs"])
        db.delete_table("test_alter_unique")
        db.start_transaction()

        # Test multi-field constraint
        db.create_table("test_alter_unique2", [
            ('spam', models.IntegerField()),
            ('eggs', models.IntegerField()),
        ])
        db.create_unique('test_alter_unique2', ('spam', 'eggs'))
        db.execute_deferred_sql()
        db.execute('INSERT INTO test_alter_unique2 (spam, eggs) VALUES (0, 42)')
        db.commit_transaction()
        # Verify that constraint works
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique2 (spam, eggs) VALUES (1, 42)")
        except:
            self.fail("Looks like multi-field unique constraint applied to only one field.")
        db.rollback_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique2 (spam, eggs) VALUES (0, 43)")
        except:
            self.fail("Looks like multi-field unique constraint applied to only one field.")
        db.rollback_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique2 (spam, eggs) VALUES (0, 42)")
        except:
            pass
        else:
            self.fail("Could insert the same pair twice into unique-together fields.")
        db.rollback_transaction()
        # Altering one column should not drop or modify multi-column constraint
        db.alter_column("test_alter_unique2", "eggs", models.PositiveIntegerField())
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique2 (spam, eggs) VALUES (1, 42)")
        except:
            self.fail("Altering one column broken multi-column unique constraint.")
        db.rollback_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique2 (spam, eggs) VALUES (0, 43)")
        except:
            self.fail("Altering one column broken multi-column unique constraint.")
        db.rollback_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_alter_unique2 (spam, eggs) VALUES (0, 42)")
        except:
            pass
        else:
            self.fail("Could insert the same pair twice into unique-together fields after alter_column with unique=False.")
        db.rollback_transaction()
        db.delete_table("test_alter_unique2")
        db.start_transaction()

    def test_capitalised_constraints(self):
        """
        Under PostgreSQL at least, capitalised constraints must be quoted.
        """
        db.create_table("test_capconst", [
            ('SOMECOL', models.PositiveIntegerField(primary_key=True)),
        ])
        # Alter it so it's not got the check constraint
        db.alter_column("test_capconst", "SOMECOL", models.IntegerField())
    
    def test_text_default(self):
        """
        MySQL cannot have blank defaults on TEXT columns.
        """
        db.create_table("test_textdef", [
            ('textcol', models.TextField(blank=True)),
        ])

    def test_text_to_char(self):
        """
        On Oracle, you can't simply ALTER TABLE MODIFY a textfield to a charfield
        """
        value = "kawabanga"
        db.create_table("test_text_to_char", [
            ('textcol', models.TextField()),
        ])
        db.execute_deferred_sql()
        db.execute("INSERT INTO test_text_to_char VALUES (%s)", [value])
        db.alter_column("test_text_to_char", "textcol", models.CharField(max_length=100))
        db.execute_deferred_sql()
        after = db.execute("select * from test_text_to_char")[0][0]
        self.assertEqual(value, after, "Change from text to char altered value [ %r != %r ]" % (value, after))

    def test_char_to_text(self):
        """
        On Oracle, you can't simply ALTER TABLE MODIFY a charfield to a textfield either
        """
        value = "agnabawak"
        db.create_table("test_char_to_text", [
            ('textcol', models.CharField(max_length=100)),
        ])
        db.execute_deferred_sql()
        db.execute("INSERT INTO test_char_to_text VALUES (%s)", [value])
        db.alter_column("test_char_to_text", "textcol", models.TextField())
        db.execute_deferred_sql()
        after = db.execute("select * from test_char_to_text")[0][0]
        after = text_type(after) # Oracle text fields return a sort of lazy string -- force evaluation
        self.assertEqual(value, after, "Change from char to text altered value [ %r != %r ]" % (value, after))

    @skipUnless(db.raises_default_errors, 'This database does not raise errors on missing defaults.')
    def test_datetime_default(self):
        """
        Test that defaults are correctly not created for datetime columns
        """
        end_of_world = datetime.datetime(2012, 12, 21, 0, 0, 1)

        try:
            from django.utils import timezone
        except ImportError:
            pass
        else:
            from django.conf import settings
            if getattr(settings, 'USE_TZ', False):
                end_of_world = end_of_world.replace(tzinfo=timezone.utc)

        db.create_table("test_datetime_def", [
            ('col0', models.IntegerField(null=True)),
            ('col1', models.DateTimeField(default=end_of_world)),
            ('col2', models.DateTimeField(null=True)),
        ])
        db.execute_deferred_sql()
        # insert a row
        db.execute("INSERT INTO test_datetime_def (col0, col1, col2) values (null,%s,null)", [end_of_world])
        db.alter_column("test_datetime_def", "col2", models.DateTimeField(default=end_of_world))
        db.add_column("test_datetime_def", "col3", models.DateTimeField(default=end_of_world))
        db.execute_deferred_sql()
        db.commit_transaction()
        # In the single existing row, we now expect col1=col2=col3=end_of_world...
        db.start_transaction()
        ends = db.execute("select col1,col2,col3 from test_datetime_def")[0]
        self.failUnlessEqual(len(ends), 3)
        for e in ends:
            self.failUnlessEqual(e, end_of_world)
        db.commit_transaction()
        # ...but there should not be a default in the database for col1 or col3
        for cols in ["col1,col2", "col2,col3"]:
            db.start_transaction()
            statement = "insert into test_datetime_def (col0,%s) values (null,%%s,%%s)" % cols
            self.assertRaises(
                IntegrityError,
                db.execute, statement, [end_of_world, end_of_world]
            )
            db.rollback_transaction()
        
        db.start_transaction() # To preserve the sanity and semantics of this test class
        
    def test_add_unique_fk(self):
        """
        Test adding a ForeignKey with unique=True or a OneToOneField
        """
        db.create_table("test_add_unique_fk", [
            ('spam', models.BooleanField(default=False))
        ])
        
        db.add_column("test_add_unique_fk", "mock1", models.ForeignKey(db.mock_model('User', 'auth_user'), null=True, unique=True))
        db.add_column("test_add_unique_fk", "mock2", models.OneToOneField(db.mock_model('User', 'auth_user'), null=True))
        db.execute_deferred_sql()
        
        db.delete_table("test_add_unique_fk")
        
    @skipUnless(db.has_check_constraints, 'Only applies to databases that '
                                          'support CHECK constraints.')
    def test_column_constraint(self):
        """
        Tests that the value constraint of PositiveIntegerField is enforced on
        the database level.
        """
        db.create_table("test_column_constraint", [
            ('spam', models.PositiveIntegerField()),
        ])
        db.execute_deferred_sql()
        
        # Make sure we can't insert negative values
        db.commit_transaction()
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_column_constraint VALUES (-42)")
        except:
            pass
        else:
            self.fail("Could insert a negative value into a PositiveIntegerField.")
        db.rollback_transaction()
        
        # remove constraint
        db.alter_column("test_column_constraint", "spam", models.IntegerField())
        db.execute_deferred_sql()
        # make sure the insertion works now
        db.execute('INSERT INTO test_column_constraint VALUES (-42)')
        db.execute('DELETE FROM test_column_constraint')
        
        # add it back again
        db.alter_column("test_column_constraint", "spam", models.PositiveIntegerField())
        db.execute_deferred_sql()
        # it should fail again
        db.start_transaction()
        try:
            db.execute("INSERT INTO test_column_constraint VALUES (-42)")
        except:
            pass
        else:
            self.fail("Could insert a negative value after changing an IntegerField to a PositiveIntegerField.")
        db.rollback_transaction()
        
        db.delete_table("test_column_constraint")
        db.start_transaction()

    def test_sql_defaults(self):
        """
        Test that sql default value is correct for non-string field types.
        Datetimes are handled in test_datetime_default.
        """

        class CustomField(with_metaclass(models.SubfieldBase, models.CharField)):
            description = 'CustomField'
            def get_default(self):
                if self.has_default():
                    if callable(self.default):
                        return self.default()
                    return self.default
                return super(CustomField, self).get_default()
            def get_prep_value(self, value):
                if not value:
                    return value
                return ','.join(map(str, value))
            def to_python(self, value):
                if not value or isinstance(value, list):
                    return value
                return list(map(int, value.split(',')))

        false_value = db.has_booleans and 'False' or '0'
        defaults = (
            (models.CharField(default='sukasuka'), 'DEFAULT \'sukasuka'),
            (models.BooleanField(default=False), 'DEFAULT %s' % false_value),
            (models.IntegerField(default=42), 'DEFAULT 42'),
            (CustomField(default=[2012, 2018, 2021, 2036]), 'DEFAULT \'2012,2018,2021,2036')
        )
        for field, sql_test_str in defaults:
            sql = db.column_sql('fish', 'YAAAAAAZ', field)
            if sql_test_str not in sql:
                self.fail("default sql value was not properly generated for field %r.\nSql was %s" % (field, sql))

    def test_make_added_foreign_key_not_null(self):
        # Table for FK to target
        User = db.mock_model(model_name='User', db_table='auth_user', db_tablespace='', pk_field_name='id', pk_field_type=models.AutoField, pk_field_args=[], pk_field_kwargs={})
        # Table with no foreign key
        db.create_table("test_fk", [
            ('eggs', models.IntegerField()),
        ])
        db.execute_deferred_sql()
        
        # Add foreign key
        db.add_column("test_fk", 'foreik', models.ForeignKey(User, null=True))
        db.execute_deferred_sql()
        
        # Make the FK not null
        db.alter_column("test_fk", "foreik_id", models.ForeignKey(User))
        db.execute_deferred_sql()

    def test_make_foreign_key_null(self):
        # Table for FK to target
        User = db.mock_model(model_name='User', db_table='auth_user', db_tablespace='', pk_field_name='id', pk_field_type=models.AutoField, pk_field_args=[], pk_field_kwargs={})
        # Table with no foreign key
        db.create_table("test_make_fk_null", [
            ('eggs', models.IntegerField()),
            ('foreik', models.ForeignKey(User))
        ])
        db.execute_deferred_sql()
        
        # Make the FK null
        db.alter_column("test_make_fk_null", "foreik_id", models.ForeignKey(User, null=True))
        db.execute_deferred_sql()

    def test_change_foreign_key_target(self):
        # Tables for FK to target
        User = db.mock_model(model_name='User', db_table='auth_user', db_tablespace='', pk_field_name='id', pk_field_type=models.AutoField, pk_field_args=[], pk_field_kwargs={})
        db.create_table("test_fk_changed_target", [
            ('eggs', models.IntegerField(primary_key=True)),
        ])
        Egg = db.mock_model(model_name='Egg', db_table='test_fk_changed_target', db_tablespace='', pk_field_name='eggs', pk_field_type=models.AutoField, pk_field_args=[], pk_field_kwargs={})
        # Table with a foreign key to the wrong table
        db.create_table("test_fk_changing", [
            ('egg', models.ForeignKey(User, null=True)),
        ])
        db.execute_deferred_sql()

        # Change foreign key pointing
        db.alter_column("test_fk_changing", "egg_id", models.ForeignKey(Egg, null=True))
        db.execute_deferred_sql()

        # Test that it is pointing at the right table now
        try:
            non_user_id = db.execute("SELECT MAX(id) FROM auth_user")[0][0] + 1
        except (TypeError, IndexError):
            # Got a "None" or no records, treat as 0
            non_user_id = 17
        db.execute("INSERT INTO test_fk_changed_target (eggs) VALUES (%s)", [non_user_id])
        db.execute("INSERT INTO test_fk_changing (egg_id) VALUES (%s)", [non_user_id])
        db.commit_transaction()
        db.start_transaction()  # The test framework expects tests to end in transaction

    def test_alter_double_indexed_column(self):
        # Table for FK to target
        User = db.mock_model(model_name='User', db_table='auth_user', db_tablespace='', pk_field_name='id', pk_field_type=models.AutoField, pk_field_args=[], pk_field_kwargs={})
        # Table with no foreign key
        db.create_table("test_2indexed", [
            ('eggs', models.IntegerField()),
            ('foreik', models.ForeignKey(User))
        ])
        db.create_unique("test_2indexed", ["eggs", "foreik_id"])
        db.execute_deferred_sql()
        
        # Make the FK null
        db.alter_column("test_2indexed", "foreik_id", models.ForeignKey(User, null=True))
        db.execute_deferred_sql()

class TestCacheGeneric(unittest.TestCase):
    base_ops_cls = generic.DatabaseOperations
    def setUp(self):
        class CacheOps(self.base_ops_cls):
            def __init__(self):
                self._constraint_cache = {}
                self.cache_filled = 0
                self.settings = {'NAME': 'db'}

            def _fill_constraint_cache(self, db, table):
                self.cache_filled += 1
                self._constraint_cache.setdefault(db, {})
                self._constraint_cache[db].setdefault(table, {})

            @generic.invalidate_table_constraints
            def clear_con(self, table):
                pass

            @generic.copy_column_constraints
            def cp_column(self, table, column_old, column_new):
                pass

            @generic.delete_column_constraints
            def rm_column(self, table, column):
                pass

            @generic.copy_column_constraints
            @generic.delete_column_constraints
            def mv_column(self, table, column_old, column_new):
                pass

            def _get_setting(self, attr):
                return self.settings[attr]
        self.CacheOps = CacheOps

    def test_cache(self):
        ops = self.CacheOps()
        self.assertEqual(0, ops.cache_filled)
        self.assertFalse(ops.lookup_constraint('db', 'table'))
        self.assertEqual(1, ops.cache_filled)
        self.assertFalse(ops.lookup_constraint('db', 'table'))
        self.assertEqual(1, ops.cache_filled)
        ops.clear_con('table')
        self.assertEqual(1, ops.cache_filled)
        self.assertFalse(ops.lookup_constraint('db', 'table'))
        self.assertEqual(2, ops.cache_filled)
        self.assertFalse(ops.lookup_constraint('db', 'table', 'column'))
        self.assertEqual(2, ops.cache_filled)

        cache = ops._constraint_cache
        cache['db']['table']['column'] = 'constraint'
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column'))
        self.assertEqual([('column', 'constraint')], ops.lookup_constraint('db', 'table'))
        self.assertEqual(2, ops.cache_filled)

        # invalidate_table_constraints
        ops.clear_con('new_table')
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column'))
        self.assertEqual(2, ops.cache_filled)

        self.assertFalse(ops.lookup_constraint('db', 'new_table'))
        self.assertEqual(3, ops.cache_filled)

        # delete_column_constraints
        cache['db']['table']['column'] = 'constraint'
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column'))
        ops.rm_column('table', 'column')
        self.assertEqual([], ops.lookup_constraint('db', 'table', 'column'))
        self.assertEqual([], ops.lookup_constraint('db', 'table', 'noexist_column'))

        # copy_column_constraints
        cache['db']['table']['column'] = 'constraint'
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column'))
        ops.cp_column('table', 'column', 'column_new')
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column_new'))
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column'))

        # copy + delete
        cache['db']['table']['column'] = 'constraint'
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column'))
        ops.mv_column('table', 'column', 'column_new')
        self.assertEqual('constraint', ops.lookup_constraint('db', 'table', 'column_new'))
        self.assertEqual([], ops.lookup_constraint('db', 'table', 'column'))

    def test_valid(self):
        ops = self.CacheOps()
        # none of these should vivify a table into a valid state
        self.assertFalse(ops._is_valid_cache('db', 'table'))
        self.assertFalse(ops._is_valid_cache('db', 'table'))
        ops.clear_con('table')
        self.assertFalse(ops._is_valid_cache('db', 'table'))
        ops.rm_column('table', 'column')
        self.assertFalse(ops._is_valid_cache('db', 'table'))

        # these should change the cache state
        ops.lookup_constraint('db', 'table')
        self.assertTrue(ops._is_valid_cache('db', 'table'))
        ops.lookup_constraint('db', 'table', 'column')
        self.assertTrue(ops._is_valid_cache('db', 'table'))
        ops.clear_con('table')
        self.assertFalse(ops._is_valid_cache('db', 'table'))

    def test_valid_implementation(self):
        # generic fills the cache on a per-table basis
        ops = self.CacheOps()
        self.assertFalse(ops._is_valid_cache('db', 'table'))
        self.assertFalse(ops._is_valid_cache('db', 'other_table'))
        ops.lookup_constraint('db', 'table')
        self.assertTrue(ops._is_valid_cache('db', 'table'))
        self.assertFalse(ops._is_valid_cache('db', 'other_table'))
        ops.lookup_constraint('db', 'other_table')
        self.assertTrue(ops._is_valid_cache('db', 'table'))
        self.assertTrue(ops._is_valid_cache('db', 'other_table'))
        ops.clear_con('table')
        self.assertFalse(ops._is_valid_cache('db', 'table'))
        self.assertTrue(ops._is_valid_cache('db', 'other_table'))

if mysql:
    class TestCacheMysql(TestCacheGeneric):
        base_ops_cls = mysql.DatabaseOperations

        def test_valid_implementation(self):
            # mysql fills the cache on a per-db basis
            ops = self.CacheOps()
            self.assertFalse(ops._is_valid_cache('db', 'table'))
            self.assertFalse(ops._is_valid_cache('db', 'other_table'))
            ops.lookup_constraint('db', 'table')
            self.assertTrue(ops._is_valid_cache('db', 'table'))
            self.assertTrue(ops._is_valid_cache('db', 'other_table'))
            ops.lookup_constraint('db', 'other_table')
            self.assertTrue(ops._is_valid_cache('db', 'table'))
            self.assertTrue(ops._is_valid_cache('db', 'other_table'))
            ops.clear_con('table')
            self.assertFalse(ops._is_valid_cache('db', 'table'))
            self.assertTrue(ops._is_valid_cache('db', 'other_table'))
