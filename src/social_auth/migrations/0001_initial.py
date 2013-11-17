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
        # Adding model 'UserSocialAuth'
        db.create_table('social_auth_usersocialauth', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('user', self.gf('django.db.models.fields.related.ForeignKey')(related_name='social_auth', to=orm[USER_MODEL])),
            ('provider', self.gf('django.db.models.fields.CharField')(max_length=32)),
            ('uid', self.gf('django.db.models.fields.CharField')(max_length=UID_LENGTH)),
            ('extra_data', self.gf('social_auth.fields.JSONField')(default='{}')),
        ))
        db.send_create_signal('social_auth', ['UserSocialAuth'])

        # Adding unique constraint on 'UserSocialAuth', fields ['provider', 'uid']
        db.create_unique('social_auth_usersocialauth', ['provider', 'uid'])

        # Adding model 'Nonce'
        db.create_table('social_auth_nonce', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('server_url', self.gf('django.db.models.fields.CharField')(max_length=NONCE_SERVER_URL_LENGTH)),
            ('timestamp', self.gf('django.db.models.fields.IntegerField')()),
            ('salt', self.gf('django.db.models.fields.CharField')(max_length=40)),
        ))
        db.send_create_signal('social_auth', ['Nonce'])

        # Adding model 'Association'
        db.create_table('social_auth_association', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('server_url', self.gf('django.db.models.fields.CharField')(max_length=ASSOCIATION_SERVER_URL_LENGTH)),
            ('handle', self.gf('django.db.models.fields.CharField')(max_length=ASSOCIATION_HANDLE_LENGTH)),
            ('secret', self.gf('django.db.models.fields.CharField')(max_length=255)),
            ('issued', self.gf('django.db.models.fields.IntegerField')()),
            ('lifetime', self.gf('django.db.models.fields.IntegerField')()),
            ('assoc_type', self.gf('django.db.models.fields.CharField')(max_length=64)),
        ))
        db.send_create_signal('social_auth', ['Association'])


    def backwards(self, orm):
        # Removing unique constraint on 'UserSocialAuth', fields ['provider', 'uid']
        db.delete_unique('social_auth_usersocialauth', ['provider', 'uid'])

        # Deleting model 'UserSocialAuth'
        db.delete_table('social_auth_usersocialauth')

        # Deleting model 'Nonce'
        db.delete_table('social_auth_nonce')

        # Deleting model 'Association'
        db.delete_table('social_auth_association')


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
            'Meta': {'object_name': 'Association'},
            'assoc_type': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'handle': ('django.db.models.fields.CharField', [], {'max_length': str(ASSOCIATION_HANDLE_LENGTH)}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'issued': ('django.db.models.fields.IntegerField', [], {}),
            'lifetime': ('django.db.models.fields.IntegerField', [], {}),
            'secret': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'server_url': ('django.db.models.fields.CharField', [], {'max_length': str(ASSOCIATION_SERVER_URL_LENGTH)})
        },
        'social_auth.nonce': {
            'Meta': {'object_name': 'Nonce'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'salt': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'server_url': ('django.db.models.fields.CharField', [], {'max_length': str(NONCE_SERVER_URL_LENGTH)}),
            'timestamp': ('django.db.models.fields.IntegerField', [], {})
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
