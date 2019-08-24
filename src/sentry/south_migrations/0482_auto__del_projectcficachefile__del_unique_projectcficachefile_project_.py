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
        # Removing unique constraint on 'ProjectSymCacheFile', fields ['project', 'debug_file']
        db.delete_unique(u'sentry_projectsymcachefile', [u'project_id', 'dsym_file_id'])

        # Removing unique constraint on 'ProjectCfiCacheFile', fields ['project', 'debug_file']
        db.delete_unique(u'sentry_projectcficachefile', [u'project_id', 'dsym_file_id'])

        # Deleting model 'ProjectCfiCacheFile'
        db.delete_table(u'sentry_projectcficachefile')

        # Deleting model 'ProjectSymCacheFile'
        db.delete_table(u'sentry_projectsymcachefile')

    def backwards(self, orm):
        # Adding model 'ProjectCfiCacheFile'
        db.create_table(u'sentry_projectcficachefile', (
            ('project', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['sentry.Project'], null=True)),
            ('version', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('checksum', self.gf('django.db.models.fields.CharField')(max_length=40)),
            ('debug_file', self.gf('sentry.db.models.fields.bounded.BoundedBigIntegerField')(
                db_column='dsym_file_id', db_index=True)),
            ('cache_file', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['sentry.File'])),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
        ))
        db.send_create_signal('sentry', ['ProjectCfiCacheFile'])

        # Adding unique constraint on 'ProjectCfiCacheFile', fields ['project', 'debug_file']
        db.create_unique(u'sentry_projectcficachefile', [u'project_id', 'dsym_file_id'])

        # Adding model 'ProjectSymCacheFile'
        db.create_table(u'sentry_projectsymcachefile', (
            ('project', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['sentry.Project'], null=True)),
            ('version', self.gf('sentry.db.models.fields.bounded.BoundedPositiveIntegerField')()),
            ('checksum', self.gf('django.db.models.fields.CharField')(max_length=40)),
            ('debug_file', self.gf('sentry.db.models.fields.bounded.BoundedBigIntegerField')(
                db_column='dsym_file_id', db_index=True)),
            ('cache_file', self.gf('sentry.db.models.fields.foreignkey.FlexibleForeignKey')(
                to=orm['sentry.File'])),
            ('id', self.gf('sentry.db.models.fields.bounded.BoundedBigAutoField')(primary_key=True)),
        ))
        db.send_create_signal('sentry', ['ProjectSymCacheFile'])

        # Adding unique constraint on 'ProjectSymCacheFile', fields ['project', 'debug_file']
        db.create_unique(u'sentry_projectsymcachefile', [u'project_id', 'dsym_file_id'])

    models = {
        'sentry.activity': {
            'Meta': {'unique_together': '()', 'object_name': 'Activity', 'index_together': '()'},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'})
        },
        'sentry.apiapplication': {
            'Meta': {'unique_together': '()', 'object_name': 'ApiApplication', 'index_together': '()'},
            'allowed_origins': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'client_id': ('django.db.models.fields.CharField', [], {'default': "'e141a2c5ffe24c6580d9e880c8376c01166847c91aaa464bb0effce9342b7977'", 'unique': 'True', 'max_length': '64'}),
            'client_secret': ('sentry.db.models.fields.encrypted.EncryptedTextField', [], {'default': "'f6bfb61f5e2f432fa9bd23da19083b53d9a699ce49764a6faeb55944dbe2c9bc'"}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'homepage_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'default': "'Major Swan'", 'max_length': '64', 'blank': 'True'}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'privacy_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'}),
            'redirect_uris': ('django.db.models.fields.TextField', [], {}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'terms_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'})
        },
        'sentry.apiauthorization': {
            'Meta': {'unique_together': "(('user', 'application'),)", 'object_name': 'ApiAuthorization', 'index_together': '()'},
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.apigrant': {
            'Meta': {'unique_together': '()', 'object_name': 'ApiGrant', 'index_together': '()'},
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']"}),
            'code': ('django.db.models.fields.CharField', [], {'default': "'14ffe625ceae4831835218a62433368f'", 'max_length': '64', 'db_index': 'True'}),
            'expires_at': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2019, 5, 20, 0, 0)', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'redirect_uri': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.apikey': {
            'Meta': {'unique_together': '()', 'object_name': 'ApiKey', 'index_together': '()'},
            'allowed_origins': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32'}),
            'label': ('django.db.models.fields.CharField', [], {'default': "'Default'", 'max_length': '64', 'blank': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'key_set'", 'to': "orm['sentry.Organization']"}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.apitoken': {
            'Meta': {'unique_together': '()', 'object_name': 'ApiToken', 'index_together': '()'},
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'expires_at': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2019, 6, 19, 0, 0)', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'refresh_token': ('django.db.models.fields.CharField', [], {'default': "'6e9593a778ec4c9784f63f78f4150f6a80ef36d95da141b1b42a917449b17f75'", 'max_length': '64', 'unique': 'True', 'null': 'True'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'token': ('django.db.models.fields.CharField', [], {'default': "'ad25dc4ca31d4617b0d72531d02abbf8b1d26effede34c2aaa807808f46efc2f'", 'unique': 'True', 'max_length': '64'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.assistantactivity': {
            'Meta': {'unique_together': "(('user', 'guide_id'),)", 'object_name': 'AssistantActivity', 'db_table': "'sentry_assistant_activity'", 'index_together': '()'},
            'dismissed_ts': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'guide_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'useful': ('django.db.models.fields.NullBooleanField', [], {'null': 'True', 'blank': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'viewed_ts': ('django.db.models.fields.DateTimeField', [], {'null': 'True'})
        },
        'sentry.auditlogentry': {
            'Meta': {'unique_together': '()', 'object_name': 'AuditLogEntry', 'index_together': '()'},
            'actor': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "u'audit_actors'", 'null': 'True', 'to': "orm['sentry.User']"}),
            'actor_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiKey']", 'null': 'True', 'blank': 'True'}),
            'actor_label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'target_object': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'target_user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "u'audit_targets'", 'null': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.authenticator': {
            'Meta': {'unique_together': "(('user', 'type'),)", 'object_name': 'Authenticator', 'db_table': "'auth_authenticator'", 'index_together': '()'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {}),
            'created_at': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedAutoField', [], {'primary_key': 'True'}),
            'last_used_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.authidentity': {
            'Meta': {'unique_together': "(('auth_provider', 'ident'), ('auth_provider', 'user'))", 'object_name': 'AuthIdentity', 'index_together': '()'},
            'auth_provider': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.AuthProvider']"}),
            'data': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'last_synced': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_verified': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.authprovider': {
            'Meta': {'unique_together': '()', 'object_name': 'AuthProvider', 'index_together': '()'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'default_global_access': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'default_role': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '50'}),
            'default_teams': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Team']", 'symmetrical': 'False', 'blank': 'True'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '0'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_sync': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']", 'unique': 'True'}),
            'provider': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'sync_time': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.broadcast': {
            'Meta': {'unique_together': '()', 'object_name': 'Broadcast', 'index_together': '()'},
            'cta': ('django.db.models.fields.CharField', [], {'max_length': '256', 'null': 'True', 'blank': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_expires': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2019, 5, 27, 0, 0)', 'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True', 'db_index': 'True'}),
            'link': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.CharField', [], {'max_length': '256'}),
            'title': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'upstream_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'blank': 'True'})
        },
        'sentry.broadcastseen': {
            'Meta': {'unique_together': "(('broadcast', 'user'),)", 'object_name': 'BroadcastSeen', 'index_together': '()'},
            'broadcast': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Broadcast']"}),
            'date_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.commit': {
            'Meta': {'unique_together': "(('repository_id', 'key'),)", 'object_name': 'Commit', 'index_together': "(('repository_id', 'date_added'),)"},
            'author': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.CommitAuthor']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'message': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'repository_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
        },
        'sentry.commitauthor': {
            'Meta': {'unique_together': "(('organization_id', 'email'), ('organization_id', 'external_id'))", 'object_name': 'CommitAuthor', 'index_together': '()'},
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '164', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'})
        },
        'sentry.commitfilechange': {
            'Meta': {'unique_together': "(('commit', 'filename'),)", 'object_name': 'CommitFileChange', 'index_together': '()'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'filename': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '1'})
        },
        'sentry.counter': {
            'Meta': {'unique_together': '()', 'object_name': 'Counter', 'db_table': "'sentry_projectcounter'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'unique': 'True'}),
            'value': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.dashboard': {
            'Meta': {'unique_together': "(('organization', 'title'),)", 'object_name': 'Dashboard', 'index_together': '()'},
            'created_by': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'title': ('django.db.models.fields.CharField', [], {'max_length': '255'})
        },
        'sentry.deletedorganization': {
            'Meta': {'unique_together': '()', 'object_name': 'DeletedOrganization', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'actor_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'actor_label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'date_created': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'date_deleted': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'reason': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'slug': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True'})
        },
        'sentry.deletedproject': {
            'Meta': {'unique_together': '()', 'object_name': 'DeletedProject', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'actor_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'actor_label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'date_created': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'date_deleted': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'organization_name': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'organization_slug': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'reason': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'slug': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True'})
        },
        'sentry.deletedteam': {
            'Meta': {'unique_together': '()', 'object_name': 'DeletedTeam', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'actor_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'actor_label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'date_created': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'date_deleted': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'organization_name': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'organization_slug': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True'}),
            'reason': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'slug': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True'})
        },
        'sentry.deploy': {
            'Meta': {'unique_together': '()', 'object_name': 'Deploy', 'index_together': '()'},
            'date_finished': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'notified': ('django.db.models.fields.NullBooleanField', [], {'default': 'False', 'null': 'True', 'db_index': 'True', 'blank': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'sentry.discoversavedquery': {
            'Meta': {'unique_together': '()', 'object_name': 'DiscoverSavedQuery', 'index_together': '()'},
            'created_by': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'date_created': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'date_updated': ('django.db.models.fields.DateTimeField', [], {'auto_now': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Project']", 'through': "orm['sentry.DiscoverSavedQueryProject']", 'symmetrical': 'False'}),
            'query': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'})
        },
        'sentry.discoversavedqueryproject': {
            'Meta': {'unique_together': "(('project', 'discover_saved_query'),)", 'object_name': 'DiscoverSavedQueryProject', 'index_together': '()'},
            'discover_saved_query': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.DiscoverSavedQuery']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.distribution': {
            'Meta': {'unique_together': "(('release', 'name'),)", 'object_name': 'Distribution', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.email': {
            'Meta': {'unique_together': '()', 'object_name': 'Email', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('sentry.db.models.fields.citext.CIEmailField', [], {'unique': 'True', 'max_length': '75'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'})
        },
        'sentry.environment': {
            'Meta': {'unique_together': "(('organization_id', 'name'),)", 'object_name': 'Environment', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Project']", 'through': "orm['sentry.EnvironmentProject']", 'symmetrical': 'False'})
        },
        'sentry.environmentproject': {
            'Meta': {'unique_together': "(('project', 'environment'),)", 'object_name': 'EnvironmentProject', 'index_together': '()'},
            'environment': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Environment']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_hidden': ('django.db.models.fields.NullBooleanField', [], {'null': 'True', 'blank': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.event': {
            'Meta': {'unique_together': "(('project_id', 'event_id'),)", 'object_name': 'Event', 'db_table': "'sentry_message'", 'index_together': "(('group_id', 'datetime'),)"},
            'data': ('sentry.db.models.fields.node.NodeField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'db_column': "'message_id'"}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True', 'blank': 'True'}),
            'time_spent': ('sentry.db.models.fields.bounded.BoundedIntegerField', [], {'null': 'True'})
        },
        'sentry.eventattachment': {
            'Meta': {'unique_together': "(('project_id', 'event_id', 'file'),)", 'object_name': 'EventAttachment', 'index_together': "(('project_id', 'date_added'),)"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.TextField', [], {}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.eventmapping': {
            'Meta': {'unique_together': "(('project_id', 'event_id'),)", 'object_name': 'EventMapping', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.eventprocessingissue': {
            'Meta': {'unique_together': "(('raw_event', 'processing_issue'),)", 'object_name': 'EventProcessingIssue', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'processing_issue': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ProcessingIssue']"}),
            'raw_event': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.RawEvent']"})
        },
        'sentry.eventtag': {
            'Meta': {'unique_together': "(('event_id', 'key_id', 'value_id'),)", 'object_name': 'EventTag', 'index_together': "(('group_id', 'key_id', 'value_id'),)"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'value_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.eventuser': {
            'Meta': {'unique_together': "(('project_id', 'ident'), ('project_id', 'hash'))", 'object_name': 'EventUser', 'index_together': "(('project_id', 'email'), ('project_id', 'username'), ('project_id', 'ip_address'))"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'null': 'True'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'username': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'})
        },
        'sentry.externalissue': {
            'Meta': {'unique_together': "(('organization_id', 'integration_id', 'key'),)", 'object_name': 'ExternalIssue', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'description': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'integration_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'metadata': ('sentry.db.models.fields.jsonfield.JSONField', [], {'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'title': ('django.db.models.fields.TextField', [], {'null': 'True'})
        },
        'sentry.featureadoption': {
            'Meta': {'unique_together': "(('organization', 'feature_id'),)", 'object_name': 'FeatureAdoption', 'index_together': '()'},
            'applicable': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'complete': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_completed': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'feature_id': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"})
        },
        'sentry.file': {
            'Meta': {'unique_together': '()', 'object_name': 'File', 'index_together': '()'},
            'blob': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'legacy_blob'", 'null': 'True', 'to': "orm['sentry.FileBlob']"}),
            'blobs': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.FileBlob']", 'through': "orm['sentry.FileBlobIndex']", 'symmetrical': 'False'}),
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '40', 'null': 'True', 'db_index': 'True'}),
            'headers': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.TextField', [], {}),
            'path': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'size': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'timestamp': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.fileblob': {
            'Meta': {'unique_together': '()', 'object_name': 'FileBlob', 'index_together': '()'},
            'checksum': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '40'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'path': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'size': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'timestamp': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'})
        },
        'sentry.fileblobindex': {
            'Meta': {'unique_together': "(('file', 'blob', 'offset'),)", 'object_name': 'FileBlobIndex', 'index_together': '()'},
            'blob': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.FileBlob']"}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'offset': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
        },
        'sentry.fileblobowner': {
            'Meta': {'unique_together': "(('blob', 'organization'),)", 'object_name': 'FileBlobOwner', 'index_together': '()'},
            'blob': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.FileBlob']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"})
        },
        'sentry.group': {
            'Meta': {'unique_together': "(('project', 'short_id'),)", 'object_name': 'Group', 'db_table': "'sentry_groupedmessage'", 'index_together': "(('project', 'first_release'),)"},
            'active_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'db_index': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'db_column': "'view'", 'blank': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'first_release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']", 'null': 'True', 'on_delete': 'models.PROTECT'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_public': ('django.db.models.fields.NullBooleanField', [], {'default': 'False', 'null': 'True', 'blank': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "''", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'num_comments': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'resolved_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'db_index': 'True'}),
            'score': ('sentry.db.models.fields.bounded.BoundedIntegerField', [], {'default': '0'}),
            'short_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'time_spent_count': ('sentry.db.models.fields.bounded.BoundedIntegerField', [], {'default': '0'}),
            'time_spent_total': ('sentry.db.models.fields.bounded.BoundedIntegerField', [], {'default': '0'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '1', 'db_index': 'True'})
        },
        'sentry.groupassignee': {
            'Meta': {'unique_together': '()', 'object_name': 'GroupAssignee', 'db_table': "'sentry_groupasignee'", 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'assignee_set'", 'unique': 'True', 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'assignee_set'", 'to': "orm['sentry.Project']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'sentry_assignee_set'", 'null': 'True', 'to': "orm['sentry.Team']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'sentry_assignee_set'", 'null': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.groupbookmark': {
            'Meta': {'unique_together': "(('project', 'user', 'group'),)", 'object_name': 'GroupBookmark', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'bookmark_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'bookmark_set'", 'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'sentry_bookmark_set'", 'to': "orm['sentry.User']"})
        },
        'sentry.groupcommitresolution': {
            'Meta': {'unique_together': "(('group_id', 'commit_id'),)", 'object_name': 'GroupCommitResolution', 'index_together': '()'},
            'commit_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'})
        },
        'sentry.groupemailthread': {
            'Meta': {'unique_together': "(('email', 'group'), ('email', 'msgid'))", 'object_name': 'GroupEmailThread', 'index_together': '()'},
            'date': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'groupemail_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'msgid': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'groupemail_set'", 'to': "orm['sentry.Project']"})
        },
        'sentry.groupenvironment': {
            'Meta': {'unique_together': "(('group', 'environment'),)", 'object_name': 'GroupEnvironment', 'index_together': "(('environment', 'first_release'),)"},
            'environment': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Environment']"}),
            'first_release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']", 'null': 'True', 'on_delete': 'models.DO_NOTHING'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'})
        },
        'sentry.grouphash': {
            'Meta': {'unique_together': "(('project', 'hash'),)", 'object_name': 'GroupHash', 'index_together': '()'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'group_tombstone_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'state': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.grouplink': {
            'Meta': {'unique_together': "(('group_id', 'linked_type', 'linked_id'),)", 'object_name': 'GroupLink', 'index_together': '()'},
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'linked_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'linked_type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '1'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'relationship': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '2'})
        },
        'sentry.groupmeta': {
            'Meta': {'unique_together': "(('group', 'key'),)", 'object_name': 'GroupMeta', 'index_together': '()'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'value': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.groupredirect': {
            'Meta': {'unique_together': '()', 'object_name': 'GroupRedirect', 'index_together': '()'},
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'previous_group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'unique': 'True'})
        },
        'sentry.grouprelease': {
            'Meta': {'unique_together': "(('group_id', 'release_id', 'environment'),)", 'object_name': 'GroupRelease', 'index_together': '()'},
            'environment': ('django.db.models.fields.CharField', [], {'default': "''", 'max_length': '64'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'})
        },
        'sentry.groupresolution': {
            'Meta': {'unique_together': '()', 'object_name': 'GroupResolution', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.grouprulestatus': {
            'Meta': {'unique_together': "(('rule', 'group'),)", 'object_name': 'GroupRuleStatus', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_active': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'rule': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Rule']"}),
            'status': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'})
        },
        'sentry.groupseen': {
            'Meta': {'unique_together': "(('user', 'group'),)", 'object_name': 'GroupSeen', 'index_together': '()'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'db_index': 'False'})
        },
        'sentry.groupshare': {
            'Meta': {'unique_together': '()', 'object_name': 'GroupShare', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'694d2ad06ddc452b82239bca2108fbf3'", 'unique': 'True', 'max_length': '32'})
        },
        'sentry.groupsnooze': {
            'Meta': {'unique_together': '()', 'object_name': 'GroupSnooze', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'state': ('sentry.db.models.fields.jsonfield.JSONField', [], {'null': 'True'}),
            'until': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'user_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'user_window': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'window': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.groupsubscription': {
            'Meta': {'unique_together': "(('group', 'user'),)", 'object_name': 'GroupSubscription', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'subscription_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'subscription_set'", 'to': "orm['sentry.Project']"}),
            'reason': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.grouptagkey': {
            'Meta': {'unique_together': "(('project_id', 'group_id', 'key'),)", 'object_name': 'GroupTagKey', 'index_together': '()'},
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.grouptagvalue': {
            'Meta': {'unique_together': "(('group_id', 'key', 'value'),)", 'object_name': 'GroupTagValue', 'db_table': "'sentry_messagefiltervalue'", 'index_together': "(('project_id', 'key', 'value', 'last_seen'),)"},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.grouptombstone': {
            'Meta': {'unique_together': '()', 'object_name': 'GroupTombstone', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'level': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '40', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'previous_group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'unique': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.identity': {
            'Meta': {'unique_together': "(('idp', 'external_id'), ('idp', 'user'))", 'object_name': 'Identity', 'index_together': '()'},
            'data': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_verified': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'idp': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.IdentityProvider']"}),
            'scopes': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.identityprovider': {
            'Meta': {'unique_together': "(('type', 'external_id'),)", 'object_name': 'IdentityProvider', 'index_together': '()'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.incident': {
            'Meta': {'unique_together': "(('organization', 'identifier'),)", 'object_name': 'Incident', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_closed': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'date_detected': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'detection_uuid': ('sentry.db.models.fields.uuid.UUIDField', [], {'max_length': '32', 'null': 'True', 'db_index': 'True'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'incidents'", 'symmetrical': 'False', 'through': "orm['sentry.IncidentGroup']", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'identifier': ('django.db.models.fields.IntegerField', [], {}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'incidents'", 'symmetrical': 'False', 'through': "orm['sentry.IncidentProject']", 'to': "orm['sentry.Project']"}),
            'query': ('django.db.models.fields.TextField', [], {}),
            'status': ('django.db.models.fields.PositiveSmallIntegerField', [], {}),
            'title': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.incidentactivity': {
            'Meta': {'unique_together': '()', 'object_name': 'IncidentActivity', 'index_together': '()'},
            'comment': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_stats_snapshot': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.TimeSeriesSnapshot']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'incident': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Incident']"}),
            'previous_value': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'type': ('django.db.models.fields.IntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'}),
            'value': ('django.db.models.fields.TextField', [], {'null': 'True'})
        },
        'sentry.incidentgroup': {
            'Meta': {'unique_together': "(('group', 'incident'),)", 'object_name': 'IncidentGroup', 'index_together': '()'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'db_index': 'False'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'incident': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Incident']"})
        },
        'sentry.incidentproject': {
            'Meta': {'unique_together': "(('project', 'incident'),)", 'object_name': 'IncidentProject', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'incident': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Incident']"}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'db_index': 'False'})
        },
        'sentry.incidentseen': {
            'Meta': {'unique_together': "(('user', 'incident'),)", 'object_name': 'IncidentSeen', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'incident': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Incident']"}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'db_index': 'False'})
        },
        'sentry.integration': {
            'Meta': {'unique_together': "(('provider', 'external_id'),)", 'object_name': 'Integration', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'metadata': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'organizations': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'integrations'", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationIntegration']", 'to': "orm['sentry.Organization']"}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'integrations'", 'symmetrical': 'False', 'through': "orm['sentry.ProjectIntegration']", 'to': "orm['sentry.Project']"}),
            'provider': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'})
        },
        'sentry.integrationexternalproject': {
            'Meta': {'unique_together': "(('organization_integration_id', 'external_id'),)", 'object_name': 'IntegrationExternalProject', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'organization_integration_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'resolved_status': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'unresolved_status': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.latestrelease': {
            'Meta': {'unique_together': "(('repository_id', 'environment_id'),)", 'object_name': 'LatestRelease', 'index_together': '()'},
            'commit_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'deploy_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'release_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'repository_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.lostpasswordhash': {
            'Meta': {'unique_together': '()', 'object_name': 'LostPasswordHash', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'unique': 'True'})
        },
        'sentry.monitor': {
            'Meta': {'unique_together': '()', 'object_name': 'Monitor', 'index_together': "(('type', 'next_checkin'),)"},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'guid': ('sentry.db.models.fields.uuid.UUIDField', [], {'auto_add': "'uuid:uuid4'", 'unique': 'True', 'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_checkin': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'next_checkin': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.monitorcheckin': {
            'Meta': {'unique_together': '()', 'object_name': 'MonitorCheckIn', 'index_together': '()'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'duration': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'guid': ('sentry.db.models.fields.uuid.UUIDField', [], {'auto_add': "'uuid:uuid4'", 'unique': 'True', 'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'location': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.MonitorLocation']", 'null': 'True'}),
            'monitor': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Monitor']"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.monitorlocation': {
            'Meta': {'unique_together': '()', 'object_name': 'MonitorLocation', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'guid': ('sentry.db.models.fields.uuid.UUIDField', [], {'auto_add': "'uuid:uuid4'", 'unique': 'True', 'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'})
        },
        'sentry.option': {
            'Meta': {'unique_together': '()', 'object_name': 'Option', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'}),
            'last_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.organization': {
            'Meta': {'unique_together': '()', 'object_name': 'Organization', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'default_role': ('django.db.models.fields.CharField', [], {'default': "'member'", 'max_length': '32'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '1'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'members': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'org_memberships'", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationMember']", 'to': "orm['sentry.User']"}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'slug': ('django.db.models.fields.SlugField', [], {'unique': 'True', 'max_length': '50'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.organizationaccessrequest': {
            'Meta': {'unique_together': "(('team', 'member'),)", 'object_name': 'OrganizationAccessRequest', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'member': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.OrganizationMember']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.organizationavatar': {
            'Meta': {'unique_together': '()', 'object_name': 'OrganizationAvatar', 'index_together': '()'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'avatar'", 'unique': 'True', 'to': "orm['sentry.Organization']"})
        },
        'sentry.organizationintegration': {
            'Meta': {'unique_together': "(('organization', 'integration'),)", 'object_name': 'OrganizationIntegration', 'index_together': '()'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'default_auth_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'integration': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Integration']"}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.organizationmember': {
            'Meta': {'unique_together': "(('organization', 'user'), ('organization', 'email'))", 'object_name': 'OrganizationMember', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'null': 'True', 'blank': 'True'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '0'}),
            'has_global_access': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'member_set'", 'to': "orm['sentry.Organization']"}),
            'role': ('django.db.models.fields.CharField', [], {'default': "'member'", 'max_length': '32'}),
            'teams': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Team']", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationMemberTeam']", 'blank': 'True'}),
            'token': ('django.db.models.fields.CharField', [], {'max_length': '64', 'unique': 'True', 'null': 'True', 'blank': 'True'}),
            'token_expires_at': ('django.db.models.fields.DateTimeField', [], {'default': 'None', 'null': 'True'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '50', 'blank': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "u'sentry_orgmember_set'", 'null': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.organizationmemberteam': {
            'Meta': {'unique_together': "(('team', 'organizationmember'),)", 'object_name': 'OrganizationMemberTeam', 'db_table': "'sentry_organizationmember_teams'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'organizationmember': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.OrganizationMember']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.organizationonboardingtask': {
            'Meta': {'unique_together': "(('organization', 'task'),)", 'object_name': 'OrganizationOnboardingTask', 'index_together': '()'},
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_completed': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True', 'blank': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'task': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'})
        },
        'sentry.organizationoption': {
            'Meta': {'unique_together': "(('organization', 'key'),)", 'object_name': 'OrganizationOption', 'db_table': "'sentry_organizationoptions'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.platformexternalissue': {
            'Meta': {'unique_together': "(('group_id', 'service_type'),)", 'object_name': 'PlatformExternalIssue', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'display_name': ('django.db.models.fields.TextField', [], {}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'service_type': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'web_url': ('django.db.models.fields.URLField', [], {'max_length': '200'})
        },
        'sentry.processingissue': {
            'Meta': {'unique_together': "(('project', 'checksum', 'type'),)", 'object_name': 'ProcessingIssue', 'index_together': '()'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '40', 'db_index': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '30'})
        },
        'sentry.project': {
            'Meta': {'unique_together': "(('organization', 'slug'),)", 'object_name': 'Project', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'first_event': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '0', 'null': 'True'}),
            'forced_color': ('django.db.models.fields.CharField', [], {'max_length': '6', 'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'public': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'slug': ('django.db.models.fields.SlugField', [], {'max_length': '50', 'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'teams': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'teams'", 'symmetrical': 'False', 'through': "orm['sentry.ProjectTeam']", 'to': "orm['sentry.Team']"})
        },
        'sentry.projectavatar': {
            'Meta': {'unique_together': '()', 'object_name': 'ProjectAvatar', 'index_together': '()'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'avatar'", 'unique': 'True', 'to': "orm['sentry.Project']"})
        },
        'sentry.projectbookmark': {
            'Meta': {'unique_together': "(('project', 'user'),)", 'object_name': 'ProjectBookmark', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True', 'blank': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.projectdebugfile': {
            'Meta': {'unique_together': '()', 'object_name': 'ProjectDebugFile', 'db_table': "'sentry_projectdsymfile'", 'index_together': "(('project', 'debug_id'), ('project', 'code_id'))"},
            'code_id': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'cpu_name': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'null': 'True'}),
            'debug_id': ('django.db.models.fields.CharField', [], {'max_length': '64', 'db_column': "'uuid'"}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'object_name': ('django.db.models.fields.TextField', [], {}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'})
        },
        'sentry.projectintegration': {
            'Meta': {'unique_together': "(('project', 'integration'),)", 'object_name': 'ProjectIntegration', 'index_together': '()'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'integration': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Integration']"}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.projectkey': {
            'Meta': {'unique_together': '()', 'object_name': 'ProjectKey', 'index_together': '()'},
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'key_set'", 'to': "orm['sentry.Project']"}),
            'public_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'rate_limit_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'rate_limit_window': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'roles': ('django.db.models.fields.BigIntegerField', [], {'default': '1'}),
            'secret_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.projectoption': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'ProjectOption', 'db_table': "'sentry_projectoptions'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.projectownership': {
            'Meta': {'unique_together': '()', 'object_name': 'ProjectOwnership', 'index_together': '()'},
            'auto_assignment': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'date_created': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'fallthrough': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'last_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'unique': 'True'}),
            'raw': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'schema': ('sentry.db.models.fields.jsonfield.JSONField', [], {'null': 'True'})
        },
        'sentry.projectplatform': {
            'Meta': {'unique_together': "(('project_id', 'platform'),)", 'object_name': 'ProjectPlatform', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.projectredirect': {
            'Meta': {'unique_together': "(('organization', 'redirect_slug'),)", 'object_name': 'ProjectRedirect', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'redirect_slug': ('django.db.models.fields.SlugField', [], {'max_length': '50'})
        },
        'sentry.projectteam': {
            'Meta': {'unique_together': "(('project', 'team'),)", 'object_name': 'ProjectTeam', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.promptsactivity': {
            'Meta': {'unique_together': "(('user', 'feature', 'organization_id', 'project_id'),)", 'object_name': 'PromptsActivity', 'index_together': '()'},
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'feature': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.pullrequest': {
            'Meta': {'unique_together': "(('repository_id', 'key'),)", 'object_name': 'PullRequest', 'db_table': "'sentry_pull_request'", 'index_together': "(('repository_id', 'date_added'), ('organization_id', 'merge_commit_sha'))"},
            'author': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.CommitAuthor']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'merge_commit_sha': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'repository_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'title': ('django.db.models.fields.TextField', [], {'null': 'True'})
        },
        'sentry.pullrequestcommit': {
            'Meta': {'unique_together': "(('pull_request', 'commit'),)", 'object_name': 'PullRequestCommit', 'db_table': "'sentry_pullrequest_commit'", 'index_together': '()'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'pull_request': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.PullRequest']"})
        },
        'sentry.rawevent': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'RawEvent', 'index_together': '()'},
            'data': ('sentry.db.models.fields.node.NodeField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.recentsearch': {
            'Meta': {'unique_together': "(('user', 'organization', 'type', 'query_hash'),)", 'object_name': 'RecentSearch', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'query': ('django.db.models.fields.TextField', [], {}),
            'query_hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'type': ('django.db.models.fields.PositiveSmallIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'db_index': 'False'})
        },
        'sentry.relay': {
            'Meta': {'unique_together': '()', 'object_name': 'Relay', 'index_together': '()'},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_internal': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'public_key': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'relay_id': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'})
        },
        'sentry.release': {
            'Meta': {'unique_together': "(('organization', 'version'),)", 'object_name': 'Release', 'index_together': '()'},
            'authors': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'commit_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_released': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_commit_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'last_deploy_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'new_groups': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True', 'on_delete': 'models.SET_NULL', 'blank': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'releases'", 'symmetrical': 'False', 'through': "orm['sentry.ReleaseProject']", 'to': "orm['sentry.Project']"}),
            'ref': ('django.db.models.fields.CharField', [], {'max_length': '250', 'null': 'True', 'blank': 'True'}),
            'total_deploys': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'version': ('django.db.models.fields.CharField', [], {'max_length': '250'})
        },
        'sentry.releasecommit': {
            'Meta': {'unique_together': "(('release', 'commit'), ('release', 'order'))", 'object_name': 'ReleaseCommit', 'index_together': '()'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'order': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.releaseenvironment': {
            'Meta': {'unique_together': "(('organization', 'release', 'environment'),)", 'object_name': 'ReleaseEnvironment', 'db_table': "'sentry_environmentrelease'", 'index_together': '()'},
            'environment': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Environment']"}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.releasefile': {
            'Meta': {'unique_together': "(('release', 'ident'),)", 'object_name': 'ReleaseFile', 'index_together': "(('release', 'name'),)"},
            'dist': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Distribution']", 'null': 'True'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'name': ('django.db.models.fields.TextField', [], {}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.releaseheadcommit': {
            'Meta': {'unique_together': "(('repository_id', 'release'),)", 'object_name': 'ReleaseHeadCommit', 'index_together': '()'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"}),
            'repository_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
        },
        'sentry.releaseproject': {
            'Meta': {'unique_together': "(('project', 'release'),)", 'object_name': 'ReleaseProject', 'db_table': "'sentry_release_project'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'new_groups': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.releaseprojectenvironment': {
            'Meta': {'unique_together': "(('project', 'release', 'environment'),)", 'object_name': 'ReleaseProjectEnvironment', 'index_together': '()'},
            'environment': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Environment']"}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_deploy_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'new_issues_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.repository': {
            'Meta': {'unique_together': "(('organization_id', 'name'), ('organization_id', 'provider', 'external_id'))", 'object_name': 'Repository', 'index_together': '()'},
            'config': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'integration_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'provider': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'})
        },
        'sentry.reprocessingreport': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'ReprocessingReport', 'index_together': '()'},
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.rule': {
            'Meta': {'unique_together': '()', 'object_name': 'Rule', 'index_together': '()'},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.savedsearch': {
            'Meta': {'unique_together': "(('project', 'name'), ('organization', 'owner', 'type'))", 'object_name': 'SavedSearch', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_default': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_global': ('django.db.models.fields.NullBooleanField', [], {'default': 'False', 'null': 'True', 'db_index': 'True', 'blank': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']", 'null': 'True'}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'query': ('django.db.models.fields.TextField', [], {}),
            'type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0', 'null': 'True'})
        },
        'sentry.savedsearchuserdefault': {
            'Meta': {'unique_together': "(('project', 'user'),)", 'object_name': 'SavedSearchUserDefault', 'db_table': "'sentry_savedsearch_userdefault'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'savedsearch': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.SavedSearch']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.scheduleddeletion': {
            'Meta': {'unique_together': "(('app_label', 'model_name', 'object_id'),)", 'object_name': 'ScheduledDeletion', 'index_together': '()'},
            'aborted': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'actor_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_scheduled': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2019, 6, 19, 0, 0)'}),
            'guid': ('django.db.models.fields.CharField', [], {'default': "'29b5aefbb160487cb6aaa1a4a4772ffa'", 'unique': 'True', 'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'in_progress': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'model_name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'object_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.scheduledjob': {
            'Meta': {'unique_together': '()', 'object_name': 'ScheduledJob', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_scheduled': ('django.db.models.fields.DateTimeField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'payload': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'})
        },
        'sentry.sentryapp': {
            'Meta': {'unique_together': '()', 'object_name': 'SentryApp', 'index_together': '()'},
            'application': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "u'sentry_app'", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL', 'to': "orm['sentry.ApiApplication']"}),
            'author': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_deleted': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'date_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'events': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_alertable': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'name': ('django.db.models.fields.TextField', [], {}),
            'overview': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'owned_sentry_apps'", 'to': "orm['sentry.Organization']"}),
            'proxy_user': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "u'sentry_app'", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL', 'to': "orm['sentry.User']"}),
            'redirect_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'}),
            'schema': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'slug': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'a0de8c34-a167-49d4-8207-c50d57350a4b'", 'max_length': '64'}),
            'webhook_url': ('django.db.models.fields.URLField', [], {'max_length': '200'})
        },
        'sentry.sentryappavatar': {
            'Meta': {'unique_together': '()', 'object_name': 'SentryAppAvatar', 'index_together': '()'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'sentry_app': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'avatar'", 'unique': 'True', 'to': "orm['sentry.SentryApp']"})
        },
        'sentry.sentryappcomponent': {
            'Meta': {'unique_together': '()', 'object_name': 'SentryAppComponent', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'schema': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'sentry_app': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'components'", 'to': "orm['sentry.SentryApp']"}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'uuid': ('sentry.db.models.fields.uuid.UUIDField', [], {'auto_add': "'uuid:uuid4'", 'unique': 'True', 'max_length': '32'})
        },
        'sentry.sentryappinstallation': {
            'Meta': {'unique_together': '()', 'object_name': 'SentryAppInstallation', 'index_together': '()'},
            'api_grant': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "u'sentry_app_installation'", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL', 'to': "orm['sentry.ApiGrant']"}),
            'api_token': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "u'sentry_app_installation'", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL', 'to': "orm['sentry.ApiToken']"}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_deleted': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'date_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'sentry_app_installations'", 'to': "orm['sentry.Organization']"}),
            'sentry_app': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'installations'", 'to': "orm['sentry.SentryApp']"}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'b7272814-1d7c-4e9b-a6d4-9f49f855d118'", 'max_length': '64'})
        },
        'sentry.servicehook': {
            'Meta': {'unique_together': '()', 'object_name': 'ServiceHook', 'index_together': '()'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'events': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'django.db.models.fields.TextField', [], {})}),
            'guid': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'secret': ('sentry.db.models.fields.encrypted.EncryptedTextField', [], {'default': "'cbc53b594ad64a269438de5997c8938fd80cdd00f72d49db899487c4570f48fc'"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '512'}),
            'version': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.servicehookproject': {
            'Meta': {'unique_together': "(('service_hook', 'project_id'),)", 'object_name': 'ServiceHookProject', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'service_hook': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ServiceHook']"})
        },
        'sentry.tagkey': {
            'Meta': {'unique_together': "(('project_id', 'key'),)", 'object_name': 'TagKey', 'db_table': "'sentry_filterkey'", 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.tagvalue': {
            'Meta': {'unique_together': "(('project_id', 'key', 'value'),)", 'object_name': 'TagValue', 'db_table': "'sentry_filtervalue'", 'index_together': "(('project_id', 'key', 'last_seen'),)"},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.team': {
            'Meta': {'unique_together': "(('organization', 'slug'),)", 'object_name': 'Team', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'slug': ('django.db.models.fields.SlugField', [], {'max_length': '50'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.teamavatar': {
            'Meta': {'unique_together': '()', 'object_name': 'TeamAvatar', 'index_together': '()'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'avatar'", 'unique': 'True', 'to': "orm['sentry.Team']"})
        },
        'sentry.timeseriessnapshot': {
            'Meta': {'unique_together': '()', 'object_name': 'TimeSeriesSnapshot', 'index_together': '()'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'end': ('django.db.models.fields.DateTimeField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'period': ('django.db.models.fields.IntegerField', [], {}),
            'start': ('django.db.models.fields.DateTimeField', [], {}),
            'values': ('sentry.db.models.fields.array.ArrayField', [], {'of': (u'sentry.db.models.fields.array.ArrayField', [], {'null': 'True'})})
        },
        'sentry.user': {
            'Meta': {'unique_together': '()', 'object_name': 'User', 'db_table': "'auth_user'", 'index_together': '()'},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '0', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_managed': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_password_expired': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_sentry_app': ('django.db.models.fields.NullBooleanField', [], {'default': 'None', 'null': 'True', 'blank': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_active': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'last_password_change': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200', 'db_column': "'first_name'", 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'session_nonce': ('django.db.models.fields.CharField', [], {'max_length': '12', 'null': 'True'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '128'})
        },
        'sentry.useravatar': {
            'Meta': {'unique_together': '()', 'object_name': 'UserAvatar', 'index_together': '()'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'avatar'", 'unique': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.useremail': {
            'Meta': {'unique_together': "(('user', 'email'),)", 'object_name': 'UserEmail', 'index_together': '()'},
            'date_hash_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_verified': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "u'emails'", 'to': "orm['sentry.User']"}),
            'validation_hash': ('django.db.models.fields.CharField', [], {'default': "u'fwf6K6iSPvMdBol9hyfdhrA73Wy3eU4k'", 'max_length': '32'})
        },
        'sentry.userip': {
            'Meta': {'unique_together': "(('user', 'ip_address'),)", 'object_name': 'UserIP', 'index_together': '()'},
            'country_code': ('django.db.models.fields.CharField', [], {'max_length': '16', 'null': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'region_code': ('django.db.models.fields.CharField', [], {'max_length': '16', 'null': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.useroption': {
            'Meta': {'unique_together': "(('user', 'project', 'key'), ('user', 'organization', 'key'))", 'object_name': 'UserOption', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']", 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.userpermission': {
            'Meta': {'unique_together': "(('user', 'permission'),)", 'object_name': 'UserPermission', 'index_together': '()'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'permission': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.userreport': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'UserReport', 'index_together': "(('project', 'event_id'), ('project', 'date_added'))"},
            'comments': ('django.db.models.fields.TextField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'environment': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Environment']", 'null': 'True'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'event_user_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.widget': {
            'Meta': {'unique_together': "(('dashboard', 'order'), ('dashboard', 'title'))", 'object_name': 'Widget', 'index_together': '()'},
            'dashboard': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Dashboard']"}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'display_options': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'display_type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'order': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'title': ('django.db.models.fields.CharField', [], {'max_length': '255'})
        },
        'sentry.widgetdatasource': {
            'Meta': {'unique_together': "(('widget', 'name'), ('widget', 'order'))", 'object_name': 'WidgetDataSource', 'index_together': '()'},
            'data': ('sentry.db.models.fields.jsonfield.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'order': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'widget': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Widget']"})
        }
    }

    complete_apps = ['sentry']
