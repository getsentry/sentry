"""
sentry.models.counter
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import connection

from sentry.db.models import (
    FlexibleForeignKey, Model, sane_repr, BoundedBigIntegerField
)
from sentry.utils import db


class Counter(Model):
    """
    A ReleaseFile is an association between a Release and a File.

    The ident of the file should be sha1(name) and must be unique per release.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', unique=True)
    value = BoundedBigIntegerField()

    __repr__ = sane_repr('project')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectcounter'

    @classmethod
    def increment(cls, project, delta=1):
        """Increments a counter.  This can never decrement."""
        return increment_project_counter(project, delta)


def increment_project_counter(project, delta=1):
    """This method primarily exists so that south code can use it."""
    if delta <= 0:
        raise ValueError('There is only one way, and that\'s up.')

    cur = connection.cursor()
    try:
        if db.is_postgres():
            cur.execute('''
                select sentry_increment_project_counter(%s, %s)
            ''', [project.id, delta])
            return cur.fetchone()[0]
        elif db.is_sqlite():
            value = cur.execute('''
                insert or ignore into sentry_projectcounter
                  (project_id, value) values (%s, 0);
            ''', [project.id])
            value = cur.execute('''
                select value from sentry_projectcounter
                 where project_id = %s
            ''', [project.id]).fetchone()[0]
            while 1:
                cur.execute('''
                    update sentry_projectcounter
                       set value = value + %s
                     where project_id = %s;
                ''', [delta, project.id])
                changes = cur.execute('''
                    select changes();
                ''').fetchone()[0]
                if changes != 0:
                    return value + delta
        elif db.is_mysql():
            cur.execute('''
                insert into sentry_projectcounter
                            (project_id, value)
                     values (%s, @new_val := %s)
           on duplicate key
                     update value = @new_val := value + %s
            ''', [project.id, delta, delta])
            cur.execute('select @new_val')
            return cur.fetchone()[0]
        else:
            raise AssertionError("Not implemented database engine path")
    finally:
        cur.close()
