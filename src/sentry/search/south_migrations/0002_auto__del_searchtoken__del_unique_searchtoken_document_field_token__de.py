# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Removing unique constraint on 'SearchDocument', fields ['project', 'group']
        db.delete_unique('sentry_searchdocument', ['project_id', 'group_id'])

        # Removing unique constraint on 'SearchToken', fields ['document', 'field', 'token']
        db.delete_unique('sentry_searchtoken', ['document_id', 'field', 'token'])

        # Deleting model 'SearchToken'
        db.delete_table('sentry_searchtoken')

        # Deleting model 'SearchDocument'
        db.delete_table('sentry_searchdocument')


    def backwards(self, orm):
        # Adding model 'SearchToken'
        db.create_table('sentry_searchtoken', (
            ('times_seen', self.gf('django.db.models.fields.PositiveIntegerField')(default=1)),
            ('field', self.gf('django.db.models.fields.CharField')(default='text', max_length=64)),
            ('token', self.gf('django.db.models.fields.CharField')(max_length=128)),
            ('document', self.gf('sentry.db.models.fields.FlexibleForeignKey')(related_name='token_set', to=orm['search.SearchDocument'])),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
        ))
        db.send_create_signal(u'search', ['SearchToken'])

        # Adding unique constraint on 'SearchToken', fields ['document', 'field', 'token']
        db.create_unique('sentry_searchtoken', ['document_id', 'field', 'token'])

        # Adding model 'SearchDocument'
        db.create_table('sentry_searchdocument', (
            ('project', self.gf('sentry.db.models.fields.FlexibleForeignKey')(to=orm['sentry.Project'])),
            ('status', self.gf('django.db.models.fields.PositiveIntegerField')(default=0)),
            ('total_events', self.gf('django.db.models.fields.PositiveIntegerField')(default=1)),
            ('group', self.gf('sentry.db.models.fields.FlexibleForeignKey')(to=orm['sentry.Group'])),
            ('date_changed', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now)),
            ('date_added', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now)),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
        ))
        db.send_create_signal(u'search', ['SearchDocument'])

        # Adding unique constraint on 'SearchDocument', fields ['project', 'group']
        db.create_unique('sentry_searchdocument', ['project_id', 'group_id'])


    models = {
        
    }

    complete_apps = ['search']