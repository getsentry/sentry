"""
sentry.utils.query
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

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
    Iterates through a queryset by chunking results by ``step`` and using GREATER THAN
    and LESS THAN queries on the primary key.

    Very efficient, but ORDER BY statements will not work.
    """

    def __init__(self, queryset, step=1000, limit=None, min_id=None,
                 order_by='pk'):
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
