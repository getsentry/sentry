# encoding: utf-8
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models

class Migration(SchemaMigration):

    def forwards(self, orm):
        # Removing unique constraint on 'GroupedMessage', fields ['logger', 'view', 'checksum']
        try:
            db.delete_unique('sentry_groupedmessage', ['logger', 'view', 'checksum'])
        except Exception:
            db.rollback_transaction()


    def backwards(self, orm):
        # Adding unique constraint on 'GroupedMessage', fields ['logger', 'view', 'checksum']
        db.create_unique('sentry_groupedmessage', ['logger', 'view', 'checksum'])
