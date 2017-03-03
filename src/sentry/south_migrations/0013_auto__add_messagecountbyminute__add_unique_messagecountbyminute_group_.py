# encoding: utf-8
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):

    def forwards(self, orm):

        # Adding model 'MessageCountByMinute'
        db.create_table('sentry_messagecountbyminute', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('group', self.gf('sentry.db.models.fields.FlexibleForeignKey')(to=orm['sentry.GroupedMessage'])),
            ('date', self.gf('django.db.models.fields.DateTimeField')()),
            ('times_seen', self.gf('django.db.models.fields.PositiveIntegerField')(default=0)),
        ))
        db.send_create_signal('sentry', ['MessageCountByMinute'])

        # Adding unique constraint on 'MessageCountByMinute', fields ['group', 'date']
        db.create_unique('sentry_messagecountbyminute', ['group_id', 'date'])

        # Adding model 'MessageFilterValue'
        db.create_table('sentry_messagefiltervalue', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('group', self.gf('sentry.db.models.fields.FlexibleForeignKey')(to=orm['sentry.GroupedMessage'])),
            ('times_seen', self.gf('django.db.models.fields.PositiveIntegerField')(default=0)),
            ('key', self.gf('django.db.models.fields.CharField')(max_length=32)),
            ('value', self.gf('django.db.models.fields.CharField')(max_length=200)),
        ))
        db.send_create_signal('sentry', ['MessageFilterValue'])

        # Adding unique constraint on 'MessageFilterValue', fields ['key', 'value', 'group']
        db.create_unique('sentry_messagefiltervalue', ['key', 'value', 'group_id'])


    def backwards(self, orm):

        # Removing unique constraint on 'MessageFilterValue', fields ['key', 'value', 'group']
        db.delete_unique('sentry_messagefiltervalue', ['key', 'value', 'group_id'])

        # Removing unique constraint on 'MessageCountByMinute', fields ['group', 'date']
        db.delete_unique('sentry_messagecountbyminute', ['group_id', 'date'])

        # Deleting model 'MessageCountByMinute'
        db.delete_table('sentry_messagecountbyminute')

        # Deleting model 'MessageFilterValue'
        db.delete_table('sentry_messagefiltervalue')


    models = {
        'sentry.filtervalue': {
            'Meta': {'unique_together': "(('key', 'value'),)", 'object_name': 'FilterValue'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.groupedmessage': {
            'Meta': {'unique_together': "(('logger', 'view', 'checksum'),)", 'object_name': 'GroupedMessage'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'score': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'sentry.message': {
            'Meta': {'object_name': 'Message'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "'message_set'", 'null': 'True', 'to': "orm['sentry.GroupedMessage']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'message_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'site': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'sentry.messagecountbyminute': {
            'Meta': {'unique_together': "(('group', 'date'),)", 'object_name': 'MessageCountByMinute'},
            'date': ('django.db.models.fields.DateTimeField', [], {}),
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.GroupedMessage']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.messagefiltervalue': {
            'Meta': {'unique_together': "(('key', 'value', 'group'),)", 'object_name': 'MessageFilterValue'},
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.GroupedMessage']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.messageindex': {
            'Meta': {'unique_together': "(('column', 'value', 'object_id'),)", 'object_name': 'MessageIndex'},
            'column': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'object_id': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '128'})
        }
    }

    complete_apps = ['sentry']
