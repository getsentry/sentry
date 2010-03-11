# encoding: utf-8
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):
    
    def forwards(self, orm):
        
        # Adding model 'ErrorBatch'
        db.create_table('djangodblog_errorbatch', (
            ('status', self.gf('django.db.models.fields.PositiveIntegerField')(default=0, db_column='is_resolved')),
            ('first_seen', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now)),
            ('server_name', self.gf('django.db.models.fields.CharField')(max_length=128, db_index=True)),
            ('level', self.gf('django.db.models.fields.PositiveIntegerField')(default=40, db_index=True, blank=True)),
            ('class_name', self.gf('django.db.models.fields.CharField')(db_index=True, max_length=128, null=True, blank=True)),
            ('checksum', self.gf('django.db.models.fields.CharField')(max_length=32, db_index=True)),
            ('times_seen', self.gf('django.db.models.fields.PositiveIntegerField')(default=1)),
            ('traceback', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('url', self.gf('django.db.models.fields.URLField')(max_length=200, null=True, blank=True)),
            ('logger', self.gf('django.db.models.fields.CharField')(default='root', max_length=64, db_index=True, blank=True)),
            ('message', self.gf('django.db.models.fields.TextField')()),
            ('last_seen', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now)),
        ))
        db.send_create_signal('djangodblog', ['ErrorBatch'])

        # Adding unique constraint on 'ErrorBatch', fields ['logger', 'server_name', 'checksum']
        db.create_unique('djangodblog_errorbatch', ['logger', 'server_name', 'checksum'])

        # Adding model 'Error'
        db.create_table('djangodblog_error', (
            ('server_name', self.gf('django.db.models.fields.CharField')(max_length=128, db_index=True)),
            ('level', self.gf('django.db.models.fields.PositiveIntegerField')(default=40, db_index=True, blank=True)),
            ('class_name', self.gf('django.db.models.fields.CharField')(max_length=128, null=True, blank=True)),
            ('traceback', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('url', self.gf('django.db.models.fields.URLField')(max_length=200, null=True, blank=True)),
            ('logger', self.gf('django.db.models.fields.CharField')(default='root', max_length=64, db_index=True, blank=True)),
            ('datetime', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now)),
            ('data', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('message', self.gf('django.db.models.fields.TextField')()),
        ))
        db.send_create_signal('djangodblog', ['Error'])
    
    
    def backwards(self, orm):
        
        # Deleting model 'ErrorBatch'
        db.delete_table('djangodblog_errorbatch')

        # Removing unique constraint on 'ErrorBatch', fields ['logger', 'server_name', 'checksum']
        db.delete_unique('djangodblog_errorbatch', ['logger', 'server_name', 'checksum'])

        # Deleting model 'Error'
        db.delete_table('djangodblog_error')
    
    
    models = {
        'djangodblog.error': {
            'Meta': {'object_name': 'Error'},
            'class_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'djangodblog.errorbatch': {
            'Meta': {'unique_together': "(('logger', 'server_name', 'checksum'),)", 'object_name': 'ErrorBatch'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_column': "'is_resolved'"}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        }
    }
    
    complete_apps = ['djangodblog']
