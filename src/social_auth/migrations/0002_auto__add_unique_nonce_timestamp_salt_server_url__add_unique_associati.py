# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

from django.conf import settings
from social_auth.utils import custom_user_frozen_models


USER_MODEL = settings.AUTH_USER_MODEL
UID_LENGTH = getattr(settings, 'SOCIAL_AUTH_UID_LENGTH', 255)
NONCE_SERVER_URL_LENGTH = getattr(settings, 'SOCIAL_AUTH_NONCE_SERVER_URL_LENGTH', 255)
ASSOCIATION_SERVER_URL_LENGTH = getattr(settings, 'SOCIAL_AUTH_ASSOCIATION_SERVER_URL_LENGTH', 255)
ASSOCIATION_HANDLE_LENGTH = getattr(settings, 'SOCIAL_AUTH_ASSOCIATION_HANDLE_LENGTH', 255)


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding index on 'Nonce', fields ['timestamp']
        db.create_index('social_auth_nonce', ['timestamp'])

        # Adding unique constraint on 'Nonce', fields ['timestamp', 'salt', 'server_url']
        db.create_unique('social_auth_nonce', ['timestamp', 'salt', 'server_url'])

        # Adding index on 'Association', fields ['issued']
        db.create_index('social_auth_association', ['issued'])

        # Adding unique constraint on 'Association', fields ['handle', 'server_url']
        db.create_unique('social_auth_association', ['handle', 'server_url'])

    def backwards(self, orm):
        # Removing unique constraint on 'Association', fields ['handle', 'server_url']
        db.delete_unique('social_auth_association', ['handle', 'server_url'])

        # Removing index on 'Association', fields ['issued']
        db.delete_index('social_auth_association', ['issued'])

        # Removing unique constraint on 'Nonce', fields ['timestamp', 'salt', 'server_url']
        db.delete_unique('social_auth_nonce', ['timestamp', 'salt', 'server_url'])

        # Removing index on 'Nonce', fields ['timestamp']
        db.delete_index('social_auth_nonce', ['timestamp'])


    models = {
        'auth.group': {
            'Meta': {'object_name': 'Group'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '80'}),
            'permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'})
        },
        'auth.permission': {
            'Meta': {'ordering': "('content_type__app_label', 'content_type__model', 'codename')", 'unique_together': "(('content_type', 'codename'),)", 'object_name': 'Permission'},
            'codename': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'content_type': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['contenttypes.ContentType']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'})
        },
        'auth.user': {
            'Meta': {'object_name': 'User'},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'first_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['auth.Group']", 'symmetrical': 'False', 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'user_permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '30'})
        },
        'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        'social_auth.association': {
            'Meta': {'unique_together': "(('server_url', 'handle'),)", 'object_name': 'Association'},
            'assoc_type': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'handle': ('django.db.models.fields.CharField', [], {'max_length': str(ASSOCIATION_HANDLE_LENGTH)}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'issued': ('django.db.models.fields.IntegerField', [], {'db_index': 'True'}),
            'lifetime': ('django.db.models.fields.IntegerField', [], {}),
            'secret': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'server_url': ('django.db.models.fields.CharField', [], {'max_length': str(ASSOCIATION_SERVER_URL_LENGTH)})
        },
        'social_auth.nonce': {
            'Meta': {'unique_together': "(('server_url', 'timestamp', 'salt'),)", 'object_name': 'Nonce'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'salt': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'server_url': ('django.db.models.fields.CharField', [], {'max_length': str(NONCE_SERVER_URL_LENGTH)}),
            'timestamp': ('django.db.models.fields.IntegerField', [], {'db_index': 'True'})
        },
        'social_auth.usersocialauth': {
            'Meta': {'unique_together': "(('provider', 'uid'),)", 'object_name': 'UserSocialAuth'},
            'extra_data': ('social_auth.fields.JSONField', [], {'default': "'{}'"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'provider': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'uid': ('django.db.models.fields.CharField', [], {'max_length': str(UID_LENGTH)}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'social_auth'", 'to': "orm['" + USER_MODEL + "']"})
        }
    }
    models.update(custom_user_frozen_models(USER_MODEL))

    complete_apps = ['social_auth']
