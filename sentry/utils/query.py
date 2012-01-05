"""
sentry.utils.query
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db.models import Min, Max
from django.db.models.fields import AutoField, IntegerField
from django.db.models.query import QuerySet


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
    Iterates through a result set using MIN/MAX on primary key and stepping through.

    Very efficient, but ORDER BY statements will not work.
    """

    def __init__(self, queryset, step=10000, limit=None, min_id=None, max_id=None, sorted=False):
        # Support for slicing
        if queryset.query.low_mark == 0 and not\
          (queryset.query.order_by or queryset.query.extra_order_by):
            if limit is None:
                limit = queryset.query.high_mark
            queryset.query.clear_limits()
        else:
            raise InvalidQuerySetError

        self.limit = limit
        if limit:
            self.step = min(limit, step)
        else:
            self.step = step
        self.queryset = queryset
        self.min_id, self.max_id = min_id, max_id
        self.sorted = sorted

    def __iter__(self):
        pk = self.queryset.model._meta.pk
        if not isinstance(pk, (IntegerField, AutoField)):
            raise NotImplementedError
        else:
            if self.min_id is not None and self.max_id is not None:
                at, max_id = self.min_id, self.max_id
            else:
                at = self.queryset.aggregate(Min('pk'), Max('pk'))
                max_id, at = at['pk__max'], at['pk__min']
                if self.min_id:
                    at = self.min_id
                if self.max_id:
                    max_id = self.max_id

            if not (at and max_id):
                return

            num = 0
            limit = self.limit or max_id

            while at <= max_id and (not self.limit or num < self.limit):
                results = self.queryset.filter(
                    id__gte=at,
                    id__lte=min(at + self.step - 1, max_id),
                )
                if self.sorted:
                    results = results.order_by('id')
                results = results.iterator()

                for result in results:
                    yield result
                    num += 1
                    if num >= limit:
                        break
                at += self.step
