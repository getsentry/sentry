# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Key'
        db.create_table(u'tsdb_key', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(unique=True, max_length=1000)),
            ('label', self.gf('django.db.models.fields.CharField')(max_length=1000, null=True)),
        ))
        db.send_create_signal(u'tsdb', ['Key'])

        # Adding model 'Point'
        db.create_table(u'tsdb_point', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('key', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['tsdb.Key'])),
            ('value', self.gf('django.db.models.fields.PositiveIntegerField')(default=0)),
            ('epoch', self.gf('django.db.models.fields.PositiveIntegerField')()),
            ('granularity', self.gf('django.db.models.fields.PositiveIntegerField')()),
        ))
        db.send_create_signal(u'tsdb', ['Point'])


    def backwards(self, orm):
        # Deleting model 'Key'
        db.delete_table(u'tsdb_key')

        # Deleting model 'Point'
        db.delete_table(u'tsdb_point')


    models = {
        u'tsdb.key': {
            'Meta': {'object_name': 'Key'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'label': ('django.db.models.fields.CharField', [], {'max_length': '1000', 'null': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '1000'})
        },
        u'tsdb.point': {
            'Meta': {'object_name': 'Point'},
            'epoch': ('django.db.models.fields.PositiveIntegerField', [], {}),
            'granularity': ('django.db.models.fields.PositiveIntegerField', [], {}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'key': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['tsdb.Key']"}),
            'value': ('django.db.models.fields.PositiveIntegerField', [], {'default': '0'})
        }
    }

    complete_apps = ['tsdb']