from __future__ import absolute_import, print_function

import sys

import six

from datetime import timedelta, datetime

from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_datetime

from sentry import eventstore
from sentry.models import Event, Project, Group


class Command(BaseCommand):
    help = "Backfill events from the database into the event stream."

    def add_arguments(self, parser):
        parser.add_argument(
            "--from-ts",
            dest="from_ts",
            type=six.text_type,
            help="Starting event timestamp (ISO 8601). Example: 2018-11-26T23:59:59",
        ),
        parser.add_argument(
            "--to-ts", dest="to_ts", type=six.text_type, help="Last event timestamp (ISO 8601)."
        ),
        parser.add_argument(
            "--last-days", dest="last_days", type=int, help="Events in the last X days"
        )
        parser.add_argument(
            "--from-id", dest="from_id", type=int, help="Starting event ID (primary key)."
        ),
        parser.add_argument("--to-id", dest="to_id", type=int, help="Last event ID (primary key)."),
        parser.add_argument(
            "--no-input", action="store_true", dest="no_input", help="Do not ask questions."
        )

    def get_events_by_timestamp(self, from_ts, to_ts):
        from_date = parse_datetime(from_ts)
        if not from_date:
            raise CommandError("Cannot parse --from-ts")
        to_date = parse_datetime(to_ts)
        if not to_date:
            raise CommandError("Cannot parse --to-ts")
        return Event.objects.filter(datetime__gte=from_date, datetime__lte=to_date)

    def get_events_by_last_days(self, last_days):
        to_date = datetime.now()
        from_date = to_date - timedelta(days=last_days)
        return Event.objects.filter(datetime__gte=from_date, datetime__lte=to_date)

    def get_events_by_id(self, from_id, to_id):
        if from_id > to_id:
            raise CommandError("Invalid ID range.")
        return Event.objects.filter(id__gte=from_id, id__lte=to_id)

    def handle(
        self,
        from_ts=None,
        to_ts=None,
        last_days=None,
        from_id=None,
        to_id=None,
        no_input=False,
        **options
    ):
        def _attach_related(_events):
            project_ids = set([event.project_id for event in _events])
            projects = {p.id: p for p in Project.objects.filter(id__in=project_ids)}
            group_ids = set([event.group_id for event in _events])
            groups = {g.id: g for g in Group.objects.filter(id__in=group_ids)}
            for event in _events:
                event.project = projects[event.project_id]
                event.group = groups[event.group_id]
            eventstore.bind_nodes(_events, "data")

        from sentry import eventstream
        from sentry.utils.query import RangeQuerySetWrapper

        filter_methods = bool(last_days) + bool(from_ts or to_ts) + bool(from_id or to_id)
        if filter_methods > 1:
            raise CommandError(
                "You can either limit by primary key, or by timestamp, or last X days."
            )
        elif from_ts and to_ts:
            events = self.get_events_by_timestamp(from_ts, to_ts)
        elif last_days:
            events = self.get_events_by_last_days(last_days)
        elif from_id and to_id:
            events = self.get_events_by_id(from_id, to_id)
        else:
            raise CommandError(
                "Invalid arguments: either use --from/--to-id, or --from/--to-ts, or --last-days."
            )

        count = events.count()
        self.stdout.write("Events to process: {}\n".format(count))

        if count == 0:
            self.stdout.write("Nothing to do.\n")
            sys.exit(0)

        if not no_input:
            proceed = six.moves.input("Do you want to continue? [y/N] ")
            if proceed.strip().lower() not in ["yes", "y"]:
                raise CommandError("Aborted.")

        for event in RangeQuerySetWrapper(events, step=100, callbacks=(_attach_related,)):
            primary_hash = event.get_primary_hash()
            eventstream.insert(
                group=event.group,
                event=event,
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                primary_hash=primary_hash,
                skip_consume=True,
            )

        self.stdout.write("Done.\n")
