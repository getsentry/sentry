# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Node'
        db.create_table(u'nodestore_node', (
            ('id', self.gf('uuidfield.fields.UUIDField')(unique=True, max_length=32, primary_key=True)),
            ('data', self.gf('django.db.models.fields.TextField')()),
            ('timestamp', self.gf('django.db.models.fields.DateTimeField')(default=datetime.datetime.now)),
        ))
        db.send_create_signal('nodestore', ['Node'])


    def backwards(self, orm):
        # Deleting model 'Node'
        db.delete_table(u'nodestore_node')


    models = {
        'nodestore.node': {
            'Meta': {'object_name': 'Node'},
            'data': ('django.db.models.fields.TextField', [], {}),
            'id': ('uuidfield.fields.UUIDField', [], {'unique': 'True', 'max_length': '32', 'primary_key': 'True'}),
            'timestamp': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'})
        }
    }

    complete_apps = ['nodestore']