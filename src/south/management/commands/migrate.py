# Mimic syncdb for Django 1.7 compatibility
from __future__ import absolute_import

from django.core.management.commands import syncdb
from optparse import make_option

from .syncdb import Command as SyncDbCommand  # NOQA


class Command(SyncDbCommand):
    option_list = SyncDbCommand.option_list + (
        make_option('--no-migrate', action='store_false', dest='migrate', default=True,
                    help='Tells South to disable migrations after the sync. Default for during testing, and other internal calls.'),
    )
