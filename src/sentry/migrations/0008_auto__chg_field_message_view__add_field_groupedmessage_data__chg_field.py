# encoding: utf-8
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):

    def forwards(self, orm):
        
        # Changing field 'Message.view'
        db.alter_column('sentry_message', 'view', self.gf('django.db.models.fields.CharField')(max_length=200, null=True))

        # Adding field 'GroupedMessage.data'
        db.add_column('sentry_groupedmessage', 'data', self.gf('django.db.models.fields.TextField')(null=True, blank=True), keep_default=False)

        # Changing field 'GroupedMessage.view'
        db.alter_column('sentry_groupedmessage', 'view', self.gf('django.db.models.fields.CharField')(max_length=200, null=True))

        # Changing field 'FilterValue.value'
        db.alter_column('sentry_filtervalue', 'value', self.gf('django.db.models.fields.CharField')(max_length=200))


    def backwards(self, orm):
        
        # Changing field 'Message.view'
        db.alter_column('sentry_message', 'view', self.gf('django.db.models.fields.CharField')(max_length=255, null=True))

        # Deleting field 'GroupedMessage.data'
        db.delete_column('sentry_groupedmessage', 'data')

        # Changing field 'GroupedMessage.view'
        db.alter_column('sentry_groupedmessage', 'view', self.gf('django.db.models.fields.CharField')(max_length=255, null=True))

        # Changing field 'FilterValue.value'
        db.alter_column('sentry_filtervalue', 'value', self.gf('django.db.models.fields.CharField')(max_length=255))


    models = {
        'sentry.filtervalue': {
            'Meta': {'unique_together': "(('key', 'value'),)", 'object_name': 'FilterValue'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.groupedmessage': {
            'Meta': {'unique_together': "(('logger', 'view', 'checksum'),)", 'object_name': 'GroupedMessage'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'sentry.message': {
            'Meta': {'object_name': 'Message'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'blank': 'True', 'related_name': "'message_set'", 'null': 'True', 'to': "orm['sentry.GroupedMessage']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'site': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        }
    }

    complete_apps = ['sentry']
