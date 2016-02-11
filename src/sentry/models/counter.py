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

    @classmethod
    def increment(cls, project, name, delta=1):
        """Increments a counter.  This can never decrement."""
        if delta <= 0:
            raise ValueError('There is only one way, and that\'s up.')

        cur = connection.cursor()
        try:
            if db.is_postgres():
                return cur.execute('''
                    select sentry_increment_project_counter(%s, %s, %s)
                ''', [project.id, name, delta]).fetchone()[0]
            elif db.is_sqlite():
                value = cur.execute('''
                    insert or ignore into sentry_projectcounter
                      (project_id, ident, value) values (%s, %s, 0);
                ''', [project.id, name])
                value = cur.execute('''
                    select value from sentry_projectcounter
                     where project_id = %s and ident = %s
                ''', [project.id, name]).fetchone()[0]
                while 1:
                    cur.execute('''
                        update sentry_projectcounter
                           set value = value + %s
                         where project_id = %s and ident = %s;
                    ''', [delta, project.id, name])
                    changes = cur.execute('''
                        select changes();
                    ''').fetchone()[0]
                    if changes != 0:
                        return value + delta
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
        finally:
            cur.close()
