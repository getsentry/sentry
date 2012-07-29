# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Removing unique constraint on 'GroupedMessage', fields ['logger', 'view', 'checksum']
        # FIXES 0015
        try:
            db.delete_unique('sentry_groupedmessage', ['logger', 'view', 'checksum'])
        except:
            # TODO: we should probaby remove this since it seems to only affect previous installs that
            # hadnt applied migrations, and MySQL doesnt like try/excepts (aka South)
            pass

    def backwards(self, orm):
        # Adding unique constraint on 'GroupedMessage', fields ['checksum', 'logger', 'view']
        #FIXES 0015
        db.create_unique('sentry_groupedmessage', ['checksum', 'logger', 'view'])

    complete_apps = ['sentry']
