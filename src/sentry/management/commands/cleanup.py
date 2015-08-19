"""
sentry.management.commands.cleanup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import connections
from django.utils import timezone
from optparse import make_option

from sentry.app import nodestore
from sentry.models import (
    Activity, Event, EventMapping, Group, GroupRuleStatus, GroupTagValue,
    LostPasswordHash, TagValue
)
from sentry.utils import db
from sentry.utils.threadpool import ThreadPool


def delete_object(item):
    item.delete()


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
        (Activity, 'datetime'),
        (TagValue, 'last_seen'),
    )

    GENERIC_DELETES = (
        (Event, 'datetime'),
        (Group, 'last_seen'),
    )

    def _postgres_bulk_speed_delete(self, model, dtfield, days=None,
                                    chunk_size=100000):
        """
        Cleanup models which we know dont need expensive (in-app) cascades or
        cache handling.

        This chunks up delete statements but still does them in bulk.
        """
        cursor = connections['default'].cursor()
        quote_name = connections['default'].ops.quote_name

        if days is None:
            days = self.days

        if self.project:
            where_extra = 'and project_id = %d' % (self.project,)
        else:
            where_extra = ''

        keep_it_going = True
        while keep_it_going:
            cursor.execute("""
            delete from %(table)s
            where id = any(array(
                select id
                from %(table)s
                where %(dtfield)s < now() - interval '%(days)d days'
                %(where_extra)s
                limit %(chunk_size)d
            ));
            """ % dict(
                table=model._meta.db_table,
                dtfield=quote_name(dtfield),
                days=days,
                where_extra=where_extra,
                chunk_size=chunk_size,
            ))
            keep_it_going = cursor.rowcount > 0

    def bulk_delete(self, model, dtfield, days=None):
        if db.is_postgres():
            self._postgres_bulk_speed_delete(model, dtfield, days=days)
        else:
            self.generic_delete(model, dtfield, days=days)

    def generic_delete(self, model, dtfield, days=None, chunk_size=1000):
        if days is None:
            days = self.days

        cutoff = timezone.now() - timedelta(days=days)

        qs = model.objects.filter(**{'%s__lte' % (dtfield,): cutoff})
        if self.project:
            qs = qs.filter(project=self.project)

        # XXX: we step through because the deletion collector will pull all
        # relations into memory
        count = 0
        while qs.exists():
            # TODO(dcramer): change this to delete by chunks of IDs and utilize
            # bulk_delete_objects
            self.stdout.write("Removing {model} chunk {count}\n".format(
                model=model.__name__,
                count=count,
            ))
            if self.concurrency > 1:
                worker_pool = ThreadPool(workers=self.concurrency)
                for obj in qs[:chunk_size].iterator():
                    worker_pool.add(obj.id, delete_object, [obj])
                    count += 1
                worker_pool.join()
                del worker_pool
            else:
                for obj in qs[:chunk_size].iterator():
                    delete_object(obj)
                    count += 1

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
            self.bulk_delete(model, dtfield)

        for model, dtfield in self.GENERIC_DELETES:
            self.stdout.write("Removing {model} for days={days} project={project}\n".format(
                model=model.__name__,
                days=self.days,
                project=self.project or '*',
            ))
            self.generic_delete(model, dtfield)

        # EventMapping is fairly expensive and is special cased as it's likely you
        # won't need a reference to an event for nearly as long
        self.stdout.write("Removing expired values for EventMapping\n")
        self.bulk_delete(EventMapping, 'date_added', days=min(self.days, 7))
