# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import DataMigration
from django.db import models

class Migration(DataMigration):

    def forwards(self, orm):
        from sentry.utils.query import RangeQuerySetWrapper

        queryset = orm['sentry.File'].objects.all()
        for file in RangeQuerySetWrapper(queryset):
            if file.size:
                continue
            orm['sentry.File'].objects.filter(id=file.id).update(
                size=sum([
                    fbi.blob.size
                    for fbi in orm['sentry.FileBlobIndex'].objects.filter(
                        file=file,
                    ).select_related('blob')
                ]),
            )

    def backwards(self, orm):
        pass

    models = {
        'sentry.activity': {
            'Meta': {'object_name': 'Activity'},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Event']", 'null': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'type': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'})
        },
        'sentry.apikey': {
            'Meta': {'object_name': 'ApiKey'},
            'allowed_origins': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '32'}),
            'label': ('django.db.models.fields.CharField', [], {'default': "'Default'", 'max_length': '64', 'blank': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'key_set'", 'to': "orm['sentry.Organization']"}),
            'scopes': ('django.db.models.fields.BigIntegerField', [], {'default': 'None'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
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
        'sentry.authidentity': {
            'Meta': {'unique_together': "(('auth_provider', 'ident'), ('auth_provider', 'user'))", 'object_name': 'AuthIdentity'},
            'auth_provider': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.AuthProvider']"}),
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'last_synced': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_verified': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"})
        },
        'sentry.authprovider': {
            'Meta': {'object_name': 'AuthProvider'},
            'config': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
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
            'date_expires': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2016, 1, 11, 0, 0)', 'null': 'True', 'blank': 'True'}),
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
        'sentry.event': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'Event', 'db_table': "'sentry_message'", 'index_together': "(('group', 'datetime'),)"},
            'data': ('sentry.db.models.fields.node.NodeField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'db_column': "'message_id'"}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "'event_set'", 'null': 'True', 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'num_comments': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'time_spent': ('sentry.db.models.fields.bounded.BoundedIntegerField', [], {'null': 'True'})
        },
        'sentry.eventmapping': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'EventMapping'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.eventuser': {
            'Meta': {'unique_together': "(('project', 'ident'), ('project', 'hash'))", 'object_name': 'EventUser', 'index_together': "(('project', 'email'), ('project', 'username'), ('project', 'ip_address'))"},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'null': 'True'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'}),
            'ip_address': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'username': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True'})
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
            'Meta': {'object_name': 'Group', 'db_table': "'sentry_groupedmessage'", 'index_together': "(('project', 'first_release'),)"},
            'active_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'db_index': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'db_column': "'view'", 'blank': 'True'}),
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'first_release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']", 'null': 'True'}),
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
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'})
        },
        'sentry.groupmeta': {
            'Meta': {'unique_together': "(('group', 'key'),)", 'object_name': 'GroupMeta'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'value': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.groupresolution': {
            'Meta': {'object_name': 'GroupResolution'},
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
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
        'sentry.groupsnooze': {
            'Meta': {'object_name': 'GroupSnooze'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'unique': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'until': ('django.db.models.fields.DateTimeField', [], {})
        },
        'sentry.grouptagkey': {
            'Meta': {'unique_together': "(('project', 'group', 'key'),)", 'object_name': 'GroupTagKey'},
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.grouptagvalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value', 'group'),)", 'object_name': 'GroupTagValue', 'db_table': "'sentry_messagefiltervalue'"},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'grouptag'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'grouptag'", 'null': 'True', 'to': "orm['sentry.Project']"}),
            'times_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.helppage': {
            'Meta': {'object_name': 'HelpPage'},
            'content': ('django.db.models.fields.TextField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_visible': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64', 'unique': 'True', 'null': 'True'}),
            'priority': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '50'}),
            'title': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.lostpasswordhash': {
            'Meta': {'object_name': 'LostPasswordHash'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'unique': 'True'})
        },
        'sentry.option': {
            'Meta': {'object_name': 'Option'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'}),
            'last_updated': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'value': ('sentry.db.models.fields.pickle.UnicodePickledObjectField', [], {})
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
        'sentry.organizationmember': {
            'Meta': {'unique_together': "(('organization', 'user'), ('organization', 'email'))", 'object_name': 'OrganizationMember'},
            'counter': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'null': 'True', 'blank': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'null': 'True', 'blank': 'True'}),
            'flags': ('django.db.models.fields.BigIntegerField', [], {'default': '0'}),
            'has_global_access': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'member_set'", 'to': "orm['sentry.Organization']"}),
            'role': ('django.db.models.fields.CharField', [], {'default': "'member'", 'max_length': '32'}),
            'teams': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Team']", 'symmetrical': 'False', 'through': "orm['sentry.OrganizationMemberTeam']", 'blank': 'True'}),
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
        'sentry.organizationoption': {
            'Meta': {'unique_together': "(('organization', 'key'),)", 'object_name': 'OrganizationOption', 'db_table': "'sentry_organizationoptions'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'value': ('sentry.db.models.fields.pickle.UnicodePickledObjectField', [], {})
        },
        'sentry.project': {
            'Meta': {'unique_together': "(('team', 'slug'), ('organization', 'slug'))", 'object_name': 'Project'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'first_event': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'organization': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Organization']"}),
            'public': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'slug': ('django.db.models.fields.SlugField', [], {'max_length': '50', 'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'team': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Team']"})
        },
        'sentry.projectkey': {
            'Meta': {'object_name': 'ProjectKey'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'related_name': "'key_set'", 'to': "orm['sentry.Project']"}),
            'public_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'roles': ('django.db.models.fields.BigIntegerField', [], {'default': '1'}),
            'secret_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.projectoption': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'ProjectOption', 'db_table': "'sentry_projectoptions'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'value': ('sentry.db.models.fields.pickle.UnicodePickledObjectField', [], {})
        },
        'sentry.release': {
            'Meta': {'unique_together': "(('project', 'version'),)", 'object_name': 'Release'},
            'data': ('jsonfield.fields.JSONField', [], {'default': '{}'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_released': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'new_groups': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'owner': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True', 'blank': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'ref': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'version': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        'sentry.releasefile': {
            'Meta': {'unique_together': "(('release', 'ident'),)", 'object_name': 'ReleaseFile'},
            'file': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.File']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '40'}),
            'name': ('django.db.models.fields.TextField', [], {}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'release': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Release']"})
        },
        'sentry.rule': {
            'Meta': {'object_name': 'Rule'},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.savedsearch': {
            'Meta': {'unique_together': "(('project', 'name'),)", 'object_name': 'SavedSearch'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'query': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.tagkey': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'TagKey', 'db_table': "'sentry_filterkey'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'status': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'}),
            'values_seen': ('sentry.db.models.fields.bounded.BoundedPositiveIntegerField', [], {'default': '0'})
        },
        'sentry.tagvalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value'),)", 'object_name': 'TagValue', 'db_table': "'sentry_filtervalue'"},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
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
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200', 'db_column': "'first_name'", 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '128'})
        },
        'sentry.useroption': {
            'Meta': {'unique_together': "(('user', 'project', 'key'),)", 'object_name': 'UserOption'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'user': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'value': ('sentry.db.models.fields.pickle.UnicodePickledObjectField', [], {})
        },
        'sentry.userreport': {
            'Meta': {'object_name': 'UserReport', 'index_together': "(('project', 'event_id'), ('project', 'date_added'))"},
            'comments': ('django.db.models.fields.TextField', [], {}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'group': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'project': ('sentry.db.models.fields.foreignkey.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"})
        }
    }

    complete_apps = ['sentry']
    symmetrical = True
