"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Widget api is pretty ugly
from __future__ import absolute_import

__all__ = ('Filter', 'GroupFilter', 'EventFilter')

from django.utils.datastructures import SortedDict

from sentry.conf import settings
from sentry.models import Group, Event, FilterValue, MessageIndex
from sentry.utils import InstanceManager
from .widgets import ChoiceWidget


class FilterInstanceManager(InstanceManager):
    def filter(self, model):
        for inst in self.all():
            if model not in inst.types:
                continue
            yield inst


class Filter(object):
    label = ''
    column = ''
    widget = ChoiceWidget
    # This must be a string
    default = ''
    show_label = True
    types = [Group, Event]

    def __init__(self, request):
        self.request = request

    def is_set(self):
        return bool(self.get_value())

    def get_value(self):
        return self.request.GET.get(self.get_query_param(), self.default) or ''

    def get_query_param(self):
        return getattr(self, 'query_param', self.column)

    def get_widget(self):
        return self.widget(self, self.request)

    def get_query_string(self):
        column = self.column
        query_dict = self.request.GET.copy()
        if 'p' in query_dict:
            del query_dict['p']
        if column in query_dict:
            del query_dict[self.column]
        return '?' + query_dict.urlencode()

    def get_choices(self):
        return SortedDict((l, l) for l in FilterValue.objects.filter(key=self.column)\
                                                     .values_list('value', flat=True)\
                                                     .order_by('value'))

    def get_query_set(self, queryset):
        kwargs = {self.column: self.get_value()}
        if self.column.startswith('data__'):
            return MessageIndex.objects.get_for_queryset(queryset, **kwargs)
        return queryset.filter(**kwargs)

    def process(self, data):
        """``self.request`` is not available within this method"""
        return data

    def render(self):
        widget = self.get_widget()
        return widget.render(self.get_value())

    objects = FilterInstanceManager(settings.FILTERS, instances=False)


class EventFilter(Filter):
    types = [Event]


class GroupFilter(Filter):
    types = [Group]
