"""
sentry.utils.query
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import transaction, IntegrityError
from django.db.models import ForeignKey
from django.db.models.deletion import Collector
from django.db.models.query import QuerySet
from django.db.models.signals import pre_delete, pre_save, post_save, post_delete


class QuerySetDoubleIteration(Exception):
    "A QuerySet was iterated over twice, you probably want to list() it."
    pass


class InvalidQuerySetError(ValueError):
    pass


class SkinnyQuerySet(QuerySet):
    def __len__(self):
        if getattr(self, 'has_run_before', False):
            raise TypeError("SkinnyQuerySet doesn't support __len__ after __iter__, if you *only* need a count you should use .count(), if you need to reuse the results you should coerce to a list and then len() that.")
        return super(SkinnyQuerySet, self).__len__()

    def __iter__(self):
        if self._result_cache is not None:
            # __len__ must have been run
            return iter(self._result_cache)

        has_run_before = getattr(self, 'has_run_before', False)
        if has_run_before:
            raise QuerySetDoubleIteration("This SkinnyQuerySet has already been iterated over once, you should assign it to a list if you want to reuse the data.")
        self.has_run_before = True

        return self.iterator()

    def list(self):
        return list(self)


class RangeQuerySetWrapper(object):
    """
    Iterates through a queryset by chunking results by ``step`` and using GREATER THAN
    and LESS THAN queries on the primary key.

    Very efficient, but ORDER BY statements will not work.
    """

    def __init__(self, queryset, step=1000, limit=None, min_id=None,
                 order_by='pk'):
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
        last_value = None
        offset = 0
        has_results = True
        while ((max_value and cur_value <= max_value) or has_results) and (not self.limit or num < self.limit):
            start = num

            if cur_value is None:
                results = queryset
            elif self.desc:
                results = queryset.filter(**{'%s__lte' % self.order_by: cur_value})
            elif not self.desc:
                results = queryset.filter(**{'%s__gte' % self.order_by: cur_value})

            results = results[offset:offset + self.step].iterator()

            for result in results:
                yield result

                num += 1
                cur_value = getattr(result, self.order_by)
                if cur_value == last_value:
                    offset += 1
                else:
                    # offset needs to be based at 1 so we don't return a row
                    # that was already selected
                    last_value = cur_value
                    offset = 1

                if (max_value and cur_value >= max_value) or (limit and num >= limit):
                    break

            if cur_value is None:
                break

            has_results = num > start


class EverythingCollector(Collector):
    """
    More or less identical to the default Django collector except we always
    return relations (even when they shouldnt matter).
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
        for ptr in concrete_model._meta.parents.iteritems():
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

    for model, objects in collector.data.iteritems():
        # find all potential keys which match our type
        fields = set(
            f.name for f in model._meta.fields
            if isinstance(f, ForeignKey)
            and f.rel.to == s_model
            if f.rel.to
        )
        print model, objects, fields
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

            for k, v in update_kwargs.iteritems():
                setattr(obj, k, v)

            if send_signals:
                pre_save.send(created=True, **signal_kwargs)

            sid = transaction.savepoint(using=using)

            try:
                model.objects.filter(pk=obj.pk).update(**update_kwargs)
            except IntegrityError:
                # duplicate key exists, destroy the relations
                transaction.savepoint_rollback(sid, using=using)
                model.objects.filter(pk=obj.pk).delete()
            else:
                transaction.savepoint_commit(sid, using=using)

            if send_signals:
                post_save.send(created=True, **signal_kwargs)


class Savepoint(object):
    def __init__(self, using='default'):
        self.using = using

    def __enter__(self):
        self.sid = transaction.savepoint(using=self.using)

    def __exit__(self, *exc_info):
        if exc_info:
            transaction.savepoint_rollback(self.sid, using=self.using)
        else:
            transaction.savepoint_commit(self.sid, using=self.using)
