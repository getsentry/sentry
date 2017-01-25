"""
sentry.buffer.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import json
import logging
import six

from django.db import connection, IntegrityError, transaction

from sentry.signals import buffer_incr_complete
from sentry.tasks.process_buffer import process_incr


class BufferMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        new_cls.logger = logging.getLogger('sentry.buffer.%s' % (new_cls.__name__.lower(),))
        return new_cls


@six.add_metaclass(BufferMount)
class Buffer(object):
    """
    Buffers act as temporary stores for counters. The default implementation is just a passthru and
    does not actually buffer anything.

    A useful example might be a Redis buffer. Each time an event gets updated, we send several
    add events which just store a key and increment its value. Additionally they fire off a task
    to the queue. That task eventually runs and gets the current update value. If the value is
    empty, it does nothing, otherwise it updates the row in the database.

    This is useful in situations where a single event might be happening so fast that the queue cant
    keep up with the updates.
    """

    def incr(self, model, columns, filters, extra=None):
        """
        >>> incr(Group, columns={'times_seen': 1}, filters={'pk': group.pk})
        """
        process_incr.apply_async(kwargs={
            'model': model,
            'columns': columns,
            'filters': filters,
            'extra': extra,
        })

    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def process_pending(self):
        return []

    def get_where_clause_and_values(self, filters):
        filter_sql = []
        filter_vals = []
        for col, val in six.iteritems(filters):
            filter_sql.append('%s = %s' % (col, '%s'))
            filter_vals.append(val)
        sql = 'WHERE %s' % (' AND '.join(filter_sql),)
        return sql, filter_vals

    def get_update_sql_and_vals(self, model, columns, filters, extra=None):
        from sentry.event_manager import ScoreClause

        update_strings = []
        update_values = []
        for col, val in six.iteritems(columns):
            update_strings.append('%s = COALESCE(%s, 0) + %s' % (col, col, '%s'))
            update_values.append(val)
        if extra:
            for k, v in six.iteritems(extra):
                if isinstance(v, ScoreClause):
                    update_strings.append('%s = %s' % (k, v.get_sql()))
                else:
                    update_strings.append('%s = %s' % (k, '%s'))
                    if isinstance(v, dict) or isinstance(v, list):
                        v = json.dumps(v)
                    update_values.append(v)

        where_clause, where_vals = self.get_where_clause_and_values(filters)
        sql = 'UPDATE %s SET %s %s' % (model._meta.db_table,
                                    ', '.join(update_strings),
                                    where_clause)
        update_values.extend(where_vals)
        return sql, update_values

    def process(self, model, columns, filters, extra=None):
        create_kwargs = columns.copy()
        create_kwargs.update(filters)
        if extra:
            create_kwargs.update(extra)

        cursor = connection.cursor()
        try:
            with transaction.atomic():
                model.objects.create(**create_kwargs)
                created = True
        except IntegrityError:
            cursor.execute(
                *self.get_update_sql_and_vals(model, columns, filters, extra)
            )
            created = False

        buffer_incr_complete.send_robust(
            model=model,
            columns=columns,
            filters=filters,
            extra=extra,
            created=created,
            sender=model,
        )
