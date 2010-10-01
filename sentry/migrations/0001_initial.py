# encoding: utf-8
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):

    def forwards(self, orm):
        
        # Adding model 'GroupedMessage'
        db.create_table('sentry_groupedmessage', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('logger', self.gf('django.db.models.fields.CharField')(default='root', max_length=64, db_index=True, blank=True)),
            ('class_name', self.gf('django.db.models.fields.CharField')(db_index=True, max_length=128, null=True, blank=True)),
            ('level', self.gf('django.db.models.fields.PositiveIntegerField')(default=40, db_index=True, blank=True)),
            ('message', self.gf('django.db.models.fields.TextField')()),
            ('traceback', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('view', self.gf('django.db.models.fields.CharField')(max_length=200, db_index=True)),
            ('url', self.gf('django.db.models.fields.URLField')(max_length=200, null=True, blank=True)),
            ('server_name', self.gf('django.db.models.fields.CharField')(max_length=128, db_index=True)),
            ('checksum', self.gf('django.db.models.fields.CharField')(max_length=32, db_index=True)),
            ('status', self.gf('django.db.models.fields.PositiveIntegerField')(default=0)),
            ('times_seen', self.gf('django.db.models.fields.PositiveIntegerField')(default=1)),
            ('last_seen', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now, db_index=True)),
            ('first_seen', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now, db_index=True)),
        ))
        db.send_create_signal('sentry', ['GroupedMessage'])

        # Adding unique constraint on 'GroupedMessage', fields ['logger', 'view', 'checksum']
        db.create_unique('sentry_groupedmessage', ['logger', 'view', 'checksum'])

        # Adding model 'Message'
        db.create_table('sentry_message', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('logger', self.gf('django.db.models.fields.CharField')(default='root', max_length=64, db_index=True, blank=True)),
            ('class_name', self.gf('django.db.models.fields.CharField')(db_index=True, max_length=128, null=True, blank=True)),
            ('level', self.gf('django.db.models.fields.PositiveIntegerField')(default=40, db_index=True, blank=True)),
            ('message', self.gf('django.db.models.fields.TextField')()),
            ('traceback', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('view', self.gf('django.db.models.fields.CharField')(max_length=200, db_index=True)),
            ('url', self.gf('django.db.models.fields.URLField')(max_length=200, null=True, blank=True)),
            ('server_name', self.gf('django.db.models.fields.CharField')(max_length=128, db_index=True)),
            ('checksum', self.gf('django.db.models.fields.CharField')(max_length=32, db_index=True)),
            ('datetime', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now, db_index=True)),
            ('data', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
        ))
        db.send_create_signal('sentry', ['Message'])


    def backwards(self, orm):
        
        # Deleting model 'GroupedMessage'
        db.delete_table('sentry_groupedmessage')

        # Removing unique constraint on 'GroupedMessage', fields ['logger', 'view', 'checksum']
        db.delete_unique('sentry_groupedmessage', ['logger', 'view', 'checksum'])

        # Deleting model 'Message'
        db.delete_table('sentry_message')


    models = {
        'sentry.groupedmessage': {
            'Meta': {'unique_together': "(('logger', 'view', 'checksum'),)", 'object_name': 'GroupedMessage'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'db_index': 'True'})
        },
        'sentry.message': {
            'Meta': {'object_name': 'Message'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '255', 'db_index': 'True'})
        }
    }

    complete_apps = ['sentry']
