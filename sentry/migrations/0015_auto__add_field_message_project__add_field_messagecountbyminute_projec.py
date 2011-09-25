# encoding: utf-8
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):

    def forwards(self, orm):
        
        # Removing unique constraint on 'GroupedMessage', fields ['checksum', 'logger', 'view']
        db.delete_unique('sentry_groupedmessage', ['checksum', 'logger', 'view'])

        # Removing unique constraint on 'MessageFilterValue', fields ['group', 'value', 'key']
        db.delete_unique('sentry_messagefiltervalue', ['group_id', 'value', 'key'])

        # Removing unique constraint on 'FilterValue', fields ['value', 'key']
        db.delete_unique('sentry_filtervalue', ['value', 'key'])

        # Removing unique constraint on 'MessageCountByMinute', fields ['date', 'group']
        db.delete_unique('sentry_messagecountbyminute', ['date', 'group_id'])

        # Adding field 'Message.project'
        db.add_column('sentry_message', 'project', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['sentry.Project'], null=True), keep_default=False)

        # Adding field 'MessageCountByMinute.project'
        db.add_column('sentry_messagecountbyminute', 'project', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['sentry.Project'], null=True), keep_default=False)

        # Adding unique constraint on 'MessageCountByMinute', fields ['project', 'date', 'group']
        db.create_unique('sentry_messagecountbyminute', ['project_id', 'date', 'group_id'])

        # Adding field 'FilterValue.project'
        db.add_column('sentry_filtervalue', 'project', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['sentry.Project'], null=True), keep_default=False)

        # Adding unique constraint on 'FilterValue', fields ['project', 'value', 'key']
        db.create_unique('sentry_filtervalue', ['project_id', 'value', 'key'])

        # Adding field 'MessageFilterValue.project'
        db.add_column('sentry_messagefiltervalue', 'project', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['sentry.Project'], null=True), keep_default=False)

        # Adding unique constraint on 'MessageFilterValue', fields ['project', 'group', 'value', 'key']
        db.create_unique('sentry_messagefiltervalue', ['project_id', 'group_id', 'value', 'key'])

        # Adding field 'GroupedMessage.project'
        db.add_column('sentry_groupedmessage', 'project', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['sentry.Project'], null=True), keep_default=False)

        # Adding unique constraint on 'GroupedMessage', fields ['project', 'checksum', 'logger', 'view']
        db.create_unique('sentry_groupedmessage', ['project_id', 'checksum', 'logger', 'view'])


    def backwards(self, orm):
        
        # Removing unique constraint on 'GroupedMessage', fields ['project', 'checksum', 'logger', 'view']
        db.delete_unique('sentry_groupedmessage', ['project_id', 'checksum', 'logger', 'view'])

        # Removing unique constraint on 'MessageFilterValue', fields ['project', 'group', 'value', 'key']
        db.delete_unique('sentry_messagefiltervalue', ['project_id', 'group_id', 'value', 'key'])

        # Removing unique constraint on 'FilterValue', fields ['project', 'value', 'key']
        db.delete_unique('sentry_filtervalue', ['project_id', 'value', 'key'])

        # Removing unique constraint on 'MessageCountByMinute', fields ['project', 'date', 'group']
        db.delete_unique('sentry_messagecountbyminute', ['project_id', 'date', 'group_id'])

        # Deleting field 'Message.project'
        db.delete_column('sentry_message', 'project_id')

        # Deleting field 'MessageCountByMinute.project'
        db.delete_column('sentry_messagecountbyminute', 'project_id')

        # Adding unique constraint on 'MessageCountByMinute', fields ['date', 'group']
        db.create_unique('sentry_messagecountbyminute', ['date', 'group_id'])

        # Deleting field 'FilterValue.project'
        db.delete_column('sentry_filtervalue', 'project_id')

        # Adding unique constraint on 'FilterValue', fields ['value', 'key']
        db.create_unique('sentry_filtervalue', ['value', 'key'])

        # Deleting field 'MessageFilterValue.project'
        db.delete_column('sentry_messagefiltervalue', 'project_id')

        # Adding unique constraint on 'MessageFilterValue', fields ['group', 'value', 'key']
        db.create_unique('sentry_messagefiltervalue', ['group_id', 'value', 'key'])

        # Deleting field 'GroupedMessage.project'
        db.delete_column('sentry_groupedmessage', 'project_id')

        # Adding unique constraint on 'GroupedMessage', fields ['checksum', 'logger', 'view']
        db.create_unique('sentry_groupedmessage', ['checksum', 'logger', 'view'])


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
        'sentry.filtervalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value'),)", 'object_name': 'FilterValue'},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.groupedmessage': {
            'Meta': {'unique_together': "(('project', 'logger', 'view', 'checksum'),)", 'object_name': 'GroupedMessage'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'first_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_seen': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'score': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'status': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0', 'db_index': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '1', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'sentry.message': {
            'Meta': {'object_name': 'Message'},
            'checksum': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'class_name': ('django.db.models.fields.CharField', [], {'db_index': 'True', 'max_length': '128', 'null': 'True', 'blank': 'True'}),
            'data': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'datetime': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'blank': 'True', 'related_name': "'message_set'", 'null': 'True', 'to': "orm['sentry.GroupedMessage']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'level': ('django.db.models.fields.PositiveIntegerField', [], {'default': '40', 'db_index': 'True', 'blank': 'True'}),
            'logger': ('django.db.models.fields.CharField', [], {'default': "'root'", 'max_length': '64', 'db_index': 'True', 'blank': 'True'}),
            'message': ('django.db.models.fields.TextField', [], {}),
            'message_id': ('django.db.models.fields.CharField', [], {'max_length': '32', 'unique': 'True', 'null': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'server_name': ('django.db.models.fields.CharField', [], {'max_length': '128', 'db_index': 'True'}),
            'site': ('django.db.models.fields.CharField', [], {'max_length': '128', 'null': 'True', 'db_index': 'True'}),
            'traceback': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'url': ('django.db.models.fields.URLField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'}),
            'view': ('django.db.models.fields.CharField', [], {'max_length': '200', 'null': 'True', 'blank': 'True'})
        },
        'sentry.messagecountbyminute': {
            'Meta': {'unique_together': "(('project', 'group', 'date'),)", 'object_name': 'MessageCountByMinute'},
            'date': ('django.db.models.fields.DateTimeField', [], {}),
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.GroupedMessage']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        },
        'sentry.messagefiltervalue': {
            'Meta': {'unique_together': "(('project', 'key', 'value', 'group'),)", 'object_name': 'MessageFilterValue'},
            'group': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.GroupedMessage']"}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']", 'null': 'True'}),
            'times_seen': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '200'})
        },
        'sentry.messageindex': {
            'Meta': {'unique_together': "(('column', 'value', 'object_id'),)", 'object_name': 'MessageIndex'},
            'column': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'object_id': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'value': ('django.db.models.fields.CharField', [], {'max_length': '128'})
        },
        'sentry.project': {
            'Meta': {'object_name': 'Project'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '200'}),
            'owner': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']"}),
            'public': ('django.db.models.fields.BooleanField', [], {'default': 'False'})
        },
        'sentry.projectmember': {
            'Meta': {'unique_together': "(('project', 'user'),)", 'object_name': 'ProjectMember'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'permissions': ('django.db.models.fields.BigIntegerField', [], {}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['sentry.Project']"}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': "orm['auth.User']"})
        }
    }

    complete_apps = ['sentry']
