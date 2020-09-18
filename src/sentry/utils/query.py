from __future__ import absolute_import

import progressbar
import re
import six

from django.db import connections, router


_leaf_re = re.compile(r"^(UserReport|Event|Group)(.+)")


class InvalidQuerySetError(ValueError):
    pass


class RangeQuerySetWrapper(object):
    """
    Iterates through a queryset by chunking results by ``step`` and using GREATER THAN
    and LESS THAN queries on the primary key.

    Very efficient, but ORDER BY statements will not work.
    """

    def __init__(self, queryset, step=1000, limit=None, min_id=None, order_by="pk", callbacks=()):
        # Support for slicing
        if queryset.query.low_mark == 0 and not (
            queryset.query.order_by or queryset.query.extra_order_by
        ):
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
            queryset = queryset.order_by("-%s" % self.order_by)
        else:
            queryset = queryset.order_by(self.order_by)

        # we implement basic cursor pagination for columns that are not unique
        last_object_pk = None
        has_results = True
        while has_results:
            if (max_value and cur_value >= max_value) or (limit and num >= limit):
                break

            start = num

            if cur_value is None:
                results = queryset
            elif self.desc:
                results = queryset.filter(**{"%s__lte" % self.order_by: cur_value})
            elif not self.desc:
                results = queryset.filter(**{"%s__gte" % self.order_by: cur_value})

            results = list(results[0 : self.step])

            for cb in self.callbacks:
                cb(results)

            for result in results:
                if last_object_pk is not None and result.pk == last_object_pk:
                    continue

                # Need to bind value before yielding, because the caller
                # may mutate the value and we're left with a bad value.
                # This is commonly the case if iterating over and
                # deleting, because a Model.delete() mutates the `id`
                # to `None` causing the loop to exit early.
                num += 1
                last_object_pk = result.pk
                cur_value = getattr(result, self.order_by)

                yield result

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
        if count is None and hasattr(iterator, "__len__"):
            count = len(iterator)
        self.iterator = iterator
        self.count = count
        self.caption = six.text_type(caption or u"Progress")

    def __iter__(self):
        if self.count != 0:
            widgets = [
                "%s: " % (self.caption,),
                progressbar.Percentage(),
                " ",
                progressbar.Bar(),
                " ",
                progressbar.ETA(),
            ]
            pbar = progressbar.ProgressBar(widgets=widgets, maxval=self.count)
            pbar.start()
            for idx, item in enumerate(self.iterator):
                yield item
                # It's possible that we've exceeded the maxval, but instead
                # of exploding on a ValueError, let's just cap it so we don't.
                # this could happen if new rows were added between calculating `count()`
                # and actually beginning iteration where we're iterating slightly more
                # than we thought.
                pbar.update(min(idx, self.count))
            pbar.finish()


def bulk_delete_objects(
    model, limit=10000, transaction_id=None, logger=None, partition_key=None, **filters
):
    connection = connections[router.db_for_write(model)]
    quote_name = connection.ops.quote_name

    query = []
    params = []
    partition_query = []

    if partition_key:
        for column, value in partition_key.items():
            partition_query.append("%s = %%s" % (quote_name(column),))
            params.append(value)

    for column, value in filters.items():
        query.append("%s = %%s" % (quote_name(column),))
        params.append(value)

    query = """
        delete from %(table)s
        where %(partition_query)s id = any(array(
            select id
            from %(table)s
            where (%(query)s)
            limit %(limit)d
        ))
    """ % dict(
        partition_query=(" AND ".join(partition_query)) + (" AND " if partition_query else ""),
        query=" AND ".join(query),
        table=model._meta.db_table,
        limit=limit,
    )

    cursor = connection.cursor()
    cursor.execute(query, params)

    has_more = cursor.rowcount > 0

    if has_more and logger is not None and _leaf_re.search(model.__name__) is None:
        logger.info(
            "object.delete.bulk_executed",
            extra=dict(
                list(filters.items())
                + [("model", model.__name__), ("transaction_id", transaction_id)]
            ),
        )

    return has_more
