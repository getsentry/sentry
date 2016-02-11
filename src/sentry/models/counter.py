"""
sentry.models.counter
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models, connection

from sentry.db.models import (
    FlexibleForeignKey, Model, sane_repr, BoundedPositiveIntegerField
)
from sentry.utils import db


class Counter(Model):
    """
    A ReleaseFile is an association between a Release and a File.

    The ident of the file should be sha1(name) and must be unique per release.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    ident = models.CharField(max_length=40)
    value = BoundedPositiveIntegerField()

    __repr__ = sane_repr('project', 'ident')

    class Meta:
        unique_together = (('project', 'ident'),)
        app_label = 'sentry'
        db_table = 'sentry_projectcounter'


def increment_counter(project, name, delta=1):
    """Increments a counter.  This can never decrement."""
    if delta <= 0:
        raise ValueError('There is only one way, and that\'s up.')

    cur = connection.cursor()

    if db.is_postgres():
        cur.execute('''
            select sentry_increment_project_counter(%s, %s, %s)
        ''', [project.id, name, delta])
    elif db.is_sqlite():
        pass
    elif db.is_mysql():
        cur.execute('''
            insert into sentry_projectcounter
                        (project_id, ident, value)
                 values (%s, %s, @new_val := %s)
       on duplicate key
                 update value = @new_val := value + %s;
                 select @new_val;
        ''', [project.id, name, delta, delta])
        return cur.fetchone()[0]
    else:
        raise AssertionError("Not implemented database engine path")
