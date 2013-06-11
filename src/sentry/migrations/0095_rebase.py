# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        pass

    def backwards(self, orm):
        pass

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
        'sentry.accessgroup': {
            'Meta': {'unique_together': "(('team', 'name'),)", 'object_name': 'AccessGroup'},
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'managed': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'members': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['auth.User']", 'symmetrical': 'False'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'projects': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Project']", 'symmetrical': 'False'}),
            'team': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Team']"}),
            'type': ('django.db.models.fields.IntegerField', [], {'default': '50'})
        },
        'sentry.activity': {
            'Meta': {'object_name': 'Activity'},
            'data': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Event']", 'null': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'type': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']", 'null': 'True'})
        },
        'sentry.affecteduserbygroup': {
            'Meta': {'unique_together': "(('project', 'tuser', 'group'),)", 'object_name': 'AffectedUserByGroup'},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'tuser': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.TrackedUser']", 'null': 'True'})
        },
        'sentry.alert': {
            'Meta': {'object_name': 'Alert'},
            'data': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']", 'null': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'related_groups': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'related_alerts'", 'symmetrical': 'False', 'through': "orm['sentry.AlertRelatedGroup']", 'to': "orm['sentry.Group']"}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.alertrelatedgroup': {
            'Meta': {'unique_together': "(('group', 'alert'),)", 'object_name': 'AlertRelatedGroup'},
            'alert': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Alert']"}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'})
        },
        'sentry.event': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'Event', 'db_table': "'sentry_message'"},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'db_column': "'view'", 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'db_column': "'message_id'"}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'blank': 'True', 'related_name': "'event_set'", 'null': 'True', 'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'num_comments': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'site': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'time_spent': ('django.db.models.fields.FloatField', [], {'null': 'True'})
        },
        'sentry.eventmapping': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'EventMapping'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.group': {
            'Meta': {'unique_together': "(('project', 'checksum'),)", 'object_name': 'Group', 'db_table': "'sentry_groupedmessage'"},
            'active_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'db_index': 'True'}),
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'db_column': "'view'", 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_public': ('django.db.models.fields.NullBooleanField', [], {'default': 'False', 'null': 'True', 'blank': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'num_comments': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'null': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '64', 'null': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'resolved_at': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'db_index': 'True'}),
            'score': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'time_spent_count': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'time_spent_total': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1', 'db_index': 'True'}),
            'users_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'})
        },
        'sentry.groupbookmark': {
            'Meta': {'unique_together': "(('project', 'user', 'group'),)", 'object_name': 'GroupBookmark'},
            'group': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'bookmark_set'", 'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'bookmark_set'", 'to': "orm['sentry.Project']"}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'sentry_bookmark_set'", 'to': "orm['auth.User']"})
        },
        'sentry.groupcountbyminute': {
            'Meta': {'unique_together': "(('project', 'group', 'date'),)", 'object_name': 'GroupCountByMinute', 'db_table': "'sentry_messagecountbyminute'"},
            'date': ('django.db.models.fields.DateTimeField', [], {'db_index': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'time_spent_count': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'time_spent_total': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.groupmeta': {
            'Meta': {'unique_together': "(('group', 'key'),)", 'object_name': 'GroupMeta'},
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'value': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.grouptag': {
            'Meta': {'unique_together': "(('project', 'key', 'value', 'group'),)", 'object_name': 'GroupTag', 'db_table': "'sentry_messagefiltervalue'"},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.grouptagkey': {
            'Meta': {'unique_together': "(('project', 'group', 'key'),)", 'object_name': 'GroupTagKey'},
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'values_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.lostpasswordhash': {
            'Meta': {'object_name': 'LostPasswordHash'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'hash': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']", 'unique': 'True'})
        },
        'sentry.option': {
            'Meta': {'object_name': 'Option'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'}),
            'value': ('picklefield.fields.PickledObjectField', [], {})
        },
        'sentry.pendingteammember': {
            'Meta': {'unique_together': "(('team', 'email'),)", 'object_name': 'PendingTeamMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'team': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'pending_member_set'", 'to': "orm['sentry.Team']"}),
            'type': ('django.db.models.fields.IntegerField', [], {'default': '50'})
        },
        'sentry.project': {
            'Meta': {'unique_together': "(('team', 'slug'),)", 'object_name': 'Project'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'owner': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'sentry_owned_project_set'", 'null': 'True', 'to': "orm['auth.User']"}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True'}),
            'public': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'slug': ('django.db.models.fields.SlugField', [], {'max_length': '50', 'null': 'True'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'team': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Team']", 'null': 'True'})
        },
        'sentry.projectcountbyminute': {
            'Meta': {'unique_together': "(('project', 'date'),)", 'object_name': 'ProjectCountByMinute'},
            'date': ('django.db.models.fields.DateTimeField', [], {}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'time_spent_count': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'time_spent_total': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.projectkey': {
            'Meta': {'object_name': 'ProjectKey'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'key_set'", 'to': "orm['sentry.Project']"}),
            'public_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'secret_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']", 'null': 'True'}),
            'user_added': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'keys_added_set'", 'null': 'True', 'to': "orm['auth.User']"})
        },
        'sentry.projectoption': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'ProjectOption', 'db_table': "'sentry_projectoptions'"},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'value': ('picklefield.fields.PickledObjectField', [], {})
        },
        'sentry.searchdocument': {
            'Meta': {'unique_together': "(('project', 'group'),)", 'object_name': 'SearchDocument'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_changed': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'total_events': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'})
        },
        'sentry.searchtoken': {
            'Meta': {'unique_together': "(('document', 'field', 'token'),)", 'object_name': 'SearchToken'},
            'document': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'token_set'", 'to': "orm['sentry.SearchDocument']"}),
            'field': ('django.db.models.fields.CharField', [], {'default': "'text'", 'max_length': '64'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'}),
            'token': ('django.db.models.fields.CharField', [], {'max_length': '128'})
        },
        'sentry.tagkey': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'TagKey', 'db_table': "'sentry_filterkey'"},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'values_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.tagvalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value'),)", 'object_name': 'TagValue', 'db_table': "'sentry_filtervalue'"},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.team': {
            'Meta': {'object_name': 'Team'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'members': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "'team_memberships'", 'symmetrical': 'False', 'through': "orm['sentry.TeamMember']", 'to': "orm['auth.User']"}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'owner': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']"}),
            'slug': ('django.db.models.fields.SlugField', [], {'unique': 'True', 'max_length': '50'})
        },
        'sentry.teammember': {
            'Meta': {'unique_together': "(('team', 'user'),)", 'object_name': 'TeamMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'team': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'member_set'", 'to': "orm['sentry.Team']"}),
            'type': ('django.db.models.fields.IntegerField', [], {'default': '50'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'sentry_teammember_set'", 'to': "orm['auth.User']"})
        },
        'sentry.trackeduser': {
            'Meta': {'unique_together': "(('project', 'ident'),)", 'object_name': 'TrackedUser'},
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'null': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.Group']", 'through': "orm['sentry.AffectedUserByGroup']", 'symmetrical': 'False'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'ident': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'num_events': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"})
        },
        'sentry.useroption': {
            'Meta': {'unique_together': "(('user', 'project', 'key'),)", 'object_name': 'UserOption'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']"}),
            'value': ('picklefield.fields.PickledObjectField', [], {})
        }
    }

    complete_apps = ['sentry']