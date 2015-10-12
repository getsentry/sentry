"""
sentry.management.commands.cleanup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from optparse import make_option

from sentry.app import nodestore
from sentry.db.deletion import BulkDeleteQuery
from sentry.models import (
    Event, EventMapping, Group, GroupRuleStatus, GroupTagValue,
    LostPasswordHash, TagValue, GroupEmailThread,
)


class Command(BaseCommand):
    help = 'Deletes a portion of trailing data based on creation date'

    option_list = BaseCommand.option_list + (
        make_option('--days', default='30', type=int, help='Numbers of days to truncate on.'),
        make_option('--project', type=int, help='Limit truncation to only entries from project.'),
        make_option('--concurrency', type=int, default=1, help='The number of concurrent workers to run.'),
    )

    # these models should be safe to delete without cascades, in order
    BULK_DELETES = (
        (GroupRuleStatus, 'date_added'),
        (GroupTagValue, 'last_seen'),
        (TagValue, 'last_seen'),
        (GroupEmailThread, 'date'),
    )

    GENERIC_DELETES = (
        (Event, 'datetime'),
        (Group, 'last_seen'),
    )

    def handle(self, **options):
        self.days = options['days']
        self.concurrency = options['concurrency']
        self.project = options['project']

        self.stdout.write("Removing expired values for LostPasswordHash\n")
        LostPasswordHash.objects.filter(
            date_added__lte=timezone.now() - timedelta(hours=48)
        ).delete()

        if self.project:
            self.stderr.write("Bulk NodeStore deletion not available for project selection\n")
        else:
            self.stdout.write("Removing old NodeStore values\n")
            cutoff = timezone.now() - timedelta(days=self.days)
            try:
                nodestore.cleanup(cutoff)
            except NotImplementedError:
                self.stderr.write("NodeStore backend does not support cleanup operation\n")

        for model, dtfield in self.BULK_DELETES:
            self.stdout.write("Removing {model} for days={days} project={project}\n".format(
                model=model.__name__,
                days=self.days,
                project=self.project or '*',
            ))
            BulkDeleteQuery(
                model=model,
                dtfield=dtfield,
                days=self.days,
                project_id=self.project,
            ).execute()

        # EventMapping is fairly expensive and is special cased as it's likely you
        # won't need a reference to an event for nearly as long
        self.stdout.write("Removing expired values for EventMapping\n")
        BulkDeleteQuery(
            model=EventMapping,
            dtfield='date_added',
            days=min(self.days, 7),
            project_id=self.project,
        ).execute()

        for model, dtfield in self.GENERIC_DELETES:
            self.stdout.write("Removing {model} for days={days} project={project}\n".format(
                model=model.__name__,
                days=self.days,
                project=self.project or '*',
            ))
            BulkDeleteQuery(
                model=model,
                dtfield=dtfield,
                days=self.days,
                project_id=self.project,
            ).execute_generic()
