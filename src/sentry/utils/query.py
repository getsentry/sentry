"""
sentry.utils.query
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import progressbar
import six

from django.db import connections, IntegrityError, router, transaction
from django.db.models import ForeignKey
from django.db.models.deletion import Collector
from django.db.models.signals import pre_delete, pre_save, post_save, post_delete

from sentry.utils import db


class InvalidQuerySetError(ValueError):
    pass


class RangeQuerySetWrapper(object):
    """
    Iterates through a queryset by chunking results by ``step`` and using GREATER THAN
    and LESS THAN queries on the primary key.

    Very efficient, but ORDER BY statements will not work.
    """
    def __init__(self, queryset, step=1000, limit=None, min_id=None,
                 order_by='pk', callbacks=()):
        # Support for slicing
        if queryset.query.low_mark == 0 and not \
                (queryset.query.order_by or queryset.query.extra_order_by):
            if limit is None:
                limit = queryset.query.high_mark
            queryset.query.clear_limits()
        else:
            raise InvalidQuerySetError

        self.limit = limit
        if limit:
            self.step = min(limit, abs(step))
            self.desc = step < 0
        else:
            self.step = abs(step)
            self.desc = step < 0
        self.queryset = queryset
        self.min_value = min_id
        self.order_by = order_by
        self.callbacks = callbacks

    def __iter__(self):
        max_value = None
        if self.min_value is not None:
            cur_value = self.min_value
        else:
            cur_value = None

        num = 0
        limit = self.limit

        queryset = self.queryset
        if self.desc:
            queryset = queryset.order_by('-%s' % self.order_by)
        else:
            queryset = queryset.order_by(self.order_by)

        # we implement basic cursor pagination for columns that are not unique
        last_object = None
        has_results = True
        while has_results:
            if (max_value and cur_value >= max_value) or (limit and num >= limit):
                break

            start = num

            if cur_value is None:
                results = queryset
            elif self.desc:
                results = queryset.filter(**{'%s__lte' % self.order_by: cur_value})
            elif not self.desc:
                results = queryset.filter(**{'%s__gte' % self.order_by: cur_value})

            results = list(results[0:self.step])

            for cb in self.callbacks:
                cb(results)

            for result in results:
                if result == last_object:
                    continue

                yield result

                num += 1
                cur_value = getattr(result, self.order_by)
                last_object = result

            if cur_value is None:
                break

            has_results = num > start


class RangeQuerySetWrapperWithProgressBar(RangeQuerySetWrapper):
    def __iter__(self):
        total_count = self.queryset.count()
        if not total_count:
            return iter([])
        iterator = super(RangeQuerySetWrapperWithProgressBar, self).__iter__()
        label = self.queryset.model._meta.verbose_name_plural.title()
        return iter(WithProgressBar(iterator, total_count, label))


class WithProgressBar(object):
    def __init__(self, iterator, count=None, caption=None):
        if count is None and hasattr(iterator, '__len__'):
            count = len(iterator)
        self.iterator = iterator
        self.count = count
        self.caption = six.text_type(caption or u'Progress')

    def __iter__(self):
        if self.count != 0:
            widgets = [
                '%s: ' % (self.caption,),
                progressbar.Percentage(),
                ' ',
                progressbar.Bar(),
                ' ',
                progressbar.ETA(),
            ]
            pbar = progressbar.ProgressBar(widgets=widgets, maxval=self.count)
            pbar.start()
            for idx, item in enumerate(self.iterator):
                yield item
                pbar.update(idx)
            pbar.finish()


class EverythingCollector(Collector):
    """
    More or less identical to the default Django collector except we always
    return relations (even when they shouldn't matter).
    """
    def collect(self, objs, source=None, nullable=False, collect_related=True,
                source_attr=None, reverse_dependency=False):
        new_objs = self.add(objs)
        if not new_objs:
            return

        model = type(new_objs[0])

        # Recursively collect concrete model's parent models, but not their
        # related objects. These will be found by meta.get_all_related_objects()
        concrete_model = model._meta.concrete_model
        for ptr in six.iteritems(concrete_model._meta.parents):
            if ptr:
                # FIXME: This seems to be buggy and execute a query for each
                # parent object fetch. We have the parent data in the obj,
                # but we don't have a nice way to turn that data into parent
                # object instance.
                parent_objs = [getattr(obj, ptr.name) for obj in new_objs]
                self.collect(parent_objs, source=model,
                             source_attr=ptr.rel.related_name,
                             collect_related=False,
                             reverse_dependency=True)

        if collect_related:
            for related in model._meta.get_all_related_objects(
                    include_hidden=True, include_proxy_eq=True):
                sub_objs = self.related_objects(related, new_objs)
                self.add(sub_objs)

            # TODO This entire block is only needed as a special case to
            # support cascade-deletes for GenericRelation. It should be
            # removed/fixed when the ORM gains a proper abstraction for virtual
            # or composite fields, and GFKs are reworked to fit into that.
            for relation in model._meta.many_to_many:
                if not relation.rel.through:
                    sub_objs = relation.bulk_related_objects(new_objs, self.using)
                    self.collect(sub_objs,
                                 source=model,
                                 source_attr=relation.rel.related_name,
                                 nullable=True)


def merge_into(self, other, callback=lambda x: x, using='default'):
    """
    Collects objects related to ``self`` and updates their foreign keys to
    point to ``other``.

    If ``callback`` is specified, it will be executed on each collected chunk
    before any changes are made, and should return a modified list of results
    that still need updated.

    NOTE: Duplicates (unique constraints) which exist and are bound to ``other``
    are preserved, and relations on ``self`` are discarded.
    """
    # TODO: proper support for database routing
    s_model = type(self)

    # Find all the objects than need to be deleted.
    collector = EverythingCollector(using=using)
    collector.collect([self])

    for model, objects in six.iteritems(collector.data):
        # find all potential keys which match our type
        fields = set(
            f.name for f in model._meta.fields
            if isinstance(f, ForeignKey)
            and f.rel.to == s_model
            if f.rel.to
        )
        if not fields:
            # the collector pulls in the self reference, so if it's our model
            # we actually assume it's probably not related to itself, and its
            # perfectly ok
            if model == s_model:
                continue
            raise TypeError('Unable to determine related keys on %r' % model)

        for obj in objects:
            send_signals = not model._meta.auto_created

            # find fields which need changed
            update_kwargs = {}
            for f_name in fields:
                if getattr(obj, f_name) == self:
                    update_kwargs[f_name] = other

            if not update_kwargs:
                # as before, if we're referencing ourself, this is ok
                if obj == self:
                    continue
                raise ValueError('Mismatched row present in related results')

            signal_kwargs = {
                'sender': model,
                'instance': obj,
                'using': using,
                'migrated': True,
            }

            if send_signals:
                pre_delete.send(**signal_kwargs)
                post_delete.send(**signal_kwargs)

            for k, v in six.iteritems(update_kwargs):
                setattr(obj, k, v)

            if send_signals:
                pre_save.send(created=True, **signal_kwargs)

            try:
                with transaction.atomic(using=using):
                    model.objects.using(using).filter(pk=obj.pk).update(**update_kwargs)
            except IntegrityError:
                # duplicate key exists, destroy the relations
                model.objects.using(using).filter(pk=obj.pk).delete()

            if send_signals:
                post_save.send(created=True, **signal_kwargs)


def bulk_delete_objects(model, limit=10000, logger=None, **filters):
    connection = connections[router.db_for_write(model)]
    quote_name = connection.ops.quote_name

    query = []
    params = []
    for column, value in filters.items():
        query.append('%s = %%s' % (quote_name(column),))
        params.append(value)

    if logger is not None:
        logger.info('remove.%s' % model.__name__.lower(), extra={column: value})

    if db.is_postgres():
        query = """
            delete from %(table)s
            where id = any(array(
                select id
                from %(table)s
                where (%(query)s)
                limit %(limit)d
            ))
        """ % dict(
            query=' AND '.join(query),
            table=model._meta.db_table,
            limit=limit,
        )
    elif db.is_mysql():
        query = """
            delete from %(table)s
            where (%(query)s)
            limit %(limit)d
        """ % dict(
            query=' AND '.join(query),
            table=model._meta.db_table,
            limit=limit,
        )
    else:
        if logger is not None:
            logger.warning('Using slow deletion strategy due to unknown database')
        has_more = False
        for obj in model.objects.filter(**filters)[:limit]:
            obj.delete()
            has_more = True
        return has_more

    cursor = connection.cursor()
    cursor.execute(query, params)
    return cursor.rowcount > 0
