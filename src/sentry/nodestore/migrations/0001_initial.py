# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Node'
        db.create_table(u'nodestore_node', (
            ('id', self.gf('django.db.models.fields.CharField')(unique=True, max_length=40, primary_key=True)),
            ('data', self.gf('sentry.db.models.fields.gzippeddict.GzippedDictField')()),
            ('timestamp', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now, db_index=True)),
        ))
        db.send_create_signal('nodestore', ['Node'])


    def backwards(self, orm):
        # Deleting model 'Node'
        db.delete_table(u'nodestore_node')


    models = {
        'nodestore.node': {
            'Meta': {'object_name': 'Node'},
            'data': ('sentry.db.models.fields.gzippeddict.GzippedDictField', [], {}),
            'id': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '40', 'primary_key': 'True'}),
            'timestamp': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now', 'db_index': 'True'})
        }
    }

    complete_apps = ['nodestore']
