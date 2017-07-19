# Additional MySQL-specific tests
# Written by: F. Gabriel Gosselin <gabrielNOSPAM@evidens.ca>
# Based on tests by: aarranz
from south.tests import unittest, skipUnless


from south.db import db, generic, mysql
from django.db import connection, models

from south.utils.py3 import with_metaclass


# A class decoration may be used in lieu of this when Python 2.5 is the
# minimum.
class TestMySQLOperationsMeta(type):

    def __new__(mcs, name, bases, dict_):
        decorator = skipUnless(db.backend_name == "mysql", 'MySQL-specific tests')

        for key, method in dict_.items():
            if key.startswith('test'):
                dict_[key] = decorator(method)

        return type.__new__(mcs, name, bases, dict_)

class TestMySQLOperations(with_metaclass(TestMySQLOperationsMeta, unittest.TestCase)):
    """MySQL-specific tests"""

    def setUp(self):
        db.debug = False
        db.clear_deferred_sql()

    def tearDown(self):
        pass

    def _create_foreign_tables(self, main_name, reference_name):
        # Create foreign table and model
        Foreign = db.mock_model(model_name='Foreign', db_table=reference_name,
                                db_tablespace='', pk_field_name='id',
                                pk_field_type=models.AutoField,
                                pk_field_args=[])
        db.create_table(reference_name, [
                ('id', models.AutoField(primary_key=True)),
            ])
        # Create table with foreign key
        db.create_table(main_name, [
                ('id', models.AutoField(primary_key=True)),
                ('foreign', models.ForeignKey(Foreign)),
            ])
        return Foreign

    def test_constraint_references(self):
        """Tests that referred table is reported accurately"""
        main_table = 'test_cns_ref'
        reference_table = 'test_cr_foreign'
        db.start_transaction()
        self._create_foreign_tables(main_table, reference_table)
        db.execute_deferred_sql()
        constraint = db._find_foreign_constraints(main_table, 'foreign_id')[0]
        references = db._lookup_constraint_references(main_table, constraint)
        self.assertEquals((reference_table, 'id'), references)
        db.delete_table(main_table)
        db.delete_table(reference_table)

    def test_reverse_column_constraint(self):
        """Tests that referred column in a foreign key (ex. id) is found"""
        main_table = 'test_reverse_ref'
        reference_table = 'test_rr_foreign'
        db.start_transaction()
        self._create_foreign_tables(main_table, reference_table)
        db.execute_deferred_sql()
        inverse = db._lookup_reverse_constraint(reference_table, 'id')
        (cname, rev_table, rev_column) = inverse[0]
        self.assertEquals(main_table, rev_table)
        self.assertEquals('foreign_id', rev_column)
        db.delete_table(main_table)
        db.delete_table(reference_table)

    def test_delete_fk_column(self):
        main_table = 'test_drop_foreign'
        ref_table = 'test_df_ref'
        self._create_foreign_tables(main_table, ref_table)
        db.execute_deferred_sql()
        constraints = db._find_foreign_constraints(main_table, 'foreign_id')
        self.assertEquals(len(constraints), 1)
        db.delete_column(main_table, 'foreign_id')
        constraints = db._find_foreign_constraints(main_table, 'foreign_id')
        self.assertEquals(len(constraints), 0)
        db.delete_table(main_table)
        db.delete_table(ref_table)

    def test_rename_fk_column(self):
        main_table = 'test_rename_foreign'
        ref_table = 'test_rf_ref'
        self._create_foreign_tables(main_table, ref_table)
        db.execute_deferred_sql()
        constraints = db._find_foreign_constraints(main_table, 'foreign_id')
        self.assertEquals(len(constraints), 1)
        db.rename_column(main_table, 'foreign_id', 'reference_id')
        db.execute_deferred_sql()  #Create constraints
        constraints = db._find_foreign_constraints(main_table, 'reference_id')
        self.assertEquals(len(constraints), 1)
        db.delete_table(main_table)
        db.delete_table(ref_table)

    def test_rename_fk_inbound(self):
        """
        Tests that the column referred to by an external column can be renamed.
        Edge case, but also useful as stepping stone to renaming tables.
        """
        main_table = 'test_rename_fk_inbound'
        ref_table = 'test_rfi_ref'
        self._create_foreign_tables(main_table, ref_table)
        db.execute_deferred_sql()
        constraints = db._lookup_reverse_constraint(ref_table, 'id')
        self.assertEquals(len(constraints), 1)
        db.rename_column(ref_table, 'id', 'rfi_id')
        db.execute_deferred_sql()  #Create constraints
        constraints = db._lookup_reverse_constraint(ref_table, 'rfi_id')
        self.assertEquals(len(constraints), 1)
        cname = db._find_foreign_constraints(main_table, 'foreign_id')[0]
        (rtable, rcolumn) = db._lookup_constraint_references(main_table, cname)
        self.assertEquals(rcolumn, 'rfi_id')
        db.delete_table(main_table)
        db.delete_table(ref_table)

    def test_rename_constrained_table(self):
        """Renames a table with a foreign key column (towards another table)"""
        main_table = 'test_rn_table'
        ref_table = 'test_rt_ref'
        renamed_table = 'test_renamed_table'
        self._create_foreign_tables(main_table, ref_table)
        db.execute_deferred_sql()
        constraints = db._find_foreign_constraints(main_table, 'foreign_id')
        self.assertEquals(len(constraints), 1)
        db.rename_table(main_table, renamed_table)
        db.execute_deferred_sql()  #Create constraints
        constraints = db._find_foreign_constraints(renamed_table, 'foreign_id')
        self.assertEquals(len(constraints), 1)
        (rtable, rcolumn) = db._lookup_constraint_references(
                renamed_table, constraints[0])
        self.assertEquals(rcolumn, 'id')
        db.delete_table(renamed_table)
        db.delete_table(ref_table)

    def test_renamed_referenced_table(self):
        """Rename a table referred to in a foreign key"""
        main_table = 'test_rn_refd_table'
        ref_table = 'test_rrt_ref'
        renamed_table = 'test_renamed_ref'
        self._create_foreign_tables(main_table, ref_table)
        db.execute_deferred_sql()
        constraints = db._lookup_reverse_constraint(ref_table)
        self.assertEquals(len(constraints), 1)
        db.rename_table(ref_table, renamed_table)
        db.execute_deferred_sql()  #Create constraints
        constraints = db._find_foreign_constraints(main_table, 'foreign_id')
        self.assertEquals(len(constraints), 1)
        (rtable, rcolumn) = db._lookup_constraint_references(
                main_table, constraints[0])
        self.assertEquals(renamed_table, rtable)
        db.delete_table(main_table)
        db.delete_table(renamed_table)

