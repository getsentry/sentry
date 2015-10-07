"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.db import connections, DEFAULT_DB_ALIAS
from django.db.models.fields.related import SingleRelatedObjectDescriptor


def get_db_engine(alias='default'):
    value = settings.DATABASES[alias]['ENGINE']
    if value == 'mysql.connector.django':
        return 'mysql'
    return value.rsplit('.', 1)[-1]


def is_postgres(alias='default'):
    engine = get_db_engine(alias)
    return 'postgres' in engine


def is_mysql(alias='default'):
    engine = get_db_engine(alias)
    return 'mysql' in engine


def is_sqlite(alias='default'):
    engine = get_db_engine(alias)
    return 'sqlite' in engine


def has_charts(db):
    if is_sqlite(db):
        return False
    return True


def attach_foreignkey(objects, field, related=[], database=None):
    """
    Shortcut method which handles a pythonic LEFT OUTER JOIN.

    ``attach_foreignkey(posts, Post.thread)``

    Works with both ForeignKey and OneToOne (reverse) lookups.
    """

    if not objects:
        return

    if database is None:
        database = list(objects)[0]._state.db

    is_foreignkey = isinstance(field, SingleRelatedObjectDescriptor)

    if not is_foreignkey:
        field = field.field
        accessor = '_%s_cache' % field.name
        model = field.rel.to
        lookup = 'pk'
        column = field.column
        key = lookup
    else:
        accessor = field.cache_name
        field = field.related.field
        model = field.model
        lookup = field.name
        column = 'pk'
        key = field.column

    objects = [o for o in objects if (related or getattr(o, accessor, False) is False)]

    if not objects:
        return

    # Ensure values are unique, do not contain already present values, and are not missing
    # values specified in select_related
    values = set(filter(None, (getattr(o, column) for o in objects)))
    if values:
        qs = model.objects
        if database:
            qs = qs.using(database)
        if related:
            qs = qs.select_related(*related)

        if len(values) > 1:
            qs = qs.filter(**{'%s__in' % lookup: values})
        else:
            qs = [qs.get(**{lookup: iter(values).next()})]

        queryset = dict((getattr(o, key), o) for o in qs)
    else:
        queryset = {}

    for o in objects:
        setattr(o, accessor, queryset.get(getattr(o, column)))


def table_exists(name, using=DEFAULT_DB_ALIAS):
    return name in connections[using].introspection.table_names()
