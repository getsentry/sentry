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
        make_option('--logger', help='Limit truncation to only entries from logger.'),
        make_option('--site', help='Limit truncation to only entries from site.'),
        make_option('--server', help='Limit truncation to only entries from server.'),
        make_option('--level', help='Limit truncation to only entries greater than or equal to level (e.g. DEBUG).'),
        make_option('--project', type=int, help='Limit truncation to only entries from project.'),
        make_option('--resolved', dest='resolved', action='store_true', help='Limit truncation to only entries that are resolved.'),
        make_option('--unresolved', dest='resolved', action='store_false', help='Limit truncation to only entries that are unresolved.'),
    )

    def handle(self, **options):
        import logging
        from sentry.tasks.cleanup import cleanup

        level = options['level']

        if level is not None and not str(level).isdigit():
            options['level'] = getattr(logging, level.upper())

        cleanup(days=options['days'], logger=options['logger'], site=options['site'], server=options['server'],
                level=options['level'], project=options['project'], resolved=options['resolved'])
