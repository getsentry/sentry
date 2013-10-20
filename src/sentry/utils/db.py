"""
sentry.utils.db
~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import django

from django.conf import settings
from django.db import connections, DEFAULT_DB_ALIAS
from django.db.models.fields.related import SingleRelatedObjectDescriptor


def get_db_engine(alias='default'):
    has_multidb = django.VERSION >= (1, 2)
    if has_multidb:
        value = settings.DATABASES[alias]['ENGINE']
    else:
        assert alias == 'default', 'You cannot fetch a database engine other than the default on Django < 1.2'
        value = settings.DATABASE_ENGINE
    return value.rsplit('.', 1)[-1]


def has_trending(alias='default'):
    # we only support trend queries for postgres to db optimization
    # issues in mysql, and lack of anything useful in sqlite
    return settings.SENTRY_USE_TRENDING and get_db_engine('default').startswith('postgres')


def has_charts(db):
    engine = get_db_engine(db)
    if engine.startswith('sqlite'):
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
