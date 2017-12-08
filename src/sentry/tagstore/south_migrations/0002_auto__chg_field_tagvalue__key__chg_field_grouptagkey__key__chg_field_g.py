# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    # Flag to indicate if this migration is too risky
    # to run online and needs to be coordinated for offline
    is_dangerous = True

    def forwards(self, orm):

        # Renaming column for 'TagValue._key' to match new field type.
        db.rename_column(u'tagstore_tagvalue', 'key', 'key_id')
        # Changing field 'TagValue._key'
        db.alter_column(
            u'tagstore_tagvalue',
            'key_id',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'],
                db_column='key_id'))

        # Renaming column for 'GroupTagKey._key' to match new field type.
        db.rename_column(u'tagstore_grouptagkey', 'key', 'key_id')
        # Changing field 'GroupTagKey._key'
        db.alter_column(
            u'tagstore_grouptagkey',
            'key_id',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'],
                db_column='key_id'))

        # Renaming column for 'GroupTagValue._key' to match new field type.
        db.rename_column(u'tagstore_grouptagvalue', 'key', 'key_id')
        # Changing field 'GroupTagValue._key'
        db.alter_column(
            u'tagstore_grouptagvalue',
            'key_id',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'],
                db_column='key_id'))

        # Renaming column for 'GroupTagValue._value' to match new field type.
        db.rename_column(u'tagstore_grouptagvalue', 'value', 'value_id')
        # Changing field 'GroupTagValue._value'
        db.alter_column(
            u'tagstore_grouptagvalue',
            'value_id',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagValue'],
                db_column='value_id'))

    def backwards(self, orm):

        # Renaming column for 'TagValue._key' to match new field type.
        db.rename_column(u'tagstore_tagvalue', 'key_id', 'key')
        # Changing field 'TagValue._key'
        db.alter_column(
            u'tagstore_tagvalue',
            'key',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'],
                db_column='key'))

        # Renaming column for 'GroupTagKey._key' to match new field type.
        db.rename_column(u'tagstore_grouptagkey', 'key_id', 'key')
        # Changing field 'GroupTagKey._key'
        db.alter_column(
            u'tagstore_grouptagkey',
            'key',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'],
                db_column='key'))

        # Renaming column for 'GroupTagValue._key' to match new field type.
        db.rename_column(u'tagstore_grouptagvalue', 'key_id', 'key')
        # Changing field 'GroupTagValue._key'
        db.alter_column(
            u'tagstore_grouptagvalue',
            'key',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'],
                db_column='key'))

        # Renaming column for 'GroupTagValue._value' to match new field type.
        db.rename_column(u'tagstore_grouptagvalue', 'value_id', 'value')
        # Changing field 'GroupTagValue._value'
        db.alter_column(
            u'tagstore_grouptagvalue',
            'value',
            self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagValue'],
                db_column='value'))

    models = {
        'tagstore.eventtag': {
            'Meta': {'unique_together': "(('event_id', 'key', 'value'),)", 'object_name': 'EventTag', 'index_together': "(('project_id', 'key', 'value'), ('group_id', 'key', 'value'), ('environment_id', 'key', 'value'))"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'event_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key'"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'value': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagValue']", 'db_column': "'value'"})
        },
        'tagstore.grouptagkey': {
            'Meta': {'unique_together': "(('project_id', 'group_id', 'environment_id', '_key'),)", 'object_name': 'GroupTagKey'},
            '_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.grouptagvalue': {
            'Meta': {'unique_together': "(('project_id', 'group_id', 'environment_id', '_key', '_value'),)", 'object_name': 'GroupTagValue', 'index_together': "(('project_id', '_key', '_value', 'last_seen'),)"},
            '_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            '_value': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagValue']", 'db_column': "'value_id'"}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.tagkey': {
            'Meta': {'unique_together': "(('project_id', 'environment_id', 'key'),)", 'object_name': 'TagKey'},
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.tagvalue': {
            'Meta': {'unique_together': "(('project_id', 'environment_id', '_key', 'value'),)", 'object_name': 'TagValue', 'index_together': "(('project_id', '_key', 'last_seen'),)"},
            '_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        }
    }

    complete_apps = ['tagstore']
