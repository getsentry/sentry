# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Removing unique constraint on 'UserSocialAuth', fields ['provider', 'uid']
        db.delete_unique(u'social_auth_usersocialauth', ['provider', 'uid'])

        # Adding unique constraint on 'UserSocialAuth', fields ['provider', 'uid', 'user']
        db.create_unique(u'social_auth_usersocialauth', ['provider', 'uid', 'user_id'])


    def backwards(self, orm):
        # Removing unique constraint on 'UserSocialAuth', fields ['provider', 'uid', 'user']
        db.delete_unique(u'social_auth_usersocialauth', ['provider', 'uid', 'user_id'])

        # Adding unique constraint on 'UserSocialAuth', fields ['provider', 'uid']
        db.create_unique(u'social_auth_usersocialauth', ['provider', 'uid'])


    models = {
        'sentry.user': {
            'Meta': {'object_name': 'User', 'db_table': "'auth_user'"},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_managed': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_password_expired': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_password_change': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200', 'db_column': "'first_name'", 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '128'})
        },
        'social_auth.usersocialauth': {
            'Meta': {'unique_together': "(('provider', 'uid', 'user'),)", 'object_name': 'UserSocialAuth'},
            'extra_data': ('social_auth.fields.JSONField', [], {'default': "'{}'"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'provider': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'uid': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'social_auth'", 'to': "orm['sentry.User']"})
        }
    }

    complete_apps = ['social_auth']