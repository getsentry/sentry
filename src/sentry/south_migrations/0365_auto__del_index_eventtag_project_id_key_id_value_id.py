# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models
from django.db.utils import ProgrammingError

from sentry.utils.db import is_postgres


class Migration(SchemaMigration):

    # Flag to indicate if this migration is too risky
    # to run online and needs to be coordinated for offline
    is_dangerous = True

    def forwards(self, orm):
        # Removing index on 'EventTag', fields ['project_id', 'key_id', 'value_id']
        if is_postgres():
            db.commit_transaction()
            try:
                db.execute(
                    "DROP INDEX CONCURRENTLY {}".format(
                        db.create_index_name(
                            u'sentry_eventtag', [
                                'project_id', 'key_id', 'value_id']),
                    )
                )
            except ProgrammingError:
                db.execute(
                    "DROP INDEX {}".format(
                        db.create_index_name(
                            u'sentry_eventtag', [
                                'project_id', 'key_id', 'value_id']),
                    )
                )
            db.start_transaction()
        else:
            db.delete_index(u'sentry_eventtag', ['project_id', 'key_id', 'value_id'])

    def backwards(self, orm):
        # Adding index on 'EventTag', fields ['project_id', 'key_id', 'value_id']
        if is_postgres():
            db.commit_transaction()
            try:
                db.execute(
                    "CREATE INDEX CONCURRENTLY {} ON sentry_eventtag (project_id, key_id, value_id)".format(
                        db.create_index_name(
                            u'sentry_eventtag', [
                                'project_id', 'key_id', 'value_id']),
                    )
                )
            except ProgrammingError:
                db.execute(
                    "CREATE INDEX {} ON sentry_eventtag (project_id, key_id, value_id)".format(
                        db.create_index_name(
                            u'sentry_eventtag', [
                                'project_id', 'key_id', 'value_id']),
                    )
                )
            db.start_transaction()
        else:
            db.create_index(u'sentry_eventtag', ['project_id', 'key_id', 'value_id'])

    models = {
        'sentry.activity': {
            'Meta': {'object_name': 'Activity'},
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
            'Meta': {'object_name': 'ApiApplication'},
            'allowed_origins': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'client_id': ('django.db.models.fields.CharField', [], {'default': "'918e38b668a24305bf7713066b3c582b7db1f8ce033241abab67d2fe58736be4'", 'unique': 'True', 'max_length': '64'}),
            'client_secret': ('sentry.db.models.fields.encrypted.EncryptedTextField', [], {'default': "'f823f2151c274c4c92e4eb448d0faec3db68e2c2ad5f4c5d80195e2df9ca2aa7'"}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'homepage_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'default': "'Sterling Macaw'", 'max_length': '64', 'blank': 'True'}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'privacy_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'}),
            'redirect_uris': ('django.db.models.fields.TextField', [], {}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'terms_url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True'})
        },
        'sentry.apiauthorization': {
            'Meta': {'unique_together': "(('user', 'application'),)", 'object_name': 'ApiAuthorization'},
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': ('django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.apigrant': {
            'Meta': {'object_name': 'ApiGrant'},
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']"}),
            'code': ('django.db.models.fields.CharField', [], {'default': "'cc537f37028f4947b8da3910ed438d13'", 'max_length': '64', 'db_index': 'True'}),
            'expires_at': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2017, 11, 14, 0, 0)', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'redirect_uri': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': ('django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.apikey': {
            'Meta': {'object_name': 'ApiKey'},
            'allowed_origins': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32'}),
            'label': ('django.db.models.fields.CharField', [], {'default': "'Default'", 'max_length': '64', 'blank': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'key_set'", 'to': "orm['sentry.Organization']"}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': ('django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.apitoken': {
            'Meta': {'object_name': 'ApiToken'},
            'application': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiApplication']", 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'expires_at': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2017, 12, 14, 0, 0)', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'refresh_token': ('django.db.models.fields.CharField', [], {'default': "'3ed27047db9346c5a2894327ef8c78b9dd9753c593564780ac60e53f87a7fdcf'", 'max_length': '64', 'unique': 'True', 'null': 'True'}),
            'scope_list': ('sentry.db.models.fields.array.ArrayField', [], {'of': ('django.db.models.fields.TextField', [], {})}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'token': ('django.db.models.fields.CharField', [], {'default': "'a89b7a9c073a4041b8335ca354008faadba5238260194abdbc1fe54ff0ef8d84'", 'unique': 'True', 'max_length': '64'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.auditlogentry': {
            'Meta': {'object_name': 'AuditLogEntry'},
            'actor': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "'audit_actors'", 'null': 'True', 'to': "orm['sentry.User']"}),
            'actor_key': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ApiKey']", 'null': 'True', 'blank': 'True'}),
            'actor_label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'target_object': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'target_user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "'audit_targets'", 'null': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.authenticator': {
            'Meta': {'unique_together': "(('user', 'type'),)", 'object_name': 'Authenticator', 'db_table': "'auth_authenticator'"},
            'config': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {}),
            'created_at': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedAutoField', [], {'primary_key': 'True'}),
            'last_used_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.authidentity': {
            'Meta': {'unique_together': "(('auth_provider', 'ident'), ('auth_provider', 'user'))", 'object_name': 'AuthIdentity'},
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
            'Meta': {'object_name': 'AuthProvider'},
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
            'Meta': {'object_name': 'Broadcast'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_expires': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2017, 11, 21, 0, 0)', 'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True', 'db_index': 'True'}),
            'link': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.CharField', [], {'max_length': '256'}),
            'title': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'upstream_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'blank': 'True'})
        },
        'sentry.broadcastseen': {
            'Meta': {'unique_together': "(('broadcast', 'user'),)", 'object_name': 'BroadcastSeen'},
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
            'Meta': {'unique_together': "(('organization_id', 'email'), ('organization_id', 'external_id'))", 'object_name': 'CommitAuthor'},
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '164', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'})
        },
        'sentry.commitfilechange': {
            'Meta': {'unique_together': "(('commit', 'filename'),)", 'object_name': 'CommitFileChange'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'filename': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '1'})
        },
        'sentry.counter': {
            'Meta': {'object_name': 'Counter', 'db_table': "'sentry_projectcounter'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'unique': 'True'}),
            'value': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.deploy': {
            'Meta': {'object_name': 'Deploy'},
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
        'sentry.distribution': {
            'Meta': {'unique_together': "(('release', 'name'),)", 'object_name': 'Distribution'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.dsymapp': {
            'Meta': {'unique_together': "(('project', 'platform', 'app_id'),)", 'object_name': 'DSymApp'},
            'app_id': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_synced': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'platform': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'sync_id': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'})
        },
        'sentry.email': {
            'Meta': {'object_name': 'Email'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('sentry.db.models.fields.citext.CIEmailField', [], {'unique': 'True', 'max_length': '75'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'})
        },
        'sentry.environment': {
            'Meta': {'unique_together': "(('project_id', 'name'), ('organization_id', 'name'))", 'object_name': 'Environment'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Project']", 'through': "orm['sentry.EnvironmentProject']", 'symmetrical': 'False'})
        },
        'sentry.environmentproject': {
            'Meta': {'unique_together': "(('project', 'environment'),)", 'object_name': 'EnvironmentProject'},
            'environment': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Environment']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
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
        'sentry.eventmapping': {
            'Meta': {'unique_together': "(('project_id', 'event_id'),)", 'object_name': 'EventMapping'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.eventprocessingissue': {
            'Meta': {'unique_together': "(('raw_event', 'processing_issue'),)", 'object_name': 'EventProcessingIssue'},
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
        'sentry.featureadoption': {
            'Meta': {'unique_together': "(('organization', 'feature_id'),)", 'object_name': 'FeatureAdoption'},
            'applicable': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'complete': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_completed': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'feature_id': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"})
        },
        'sentry.file': {
            'Meta': {'object_name': 'File'},
            'blob': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'legacy_blob'", 'null': 'True', 'to': "orm['sentry.FileBlob']"}),
            'blobs': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.FileBlob']", 'through': "orm['sentry.FileBlobIndex']", 'symmetrical': 'False'}),
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '40', 'null': 'True'}),
            'headers': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'path': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'size': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'timestamp': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.fileblob': {
            'Meta': {'object_name': 'FileBlob'},
            'checksum': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '40'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'path': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'size': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'timestamp': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'})
        },
        'sentry.fileblobindex': {
            'Meta': {'unique_together': "(('file', 'blob', 'offset'),)", 'object_name': 'FileBlobIndex'},
            'blob': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.FileBlob']"}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'offset': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
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
            'Meta': {'object_name': 'GroupAssignee', 'db_table': "'sentry_groupasignee'"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'assignee_set'", 'unique': 'True', 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'assignee_set'", 'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'sentry_assignee_set'", 'to': "orm['sentry.User']"})
        },
        'sentry.groupbookmark': {
            'Meta': {'unique_together': "(('project', 'user', 'group'),)", 'object_name': 'GroupBookmark'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'bookmark_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'bookmark_set'", 'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'sentry_bookmark_set'", 'to': "orm['sentry.User']"})
        },
        'sentry.groupcommitresolution': {
            'Meta': {'unique_together': "(('group_id', 'commit_id'),)", 'object_name': 'GroupCommitResolution'},
            'commit_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'})
        },
        'sentry.groupemailthread': {
            'Meta': {'unique_together': "(('email', 'group'), ('email', 'msgid'))", 'object_name': 'GroupEmailThread'},
            'date': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'groupemail_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'msgid': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'groupemail_set'", 'to': "orm['sentry.Project']"})
        },
        'sentry.grouphash': {
            'Meta': {'unique_together': "(('project', 'hash'),)", 'object_name': 'GroupHash'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'group_tombstone_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'state': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.grouplink': {
            'Meta': {'unique_together': "(('group_id', 'linked_type', 'linked_id'),)", 'object_name': 'GroupLink'},
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'linked_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {}),
            'linked_type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '1'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'relationship': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '2'})
        },
        'sentry.groupmeta': {
            'Meta': {'unique_together': "(('group', 'key'),)", 'object_name': 'GroupMeta'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'value': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.groupredirect': {
            'Meta': {'object_name': 'GroupRedirect'},
            'group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'previous_group_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'unique': 'True'})
        },
        'sentry.grouprelease': {
            'Meta': {'unique_together': "(('group_id', 'release_id', 'environment'),)", 'object_name': 'GroupRelease'},
            'environment': ('django.db.models.fields.CharField', [], {'default': "''", 'max_length': '64'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'})
        },
        'sentry.groupresolution': {
            'Meta': {'object_name': 'GroupResolution'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.grouprulestatus': {
            'Meta': {'unique_together': "(('rule', 'group'),)", 'object_name': 'GroupRuleStatus'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_active': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'rule': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Rule']"}),
            'status': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'})
        },
        'sentry.groupseen': {
            'Meta': {'unique_together': "(('user', 'group'),)", 'object_name': 'GroupSeen'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'db_index': 'False'})
        },
        'sentry.groupshare': {
            'Meta': {'object_name': 'GroupShare'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'ca84c4b5eab648d7bcae4cd284c196fb'", 'unique': 'True', 'max_length': '32'})
        },
        'sentry.groupsnooze': {
            'Meta': {'object_name': 'GroupSnooze'},
            'actor_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'state': ('jsonfield.fields.JSONField', [], {'null': 'True'}),
            'until': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'user_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'user_window': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'window': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'})
        },
        'sentry.groupsubscription': {
            'Meta': {'unique_together': "(('group', 'user'),)", 'object_name': 'GroupSubscription'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'subscription_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'subscription_set'", 'to': "orm['sentry.Project']"}),
            'reason': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.grouptagkey': {
            'Meta': {'unique_together': "(('project_id', 'group_id', 'key'),)", 'object_name': 'GroupTagKey'},
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
            'Meta': {'object_name': 'GroupTombstone'},
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
            'Meta': {'unique_together': "(('idp', 'external_id'),)", 'object_name': 'Identity'},
            'data': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_verified': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'idp': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.IdentityProvider']"}),
            'scopes': ('sentry.db.models.fields.array.ArrayField', [], {'of': ('django.db.models.fields.TextField', [], {})}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.identityprovider': {
            'Meta': {'unique_together': "(('type', 'instance'),)", 'object_name': 'IdentityProvider'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'instance': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.integration': {
            'Meta': {'unique_together': "(('provider', 'external_id'),)", 'object_name': 'Integration'},
            'external_id': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'metadata': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'organizations': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'integrations'", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationIntegration']", 'to': "orm['sentry.Organization']"}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'integrations'", 'symmetrical': 'False', 'through': "orm['sentry.ProjectIntegration']", 'to': "orm['sentry.Project']"}),
            'provider': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.lostpasswordhash': {
            'Meta': {'object_name': 'LostPasswordHash'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'unique': 'True'})
        },
        'sentry.minidumpfile': {
            'Meta': {'object_name': 'MinidumpFile'},
            'event_id': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '36'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'})
        },
        'sentry.option': {
            'Meta': {'object_name': 'Option'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'}),
            'last_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.organization': {
            'Meta': {'object_name': 'Organization'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'default_role': ('django.db.models.fields.CharField', [], {'default': "'member'", 'max_length': '32'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '1'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'members': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'org_memberships'", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationMember']", 'to': "orm['sentry.User']"}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'slug': ('django.db.models.fields.SlugField', [], {'unique': 'True', 'max_length': '50'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.organizationaccessrequest': {
            'Meta': {'unique_together': "(('team', 'member'),)", 'object_name': 'OrganizationAccessRequest'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'member': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.OrganizationMember']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.organizationavatar': {
            'Meta': {'object_name': 'OrganizationAvatar'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'avatar'", 'unique': 'True', 'to': "orm['sentry.Organization']"})
        },
        'sentry.organizationintegration': {
            'Meta': {'unique_together': "(('organization', 'integration'),)", 'object_name': 'OrganizationIntegration'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'default_auth_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'integration': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Integration']"}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"})
        },
        'sentry.organizationmember': {
            'Meta': {'unique_together': "(('organization', 'user'), ('organization', 'email'))", 'object_name': 'OrganizationMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'null': 'True', 'blank': 'True'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '0'}),
            'has_global_access': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'member_set'", 'to': "orm['sentry.Organization']"}),
            'role': ('django.db.models.fields.CharField', [], {'default': "'member'", 'max_length': '32'}),
            'teams': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Team']", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationMemberTeam']", 'blank': 'True'}),
            'token': ('django.db.models.fields.CharField', [], {'max_length': '64', 'unique': 'True', 'null': 'True', 'blank': 'True'}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '50', 'blank': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "'sentry_orgmember_set'", 'null': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.organizationmemberteam': {
            'Meta': {'unique_together': "(('team', 'organizationmember'),)", 'object_name': 'OrganizationMemberTeam', 'db_table': "'sentry_organizationmember_teams'"},
            'id': ('sentry.db.models.fields.bounded.BoundedAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'organizationmember': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.OrganizationMember']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.organizationonboardingtask': {
            'Meta': {'unique_together': "(('organization', 'task'),)", 'object_name': 'OrganizationOnboardingTask'},
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_completed': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True', 'blank': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'task': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'})
        },
        'sentry.organizationoption': {
            'Meta': {'unique_together': "(('organization', 'key'),)", 'object_name': 'OrganizationOption', 'db_table': "'sentry_organizationoptions'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.processingissue': {
            'Meta': {'unique_together': "(('project', 'checksum', 'type'),)", 'object_name': 'ProcessingIssue'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '40', 'db_index': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '30'})
        },
        'sentry.project': {
            'Meta': {'unique_together': "(('team', 'slug'), ('organization', 'slug'))", 'object_name': 'Project'},
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
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"}),
            'teams': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'teams'", 'symmetrical': 'False', 'through': "orm['sentry.ProjectTeam']", 'to': "orm['sentry.Team']"})
        },
        'sentry.projectbookmark': {
            'Meta': {'unique_together': "(('project_id', 'user'),)", 'object_name': 'ProjectBookmark'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True', 'blank': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.projectdsymfile': {
            'Meta': {'unique_together': "(('project', 'uuid'),)", 'object_name': 'ProjectDSymFile'},
            'cpu_name': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'object_name': ('django.db.models.fields.TextField', [], {}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'uuid': ('django.db.models.fields.CharField', [], {'max_length': '36'})
        },
        'sentry.projectintegration': {
            'Meta': {'unique_together': "(('project', 'integration'),)", 'object_name': 'ProjectIntegration'},
            'config': ('sentry.db.models.fields.encrypted.EncryptedJsonField', [], {'default': '{}'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'integration': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Integration']"}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.projectkey': {
            'Meta': {'object_name': 'ProjectKey'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'key_set'", 'to': "orm['sentry.Project']"}),
            'public_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'rate_limit_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'rate_limit_window': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'roles': ('django.db.models.fields.BigIntegerField', [], {'default': '1'}),
            'secret_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.projectoption': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'ProjectOption', 'db_table': "'sentry_projectoptions'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.projectplatform': {
            'Meta': {'unique_together': "(('project_id', 'platform'),)", 'object_name': 'ProjectPlatform'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.projectsymcachefile': {
            'Meta': {'unique_together': "(('project', 'dsym_file'),)", 'object_name': 'ProjectSymCacheFile'},
            'cache_file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'dsym_file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ProjectDSymFile']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'version': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
        },
        'sentry.projectteam': {
            'Meta': {'unique_together': "(('project', 'team'),)", 'object_name': 'ProjectTeam'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.rawevent': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'RawEvent'},
            'data': ('sentry.db.models.fields.node.NodeField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.release': {
            'Meta': {'unique_together': "(('organization', 'version'),)", 'object_name': 'Release'},
            'authors': ('sentry.db.models.fields.array.ArrayField', [], {'of': ('django.db.models.fields.TextField', [], {})}),
            'commit_count': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_released': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_commit_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'last_deploy_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'new_groups': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True', 'blank': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'releases'", 'symmetrical': 'False', 'through': "orm['sentry.ReleaseProject']", 'to': "orm['sentry.Project']"}),
            'ref': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'total_deploys': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'version': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.releasecommit': {
            'Meta': {'unique_together': "(('release', 'commit'), ('release', 'order'))", 'object_name': 'ReleaseCommit'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'order': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.releaseenvironment': {
            'Meta': {'unique_together': "(('organization_id', 'release_id', 'environment_id'),)", 'object_name': 'ReleaseEnvironment', 'db_table': "'sentry_environmentrelease'"},
            'environment_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'project_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True'}),
            'release_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'})
        },
        'sentry.releasefile': {
            'Meta': {'unique_together': "(('release', 'ident'),)", 'object_name': 'ReleaseFile'},
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
            'Meta': {'unique_together': "(('repository_id', 'release'),)", 'object_name': 'ReleaseHeadCommit'},
            'commit': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Commit']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'db_index': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"}),
            'repository_id': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {})
        },
        'sentry.releaseproject': {
            'Meta': {'unique_together': "(('project', 'release'),)", 'object_name': 'ReleaseProject', 'db_table': "'sentry_release_project'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'new_groups': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.repository': {
            'Meta': {'unique_together': "(('organization_id', 'name'), ('organization_id', 'provider', 'external_id'))", 'object_name': 'Repository'},
            'config': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
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
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'ReprocessingReport'},
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.rule': {
            'Meta': {'object_name': 'Rule'},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.savedsearch': {
            'Meta': {'unique_together': "(('project', 'name'),)", 'object_name': 'SavedSearch'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_default': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'query': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.savedsearchuserdefault': {
            'Meta': {'unique_together': "(('project', 'user'),)", 'object_name': 'SavedSearchUserDefault', 'db_table': "'sentry_savedsearch_userdefault'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'savedsearch': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.SavedSearch']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.scheduleddeletion': {
            'Meta': {'unique_together': "(('app_label', 'model_name', 'object_id'),)", 'object_name': 'ScheduledDeletion'},
            'aborted': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'actor_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_scheduled': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2017, 12, 14, 0, 0)'}),
            'guid': ('django.db.models.fields.CharField', [], {'default': "'c952699b30fb45479883c8112b655d8b'", 'unique': 'True', 'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'in_progress': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'model_name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'object_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {})
        },
        'sentry.scheduledjob': {
            'Meta': {'object_name': 'ScheduledJob'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_scheduled': ('django.db.models.fields.DateTimeField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'payload': ('jsonfield.fields.JSONField', [], {'default': '{}'})
        },
        'sentry.tagkey': {
            'Meta': {'unique_together': "(('project_id', 'key'),)", 'object_name': 'TagKey', 'db_table': "'sentry_filterkey'"},
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
            'Meta': {'unique_together': "(('organization', 'slug'),)", 'object_name': 'Team'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'slug': ('django.db.models.fields.SlugField', [], {'max_length': '50'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
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
            'last_active': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_password_change': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200', 'db_column': "'first_name'", 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'session_nonce': ('django.db.models.fields.CharField', [], {'max_length': '12', 'null': 'True'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '128'})
        },
        'sentry.useravatar': {
            'Meta': {'object_name': 'UserAvatar'},
            'avatar_type': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '0'}),
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']", 'unique': 'True', 'null': 'True', 'on_delete': 'models.SET_NULL'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32', 'db_index': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'avatar'", 'unique': 'True', 'to': "orm['sentry.User']"})
        },
        'sentry.useremail': {
            'Meta': {'unique_together': "(('user', 'email'),)", 'object_name': 'UserEmail'},
            'date_hash_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_verified': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'emails'", 'to': "orm['sentry.User']"}),
            'validation_hash': ('django.db.models.fields.CharField', [], {'default': "u'8k1gYbhveuAvL1jwVpA7tHJmBgpTiR6m'", 'max_length': '32'})
        },
        'sentry.useridentity': {
            'Meta': {'unique_together': "(('user', 'identity'),)", 'object_name': 'UserIdentity'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'identity': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Identity']"}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.userip': {
            'Meta': {'unique_together': "(('user', 'ip_address'),)", 'object_name': 'UserIP'},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.useroption': {
            'Meta': {'unique_together': "(('user', 'project', 'key'), ('user', 'organization', 'key'))", 'object_name': 'UserOption'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']", 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'value': ('sentry.db.models.fields.encrypted.EncryptedPickledObjectField', [], {})
        },
        'sentry.userreport': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'UserReport', 'index_together': "(('project', 'event_id'), ('project', 'date_added'))"},
            'comments': ('django.db.models.fields.TextField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'event_user_id': ('sentry.db.models.fields.bounded.BoundedBigIntegerField', [], {'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.versiondsymfile': {
            'Meta': {'unique_together': "(('dsym_file', 'version', 'build'),)", 'object_name': 'VersionDSymFile'},
            'build': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'dsym_app': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.DSymApp']"}),
            'dsym_file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.ProjectDSymFile']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'version': ('django.db.models.fields.CharField', [], {'max_length': '32'})
        }
    }

    complete_apps = ['sentry']
