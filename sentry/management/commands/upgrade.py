"""
sentry.management.commands.upgrade
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Performs any pending database migrations and upgrades'

    def handle(self, **options):
        call_command('syncdb', migrate=True)
