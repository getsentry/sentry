# Widget api is pretty ugly
from django.utils.datastructures import SortedDict
from django.utils.safestring import mark_safe

from sentry.settings import LOG_LEVELS

class Widget(object):
    def __init__(self, filter, request):
        self.filter = filter
        self.request = request

    def get_query_string(self):
        return self.filter.get_query_string()

class TextWidget(Widget):
    def render(self, value):
        return mark_safe('<div id="search"><p class="textfield"><input type="text" name="%(name)s" value="%(value)s"/></p><p class="submit"><input type="submit" class="search-submit"/></p></div>' % dict(
            name=self.filter.get_query_param(),
            value=value,
        ))

class ChoiceWidget(Widget):
    def render(self, value):
        choices = self.filter.get_choices()
        query_string = self.get_query_string()
        column = self.filter.get_query_param()

        output = ['<ul class="%s-list filter-list sidebar-module">' % (self.filter.column,)]
        output.append('<li%(active)s><a href="%(query_string)s">Any %(label)s</a></li>' % dict(
            active=not value and ' class="active"' or '',
            query_string=query_string,
            label=self.filter.label,
        ))
        for key, val in choices.iteritems():
            key = unicode(key)
            output.append('<li%(active)s><a href="%(query_string)s&amp;%(column)s=%(key)s">%(value)s</a></li>' % dict(
                active=value == key and ' class="active"' or '',
                column=column,
                key=key,
                value=val,
                query_string=query_string,
            ))
        output.append('</ul>')
        return mark_safe('\n'.join(output))

class SentryFilter(object):
    label = ''
    column = ''
    widget = ChoiceWidget
    # This must be a string
    default = ''
    
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
        from sentry.models import GroupedMessage
        return SortedDict((l, l) for l in GroupedMessage.objects.values_list(self.column, flat=True).distinct())
    
    def get_query_set(self, queryset):
        from indexer.models import Index
        kwargs = {self.column: self.get_value()}
        if self.column.startswith('data__'):
            return Index.objects.get_for_queryset(queryset, **kwargs)
        return queryset.filter(**kwargs)
    
    def process(self, data):
        """``self.request`` is not available within this method"""
        return data
    
    def render(self):
        widget = self.get_widget()
        return widget.render(self.get_value())

class StatusFilter(SentryFilter):
    label = 'Status'
    column = 'status'
    default = '0'

    def get_choices(self):
        return SortedDict([
            (0, 'Unresolved'),
            (1, 'Resolved'),
        ])

class LoggerFilter(SentryFilter):
    label = 'Logger'
    column = 'logger'

class ServerNameFilter(SentryFilter):
    label = 'Server Name'
    column = 'server_name'

    def get_choices(self):
        from sentry.models import Message
        return SortedDict((l, l) for l in Message.objects.values_list(self.column, flat=True).distinct())

    def get_query_set(self, queryset):
        return queryset.filter(message_set__server_name=self.get_value())

class LevelFilter(SentryFilter):
    label = 'Level'
    column = 'level'
    
    def get_choices(self):
        return SortedDict((str(k), v) for k, v in LOG_LEVELS)