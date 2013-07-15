"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Widget api is pretty ugly
from __future__ import absolute_import

__all__ = ('Filter',)

import hashlib

from django.utils.datastructures import SortedDict

from sentry.models import TagValue
from sentry.utils.cache import cache
from .widgets import ChoiceWidget


class Filter(object):
    label = ''
    column = ''
    widget = ChoiceWidget
    # This must be a string
    default = ''
    show_label = True
    max_choices = 50

    def __init__(self, request, project):
        self.request = request
        self.project = project

    def is_set(self):
        return bool(self.get_value())

    def get_label(self):
        return self.label

    def get_column(self):
        return self.column

    def get_value(self):
        return self.request.GET.get(self.get_query_param(), self.default) or ''

    def get_query_param(self):
        return getattr(self, 'query_param', self.get_column())

    def get_widget(self):
        return self.widget(self, self.request)

    def get_query_string(self):
        column = self.get_column()
        query_dict = self.request.GET.copy()
        if 'p' in query_dict:
            del query_dict['p']
        if column in query_dict:
            del query_dict[column]
        return '?' + query_dict.urlencode()

    def get_choices(self):
        key = 'filters:%s:%s' % (self.project.id, hashlib.md5(self.column.encode('utf8')).hexdigest())
        result = cache.get(key)
        if result is None:
            result = list(TagValue.objects.filter(
                project=self.project,
                key=self.column,
            ).values_list('value', flat=True).order_by('value')[:self.max_choices])
            cache.set(key, result, 60)
        return SortedDict((l, l) for l in result)

    def get_query_set(self, queryset):
        kwargs = {self.column: self.get_value()}
        return queryset.filter(**kwargs)

    def process(self, data):
        """``self.request`` is not available within this method"""
        return data

    def render(self):
        widget = self.get_widget()
        return widget.render(self.get_value())


class TagFilter(Filter):
    def get_query_set(self, queryset):
        col, val = self.get_column(), self.get_value()
        queryset = queryset.filter(**dict(
            grouptag__key=col,
            grouptag__value=val,
        ))
        return queryset.distinct()
