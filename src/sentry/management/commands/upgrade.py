"""
sentry.management.commands.upgrade
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.core.management import call_command
from django.core.management.base import BaseCommand

from optparse import make_option


class Command(BaseCommand):
    help = 'Performs any pending database migrations and upgrades'

    option_list = BaseCommand.option_list + (
        make_option('--noinput',
            action='store_true',
            dest='noinput',
            default=False,
            help='Tells Django to NOT prompt the user for input of any kind.',
        ),
    )

    def handle(self, **options):
        call_command(
            'syncdb',
            migrate=True,
            interactive=(not options['noinput']),
            traceback=options['traceback'],
            verbosity=options['verbosity'],
        )
        call_command(
            'load_help_pages',
            traceback=options['traceback'],
            verbosity=options['verbosity'],
        )
