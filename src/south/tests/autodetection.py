from south.tests import unittest

from south.creator.changes import AutoChanges, InitialChanges
from south.migration.base import Migrations
from south.tests import Monkeypatcher
from south.creator import freezer
from south.orm import FakeORM
from south.v2 import SchemaMigration

try:
    from django.utils.six.moves import reload_module
except ImportError:
    # Older django, no python3 support
    reload_module = reload

class TestComparison(unittest.TestCase):
    
    """
    Tests the comparison methods of startmigration.
    """
    
    def test_no_change(self):
        "Test with a completely unchanged definition."
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['southdemo.Lizard']"}),
                ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['southdemo.Lizard']"}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.related.ForeignKey', ['ohhai', 'there'], {'to': "somewhere", "from": "there"}),
                ('django.db.models.fields.related.ForeignKey', ['ohhai', 'there'], {"from": "there", 'to': "somewhere"}),
            ),
            False,
        )
    
    
    def test_pos_change(self):
        "Test with a changed positional argument."
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['hi'], {'to': "foo"}),
                ('django.db.models.fields.CharField', [], {'to': "foo"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', [], {'to': "foo"}),
                ('django.db.models.fields.CharField', ['bye'], {'to': "foo"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['pi'], {'to': "foo"}),
                ('django.db.models.fields.CharField', ['pi'], {'to': "foo"}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['pisdadad'], {'to': "foo"}),
                ('django.db.models.fields.CharField', ['pi'], {'to': "foo"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['hi'], {}),
                ('django.db.models.fields.CharField', [], {}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', [], {}),
                ('django.db.models.fields.CharField', ['bye'], {}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['pi'], {}),
                ('django.db.models.fields.CharField', ['pi'], {}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['pi'], {}),
                ('django.db.models.fields.CharField', ['45fdfdf'], {}),
            ),
            True,
        )
    
    
    def test_kwd_change(self):
        "Test a changed keyword argument"
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['pi'], {'to': "foo"}),
                ('django.db.models.fields.CharField', ['pi'], {'to': "blue"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', [], {'to': "foo"}),
                ('django.db.models.fields.CharField', [], {'to': "blue"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['b'], {'to': "foo"}),
                ('django.db.models.fields.CharField', ['b'], {'to': "blue"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', [], {'to': "foo"}),
                ('django.db.models.fields.CharField', [], {}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['a'], {'to': "foo"}),
                ('django.db.models.fields.CharField', ['a'], {}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', [], {}),
                ('django.db.models.fields.CharField', [], {'to': "foo"}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('django.db.models.fields.CharField', ['a'], {}),
                ('django.db.models.fields.CharField', ['a'], {'to': "foo"}),
            ),
            True,
        )
        
    
    
    def test_backcompat_nochange(self):
        "Test that the backwards-compatable comparison is working"
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', [], {}),
                ('django.db.models.fields.CharField', [], {}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['ack'], {}),
                ('django.db.models.fields.CharField', ['ack'], {}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', [], {'to':'b'}),
                ('django.db.models.fields.CharField', [], {'to':'b'}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['hah'], {'to':'you'}),
                ('django.db.models.fields.CharField', ['hah'], {'to':'you'}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['hah'], {'to':'you'}),
                ('django.db.models.fields.CharField', ['hah'], {'to':'heh'}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['hah'], {}),
                ('django.db.models.fields.CharField', [], {'to':"orm['appname.hah']"}),
            ),
            False,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['hah'], {}),
                ('django.db.models.fields.CharField', [], {'to':'hah'}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['hah'], {}),
                ('django.db.models.fields.CharField', [], {'to':'rrr'}),
            ),
            True,
        )
        
        self.assertEqual(
            AutoChanges.different_attributes(
                ('models.CharField', ['hah'], {}),
                ('django.db.models.fields.IntField', [], {'to':'hah'}),
            ),
            True,
        )

class TestNonManagedIgnored(Monkeypatcher):
    
    installed_apps = ["non_managed"]

    full_defs = {
        'non_managed.legacy': {
            'Meta': {'object_name': 'Legacy', 'db_table': "'legacy_table'", 'managed': 'False'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '10', 'null': 'True'}),
            'size': ('django.db.models.fields.IntegerField', [], {})
        }
    } 

    def test_not_added_init(self):
        
        migrations = Migrations("non_managed")
        changes = InitialChanges(migrations)
        change_list = changes.get_changes()
        if list(change_list):
            self.fail("Initial migration creates table for non-managed model")

    def test_not_added_auto(self):

        empty_defs = { }
        class EmptyMigration(SchemaMigration):
            "Serves as fake previous migration"
        
            def forwards(self, orm):
                pass
        
            def backwards(self, orm):
                pass
        
            models = empty_defs

            complete_apps = ['non_managed']
                    
        migrations = Migrations("non_managed")
        empty_orm = FakeORM(EmptyMigration, "non_managed")
        changes = AutoChanges(
            migrations = migrations,
            old_defs = empty_defs,
            old_orm = empty_orm,
            new_defs = self.full_defs,
        )
        change_list = changes.get_changes()
        if list(change_list):
            self.fail("Auto migration creates table for non-managed model")

    def test_not_deleted_auto(self):

        empty_defs = { }
        old_defs = freezer.freeze_apps(["non_managed"])
        class InitialMigration(SchemaMigration):
            "Serves as fake previous migration"
        
            def forwards(self, orm):
                pass
        
            def backwards(self, orm):
                pass
        
            models = self.full_defs

            complete_apps = ['non_managed']
                    
        migrations = Migrations("non_managed")
        initial_orm = FakeORM(InitialMigration, "non_managed")
        changes = AutoChanges(
            migrations = migrations,
            old_defs = self.full_defs,
            old_orm = initial_orm,
            new_defs = empty_defs,
        )
        change_list = changes.get_changes()
        if list(change_list):
            self.fail("Auto migration deletes table for non-managed model")

    def test_not_modified_auto(self):

        fake_defs = {
            'non_managed.legacy': {
                'Meta': {'object_name': 'Legacy', 'db_table': "'legacy_table'", 'managed': 'False'},
                'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
                'name': ('django.db.models.fields.CharField', [], {'max_length': '10', 'null': 'True'}),
                #'size': ('django.db.models.fields.IntegerField', [], {}) # The "change" is the addition of this field
            }
        } 
        class InitialMigration(SchemaMigration):
            "Serves as fake previous migration"
        
            def forwards(self, orm):
                pass
        
            def backwards(self, orm):
                pass
        
            models = fake_defs

            complete_apps = ['non_managed']
                    
        from non_managed import models as dummy_import_to_force_loading_models # TODO: Does needing this indicate a bug in MokeyPatcher?
        reload_module(dummy_import_to_force_loading_models) # really force... 
        
        migrations = Migrations("non_managed")
        initial_orm = FakeORM(InitialMigration, "non_managed")
        changes = AutoChanges(
            migrations = migrations,
            old_defs = fake_defs,
            old_orm = initial_orm,
            new_defs = self.full_defs
        )
        change_list = changes.get_changes()
        if list(change_list):
            self.fail("Auto migration changes table for non-managed model")
