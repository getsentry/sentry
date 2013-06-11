"""
sentry.management.commands.cleanup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.management.base import BaseCommand
from optparse import make_option


class Command(BaseCommand):
    help = 'Performs any pending database migrations and upgrades'

    option_list = BaseCommand.option_list + (
        make_option('--days', default='30', type=int, help='Numbers of days to truncate on.'),
        make_option('--project', type=int, help='Limit truncation to only entries from project.'),
    )

    def handle(self, **options):
        import logging
        from sentry.tasks.cleanup import cleanup

        if options['verbosity'] > 1:
            logger = cleanup.get_logger()
            logger.setLevel(logging.DEBUG)
            logger.addHandler(logging.StreamHandler())

        cleanup(days=options['days'], project=options['project'])
