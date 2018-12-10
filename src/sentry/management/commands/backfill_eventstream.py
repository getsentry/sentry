"""
sentry.management.commands.backfill_eventstream
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2018 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import sys

from django.core.management.base import BaseCommand, CommandError, make_option
from django.utils.dateparse import parse_datetime

from sentry.models import Event, Project, Group


class Command(BaseCommand):
    help = 'Backfill events from the database into the event stream.'

    option_list = BaseCommand.option_list + (
        make_option('--from-ts', dest='from_ts', type='string',
                    help='Starting event timestamp (ISO 8601). Example: 2018-11-26T23:59:59'),
        make_option('--to-ts', dest='to_ts', type='string',
                    help='Last event timestamp (ISO 8601).'),
        make_option('--from-id', dest='from_id', type=int,
                    help='Starting event ID (primary key).'),
        make_option('--to-id', dest='to_id', type=int,
                    help='Last event ID (primary key).'),
        make_option('--no-input', action='store_true', dest='no_input',
                    help='Do not ask questions.')
    )

    def get_events_by_timestamp(self, from_ts, to_ts):
        from_date = parse_datetime(from_ts)
        if not from_date:
            raise CommandError('Cannot parse --from-ts')
        to_date = parse_datetime(to_ts)
        if not to_date:
            raise CommandError('Cannot parse --to-ts')
        return Event.objects.filter(datetime__gte=from_date, datetime__lte=to_date)

    def get_events_by_id(self, from_id, to_id):
        if from_id > to_id:
            raise CommandError('Invalid ID range.')
        return Event.objects.filter(id__gte=from_id, id__lte=to_id)

    def handle(self, **options):

        def _attach_related(_events):
            project_ids = set([event.project_id for event in _events])
            projects = {p.id: p for p in Project.objects.filter(id__in=project_ids)}
            group_ids = set([event.group_id for event in _events])
            groups = {g.id: g for g in Group.objects.filter(id__in=group_ids)}
            for event in _events:
                event.project = projects[event.project_id]
                event.group = groups[event.group_id]
            Event.objects.bind_nodes(_events, 'data')

        from sentry import eventstream
        from sentry.utils.query import RangeQuerySetWrapper

        from_ts = options['from_ts']
        to_ts = options['to_ts']
        from_id = options['from_id']
        to_id = options['to_id']

        if (from_ts or to_ts) and (from_id or to_id):
            raise CommandError('You can either limit by primary key, or by timestamp.')
        elif from_ts and to_ts:
            events = self.get_events_by_timestamp(from_ts, to_ts)
        elif from_id and to_id:
            events = self.get_events_by_id(from_id, to_id)
        else:
            raise CommandError('Invalid arguments: either use --from/--to-id, or --from/--to-ts.')

        count = events.count()
        self.stdout.write('Events to process: {}\n'.format(count))

        if count == 0:
            self.stdout.write('Nothing to do.\n')
            sys.exit(0)

        if not options['no_input']:
            proceed = raw_input('Do you want to continue? [y/N] ')
            if proceed.lower() not in ['yes', 'y']:
                raise CommandError('Aborted.')

        for event in RangeQuerySetWrapper(events, step=100, callbacks=(_attach_related,)):
            primary_hash = event.get_primary_hash()
            eventstream.insert(
                group=event.group,
                event=event,
                is_new=False,
                is_sample=False,
                is_regression=False,
                is_new_group_environment=False,
                primary_hash=primary_hash,
                skip_consume=True,
            )

        self.stdout.write('Done.\n')
