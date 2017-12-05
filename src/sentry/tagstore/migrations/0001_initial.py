# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    # Flag to indicate if this migration is too risky
    # to run online and needs to be coordinated for offline
    is_dangerous = False

    def forwards(self, orm):
        # Adding model 'EventTag'
        db.create_table(u'tagstore_eventtag', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('group_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('event_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('key_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('value_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('date_added', self.gf('django.db.models.fields.DateTimeField')(
                default=datetime.datetime.now, db_index=True)),
        ))
        db.send_create_signal('tagstore', ['EventTag'])

        # Adding unique constraint on 'EventTag', fields ['event_id', 'key_id', 'value_id']
        db.create_unique(u'tagstore_eventtag', ['event_id', 'key_id', 'value_id'])

        # Adding index on 'EventTag', fields ['project_id', 'key_id', 'value_id']
        db.create_index(u'tagstore_eventtag', ['project_id', 'key_id', 'value_id'])

        # Adding index on 'EventTag', fields ['group_id', 'key_id', 'value_id']
        db.create_index(u'tagstore_eventtag', ['group_id', 'key_id', 'value_id'])

        # Adding index on 'EventTag', fields ['environment_id', 'key_id', 'value_id']
        db.create_index(u'tagstore_eventtag', ['environment_id', 'key_id', 'value_id'])

        # Adding model 'GroupTagKey'
        db.create_table(u'tagstore_grouptagkey', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('group_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'])),
        ))
        db.send_create_signal('tagstore', ['GroupTagKey'])

        # Adding unique constraint on 'GroupTagKey', fields ['project_id',
        # 'group_id', 'environment_id', 'key']
        db.create_unique(
            u'tagstore_grouptagkey', [
                'project_id', 'group_id', 'environment_id', 'key_id'])

        # Adding model 'GroupTagValue'
        db.create_table(u'tagstore_grouptagvalue', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('group_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'])),
            ('value', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagValue'])),
            ('last_seen', self.gf('django.db.models.fields.DateTimeField')(
                default=datetime.datetime.now, null=True, db_index=True)),
            ('first_seen', self.gf('django.db.models.fields.DateTimeField')(
                default=datetime.datetime.now, null=True, db_index=True)),
        ))
        db.send_create_signal('tagstore', ['GroupTagValue'])

        # Adding unique constraint on 'GroupTagValue', fields ['project_id',
        # 'group_id', 'environment_id', 'key', 'value']
        db.create_unique(
            u'tagstore_grouptagvalue', [
                'project_id', 'group_id', 'environment_id', 'key_id', 'value_id'])

        # Adding index on 'GroupTagValue', fields ['project_id', 'key', 'value', 'last_seen']
        db.create_index(
            u'tagstore_grouptagvalue', [
                'project_id', 'key_id', 'value_id', 'last_seen'])

        # Adding model 'TagKey'
        db.create_table(u'tagstore_tagkey', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('key', self.gf('django.db.models.fields.CharField')(max_length=32)),
            ('status', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(default=0)),
        ))
        db.send_create_signal('tagstore', ['TagKey'])

        # Adding unique constraint on 'TagKey', fields ['project_id', 'environment_id', 'key']
        db.create_unique(u'tagstore_tagkey', ['project_id', 'environment_id', 'key'])

        # Adding model 'TagValue'
        db.create_table(u'tagstore_tagvalue', (
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'])),
            ('value', self.gf('django.db.models.fields.CharField')(max_length=200)),
            ('data', self.gf('sentry.db.models.fields.gzippeddict.GzippedDictField')(null=True, blank=True)),
            ('last_seen', self.gf('django.db.models.fields.DateTimeField')(
                default=datetime.datetime.now, null=True, db_index=True)),
            ('first_seen', self.gf('django.db.models.fields.DateTimeField')(
                default=datetime.datetime.now, null=True, db_index=True)),
        ))
        db.send_create_signal('tagstore', ['TagValue'])

        # Adding unique constraint on 'TagValue', fields ['project_id',
        # 'environment_id', 'key', 'value']
        db.create_unique(u'tagstore_tagvalue', ['project_id', 'environment_id', 'key_id', 'value'])

        # Adding index on 'TagValue', fields ['project_id', 'key', 'last_seen']
        db.create_index(u'tagstore_tagvalue', ['project_id', 'key_id', 'last_seen'])

    def backwards(self, orm):
        # Removing index on 'TagValue', fields ['project_id', 'key', 'last_seen']
        db.delete_index(u'tagstore_tagvalue', ['project_id', 'key_id', 'last_seen'])

        # Removing unique constraint on 'TagValue', fields ['project_id',
        # 'environment_id', 'key', 'value']
        db.delete_unique(u'tagstore_tagvalue', ['project_id', 'environment_id', 'key_id', 'value'])

        # Removing unique constraint on 'TagKey', fields ['project_id', 'environment_id', 'key']
        db.delete_unique(u'tagstore_tagkey', ['project_id', 'environment_id', 'key'])

        # Removing index on 'GroupTagValue', fields ['project_id', 'key', 'value', 'last_seen']
        db.delete_index(
            u'tagstore_grouptagvalue', [
                'project_id', 'key_id', 'value_id', 'last_seen'])

        # Removing unique constraint on 'GroupTagValue', fields ['project_id',
        # 'group_id', 'environment_id', 'key', 'value']
        db.delete_unique(
            u'tagstore_grouptagvalue', [
                'project_id', 'group_id', 'environment_id', 'key_id', 'value_id'])

        # Removing unique constraint on 'GroupTagKey', fields ['project_id',
        # 'group_id', 'environment_id', 'key']
        db.delete_unique(
            u'tagstore_grouptagkey', [
                'project_id', 'group_id', 'environment_id', 'key_id'])

        # Removing index on 'EventTag', fields ['environment_id', 'key_id', 'value_id']
        db.delete_index(u'tagstore_eventtag', ['environment_id', 'key_id', 'value_id'])

        # Removing index on 'EventTag', fields ['group_id', 'key_id', 'value_id']
        db.delete_index(u'tagstore_eventtag', ['group_id', 'key_id', 'value_id'])

        # Removing index on 'EventTag', fields ['project_id', 'key_id', 'value_id']
        db.delete_index(u'tagstore_eventtag', ['project_id', 'key_id', 'value_id'])

        # Removing unique constraint on 'EventTag', fields ['event_id', 'key_id', 'value_id']
        db.delete_unique(u'tagstore_eventtag', ['event_id', 'key_id', 'value_id'])

        # Deleting model 'EventTag'
        db.delete_table(u'tagstore_eventtag')

        # Deleting model 'GroupTagKey'
        db.delete_table(u'tagstore_grouptagkey')

        # Deleting model 'GroupTagValue'
        db.delete_table(u'tagstore_grouptagvalue')

        # Deleting model 'TagKey'
        db.delete_table(u'tagstore_tagkey')

        # Deleting model 'TagValue'
        db.delete_table(u'tagstore_tagvalue')

    models = {
        'tagstore.eventtag': {
            'Meta': {'unique_together': "(('event_id', 'key_id', 'value_id'),)", 'object_name': 'EventTag', 'index_together': "(('project_id', 'key_id', 'value_id'), ('group_id', 'key_id', 'value_id'), ('environment_id', 'key_id', 'value_id'))"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'event_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'value_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
        },
        'tagstore.grouptagkey': {
            'Meta': {'unique_together': "(('project_id', 'group_id', 'environment_id', 'key'),)", 'object_name': 'GroupTagKey'},
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'})
        },
        'tagstore.grouptagvalue': {
            'Meta': {'unique_together': "(('project_id', 'group_id', 'environment_id', 'key', 'value'),)", 'object_name': 'GroupTagValue', 'index_together': "(('project_id', 'key', 'value', 'last_seen'),)"},
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']"}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'value': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagValue']"})
        },
        'tagstore.tagkey': {
            'Meta': {'unique_together': "(('project_id', 'environment_id', 'key'),)", 'object_name': 'TagKey'},
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'tagstore.tagvalue': {
            'Meta': {'unique_together': "(('project_id', 'environment_id', 'key', 'value'),)", 'object_name': 'TagValue', 'index_together': "(('project_id', 'key', 'last_seen'),)"},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['tagstore.TagKey']"}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        }
    }

    complete_apps = ['tagstore']
