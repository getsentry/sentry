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
        # Removing unique constraint on 'GroupTagValue', fields ['project_id',
        # 'group_id', 'environment_id', '_key', '_value']
        db.delete_unique(
            u'tagstore_grouptagvalue', [
                'project_id', 'group_id', 'environment_id', 'key', 'value'])

        # Removing unique constraint on 'EventTag', fields ['event_id', 'key', 'value']
        db.delete_unique(u'tagstore_eventtag', ['event_id', 'key', 'value'])

        # Removing unique constraint on 'GroupTagKey', fields ['project_id',
        # 'group_id', 'environment_id', '_key']
        db.delete_unique(
            u'tagstore_grouptagkey', [
                'project_id', 'group_id', 'environment_id', 'key'])

        # Removing unique constraint on 'TagValue', fields ['project_id',
        # 'environment_id', '_key', 'value']
        db.delete_unique(u'tagstore_tagvalue', ['project_id', 'environment_id', 'key', 'value'])

        # Removing unique constraint on 'TagKey', fields ['project_id', 'environment_id', 'key']
        db.delete_unique(u'tagstore_tagkey', ['project_id', 'environment_id', 'key'])

        # Deleting model 'TagKey'
        db.delete_table(u'tagstore_tagkey')

        # Deleting model 'TagValue'
        db.delete_table(u'tagstore_tagvalue')

        # Deleting model 'GroupTagKey'
        db.delete_table(u'tagstore_grouptagkey')

        # Deleting model 'EventTag'
        db.delete_table(u'tagstore_eventtag')

        # Deleting model 'GroupTagValue'
        db.delete_table(u'tagstore_grouptagvalue')

    def backwards(self, orm):
        # Adding model 'TagKey'
        db.create_table(u'tagstore_tagkey', (
            ('status', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(default=0)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('values_seen', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(default=0)),
            ('key', self.gf('django.db.models.fields.CharField')(max_length=32)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
        ))
        db.send_create_signal('tagstore', ['TagKey'])

        # Adding unique constraint on 'TagKey', fields ['project_id', 'environment_id', 'key']
        db.create_unique(u'tagstore_tagkey', ['project_id', 'environment_id', 'key'])

        # Adding model 'TagValue'
        db.create_table(u'tagstore_tagvalue', (
            ('times_seen', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(default=0)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('_key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'], db_column='key')),
            ('first_seen', self.gf('django.db.models.fields.DateTimeField')(
                null=True, db_index=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('data', self.gf('sentry.db.models.fields.gzippeddict.GzippedDictField')(null=True, blank=True)),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('value', self.gf('django.db.models.fields.CharField')(max_length=200)),
            ('last_seen', self.gf('django.db.models.fields.DateTimeField')(
                null=True, db_index=True)),
        ))
        db.send_create_signal('tagstore', ['TagValue'])

        # Adding unique constraint on 'TagValue', fields ['project_id',
        # 'environment_id', '_key', 'value']
        db.create_unique(u'tagstore_tagvalue', ['project_id', 'environment_id', 'key', 'value'])

        # Adding model 'GroupTagKey'
        db.create_table(u'tagstore_grouptagkey', (
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('values_seen', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(default=0)),
            ('_key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'], db_column='key')),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('group_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
        ))
        db.send_create_signal('tagstore', ['GroupTagKey'])

        # Adding unique constraint on 'GroupTagKey', fields ['project_id',
        # 'group_id', 'environment_id', '_key']
        db.create_unique(
            u'tagstore_grouptagkey', [
                'project_id', 'group_id', 'environment_id', 'key'])

        # Adding model 'EventTag'
        db.create_table(u'tagstore_eventtag', (
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'], db_column='key')),
            ('event_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('date_added', self.gf('django.db.models.fields.DateTimeField')(
                db_index=True)),
            ('group_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('value', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagValue'], db_column='value')),
        ))
        db.send_create_signal('tagstore', ['EventTag'])

        # Adding unique constraint on 'EventTag', fields ['event_id', 'key', 'value']
        db.create_unique(u'tagstore_eventtag', ['event_id', 'key', 'value'])

        # Adding model 'GroupTagValue'
        db.create_table(u'tagstore_grouptagvalue', (
            ('_value', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagValue'], db_column='value')),
            ('project_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('environment_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(null=True)),
            ('times_seen', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(default=0)),
            ('_key', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['tagstore.TagKey'], db_column='key')),
            ('first_seen', self.gf('django.db.models.fields.DateTimeField')(
                null=True, db_index=True)),
            ('group_id', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')(db_index=True)),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
            ('last_seen', self.gf('django.db.models.fields.DateTimeField')(
                null=True, db_index=True)),
        ))
        db.send_create_signal('tagstore', ['GroupTagValue'])

        # Adding unique constraint on 'GroupTagValue', fields ['project_id',
        # 'group_id', 'environment_id', '_key', '_value']
        db.create_unique(
            u'tagstore_grouptagvalue', [
                'project_id', 'group_id', 'environment_id', 'key', 'value'])

        # Adding index on 'GroupTagValue', fields ['project_id', '_key', '_value', 'last_seen']
        db.create_index(u'tagstore_grouptagvalue', ['project_id', 'key', 'value', 'last_seen'])

        # Adding index on 'EventTag', fields ['environment_id', 'key', 'value']
        db.create_index(u'tagstore_eventtag', ['environment_id', 'key', 'value'])

        # Adding index on 'EventTag', fields ['group_id', 'key', 'value']
        db.create_index(u'tagstore_eventtag', ['group_id', 'key', 'value'])

        # Adding index on 'EventTag', fields ['project_id', 'key', 'value']
        db.create_index(u'tagstore_eventtag', ['project_id', 'key', 'value'])

        # Adding index on 'TagValue', fields ['project_id', '_key', 'last_seen']
        db.create_index(u'tagstore_tagvalue', ['project_id', 'key', 'last_seen'])

    models = {

    }

    complete_apps = ['tagstore']
