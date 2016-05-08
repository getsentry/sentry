# encoding: utf-8
import datetime
from south.db import db
from south.v2 import DataMigration
from django.db import models

class Migration(DataMigration):

    def forwards(self, orm):
        "Write your forwards methods here."
        for project in orm['sentry.Project'].objects.all():
            if not project.owner:
                continue

            if not project.team:
                team = orm['sentry.Team'].objects.create(
                    owner=project.owner,
                    slug=project.slug,
                    name=project.name,
                )
                project.team = team
                project.save()
            else:
                team = project.team

            for member in project.member_set.all():
                if not member.user:
                    continue
                tm = orm['sentry.TeamMember'].objects.create(
                    team=team,
                    user=member.user,
                )
                key = orm['sentry.ProjectKey'].objects.get_or_create(
                    project=project,
                    user=tm.user,
                )[0]

    def backwards(self, orm):
        "Write your backwards methods here."


    models = {
        'sentry.user': {
            'Meta': {'object_name': 'User', 'db_table': "'auth_user'"},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2012, 4, 5, 3, 30, 7, 526220)'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'first_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime(2012, 4, 5, 3, 30, 7, 526083)'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '30'})
        },
        'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        'sentry.event': {
            'Meta': {'unique_together': "(('project', 'event_id'),)", 'object_name': 'Event', 'db_table': "'sentry_message'"},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'db_column': "'view'", 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'event_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'db_column': "'message_id'"}),
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'blank': 'True', 'related_name': "'event_set'", 'null': 'True', 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'site': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'time_spent': ('django.db.models.fields.FloatField', [], {'null': 'True'})
        },
        'sentry.filtervalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value'),)", 'object_name': 'FilterValue'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.group': {
            'Meta': {'unique_together': "(('project', 'logger', 'culprit', 'checksum'),)", 'object_name': 'Group', 'db_table': "'sentry_groupedmessage'"},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32', 'db_index': 'True'}),
            'culprit': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'db_column': "'view'", 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'score': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'time_spent_count': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'time_spent_total': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1', 'db_index': 'True'}),
            'views': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['sentry.View']", 'symmetrical': 'False', 'blank': 'True'})
        },
        'sentry.groupbookmark': {
            'Meta': {'unique_together': "(('project', 'user', 'group'),)", 'object_name': 'GroupBookmark'},
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'bookmark_set'", 'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'bookmark_set'", 'to': "orm['sentry.Project']"}),
            'user': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'sentry_bookmark_set'", 'to': "orm['sentry.User']"})
        },
        'sentry.groupmeta': {
            'Meta': {'unique_together': "(('group', 'key'),)", 'object_name': 'GroupMeta'},
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'value': ('django.db.models.fields.TextField', [], {})
        },
        'sentry.messagecountbyminute': {
            'Meta': {'unique_together': "(('project', 'group', 'date'),)", 'object_name': 'MessageCountByMinute'},
            'date': ('django.db.models.fields.DateTimeField', [], {}),
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'time_spent_count': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'time_spent_total': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.messagefiltervalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value', 'group'),)", 'object_name': 'MessageFilterValue'},
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'null': 'True', 'db_index': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.messageindex': {
            'Meta': {'unique_together': "(('column', 'value', 'object_id'),)", 'object_name': 'MessageIndex'},
            'column': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'object_id': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '128'})
        },
        'sentry.option': {
            'Meta': {'object_name': 'Option'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '64'}),
            'value': ('picklefield.fields.PickledObjectField', [], {})
        },
        'sentry.pendingteammember': {
            'Meta': {'unique_together': "(('team', 'email'),)", 'object_name': 'PendingTeamMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'team': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'pending_member_set'", 'to': "orm['sentry.Team']"}),
            'type': ('django.db.models.fields.IntegerField', [], {'default': '0'})
        },
        'sentry.project': {
            'Meta': {'object_name': 'Project'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'owner': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'sentry_owned_project_set'", 'null': 'True', 'to': "orm['sentry.User']"}),
            'public': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'slug': ('django.db.models.fields.SlugField', [], {'max_length': '50', 'unique': 'True', 'null': 'True', 'db_index': 'True'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'team': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Team']", 'null': 'True'})
        },
        'sentry.projectcountbyminute': {
            'Meta': {'unique_together': "(('project', 'date'),)", 'object_name': 'ProjectCountByMinute'},
            'date': ('django.db.models.fields.DateTimeField', [], {}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'time_spent_count': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'time_spent_total': ('django.db.models.fields.FloatField', [], {'default': '0'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.projectdomain': {
            'Meta': {'unique_together': "(('project', 'domain'),)", 'object_name': 'ProjectDomain'},
            'domain': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'domain_set'", 'to': "orm['sentry.Project']"})
        },
        'sentry.projectkey': {
            'Meta': {'object_name': 'ProjectKey'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'key_set'", 'to': "orm['sentry.Project']"}),
            'public_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'secret_key': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'user': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.User']", 'null': 'True'})
        },
        'sentry.projectmember': {
            'Meta': {'unique_together': "(('project', 'user'),)", 'object_name': 'ProjectMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'member_set'", 'to': "orm['sentry.Project']"}),
            'type': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'user': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'sentry_project_set'", 'to': "orm['sentry.User']"})
        },
        'sentry.projectoption': {
            'Meta': {'unique_together': "(('project', 'key'),)", 'object_name': 'ProjectOption', 'db_table': "'sentry_projectoptions'"},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'value': ('picklefield.fields.PickledObjectField', [], {})
        },
        'sentry.searchdocument': {
            'Meta': {'unique_together': "(('project', 'group'),)", 'object_name': 'SearchDocument'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'date_changed': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'group': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Group']"}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'project': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.Project']"}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'total_events': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'})
        },
        'sentry.searchtoken': {
            'Meta': {'unique_together': "(('document', 'field', 'token'),)", 'object_name': 'SearchToken'},
            'document': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'token_set'", 'to': "orm['sentry.SearchDocument']"}),
            'field': ('django.db.models.fields.CharField', [], {'default': "'text'", 'max_length': '64'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1'}),
            'token': ('django.db.models.fields.CharField', [], {'max_length': '128'})
        },
        'sentry.team': {
            'Meta': {'object_name': 'Team'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'owner': ('sentry.db.models.fields.FlexibleForeignKey', [], {'to': "orm['sentry.User']"}),
            'slug': ('django.db.models.fields.SlugField', [], {'unique': 'True', 'max_length': '50', 'db_index': 'True'})
        },
        'sentry.teammember': {
            'Meta': {'unique_together': "(('team', 'user'),)", 'object_name': 'TeamMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'team': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'member_set'", 'to': "orm['sentry.Team']"}),
            'type': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'user': ('sentry.db.models.fields.FlexibleForeignKey', [], {'related_name': "'sentry_teammember_set'", 'to': "orm['sentry.User']"})
        },
        'sentry.view': {
            'Meta': {'object_name': 'View'},
            'id': ('sentry.db.models.fields.bounded.BoundedBigAutoField', [], {'primary_key': 'True'}),
            'path': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '100'}),
            'verbose_name': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True'}),
            'verbose_name_plural': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True'})
        }
    }

    complete_apps = ['sentry']
