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

        # Changing field 'TagKey.environment_id'
        db.alter_column(u'tagstore_tagkey', 'environment_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')(null=True))

        # Changing field 'TagKey.project_id'
        db.alter_column(u'tagstore_tagkey', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'TagValue.project_id'
        db.alter_column(u'tagstore_tagvalue', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'GroupTagKey.project_id'
        db.alter_column(u'tagstore_grouptagkey', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'GroupTagKey.group_id'
        db.alter_column(u'tagstore_grouptagkey', 'group_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'EventTag.project_id'
        db.alter_column(u'tagstore_eventtag', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'EventTag.event_id'
        db.alter_column(u'tagstore_eventtag', 'event_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'EventTag.group_id'
        db.alter_column(u'tagstore_eventtag', 'group_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'GroupTagValue.group_id'
        db.alter_column(u'tagstore_grouptagvalue', 'group_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

        # Changing field 'GroupTagValue.project_id'
        db.alter_column(u'tagstore_grouptagvalue', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedBigIntegerField')())

    def backwards(self, orm):

        # Changing field 'TagKey.environment_id'
        db.alter_column(u'tagstore_tagkey', 'environment_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True))

        # Changing field 'TagKey.project_id'
        db.alter_column(u'tagstore_tagkey', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'TagValue.project_id'
        db.alter_column(u'tagstore_tagvalue', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'GroupTagKey.project_id'
        db.alter_column(u'tagstore_grouptagkey', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'GroupTagKey.group_id'
        db.alter_column(u'tagstore_grouptagkey', 'group_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'EventTag.project_id'
        db.alter_column(u'tagstore_eventtag', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'EventTag.event_id'
        db.alter_column(u'tagstore_eventtag', 'event_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'EventTag.group_id'
        db.alter_column(u'tagstore_eventtag', 'group_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'GroupTagValue.group_id'
        db.alter_column(u'tagstore_grouptagvalue', 'group_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

        # Changing field 'GroupTagValue.project_id'
        db.alter_column(u'tagstore_grouptagvalue', 'project_id', self.gf(
            'sentry.db.models.fields.bounded.BoundedPositiveIntegerField')())

    models = {
        'tagstore.eventtag': {
            'Meta': {'unique_together': "(('project_id', 'event_id', 'key', 'value'),)", 'object_name': 'EventTag', 'index_together': "(('project_id', 'key', 'value'), ('group_id', 'key', 'value'))"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'value': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagValue']", 'db_column': "'value_id'"})
        },
        'tagstore.grouptagkey': {
            'Meta': {'unique_together': "(('project_id', 'group_id', '_key'),)", 'object_name': 'GroupTagKey'},
            '_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.grouptagvalue': {
            'Meta': {'unique_together': "(('project_id', 'group_id', '_key', '_value'),)", 'object_name': 'GroupTagValue', 'index_together': "(('project_id', '_key', '_value', 'last_seen'),)"},
            '_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            '_value': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagValue']", 'db_column': "'value_id'"}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.tagkey': {
            'Meta': {'unique_together': "(('project_id', 'environment_id', 'key'),)", 'object_name': 'TagKey'},
            'environment_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.tagvalue': {
            'Meta': {'unique_together': "(('project_id', '_key', 'value'),)", 'object_name': 'TagValue', 'index_together': "(('project_id', '_key', 'last_seen'),)"},
            '_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']", 'db_column': "'key_id'"}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        }
    }

    complete_apps = ['tagstore']
