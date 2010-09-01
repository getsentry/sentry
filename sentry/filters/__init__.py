# Widget api is pretty ugly
from django.utils.datastructures import SortedDict
from django.utils.safestring import mark_safe

from sentry.models import GroupedMessage, Message, LOG_LEVELS

class Widget(object):
    def __init__(self, filter, request):
        self.filter = filter
        self.request = request

    def get_query_string(self):
        return self.filter.get_query_string()

class TextWidget(Widget):
    def render(self, value):
        return mark_safe('<input type="text" name="%(name)s" value="%(value)s"/>' % dict(
            name=self.filter.get_query_param(),
            value=value,
        ))

class ChoiceWidget(Widget):
    def render(self, value):
        choices = self.filter.get_choices()
        query_string = self.get_query_string()
        column = self.filter.get_query_param()

        output = ['<ul class="%s-list filter-list sidebar-module">' % (self.filter.column,)]
        output.append('<li%(active)s><a href="?%(query_string)s">Any %(label)s</a></li>' % dict(
            active=not value and ' class="active"' or '',
            query_string=query_string,
            label=self.filter.get_label(),
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
    
    def __init__(self, request):
        self.request = request
    
    def is_set(self):
        return bool(self.get_value())
    
    def get_value(self):
        return self.request.GET.get(self.get_query_param()) or ''
    
    def get_label(self):
        return self.label

    def get_column(self):
        return self.column
    
    def get_query_param(self):
        return self.get_column()

    def get_widget(self):
        return self.widget(self, self.request)
    
    def get_query_string(self):
        column = self.get_column()
        query_dict = self.request.GET.copy()
        if 'p' in query_dict:
            del query_dict['p']
        if column in query_dict:
            del query_dict[self.column]
        return '?' + query_dict.urlencode()
    
    def get_choices(self):
        return SortedDict((l, l) for l in GroupedMessage.objects.values_list(self.get_column(), flat=True).distinct())
    
    def get_query_set(self, queryset):
        return queryset.filter(**{self.get_column(): self.get_value()})
    
    def process(self, data):
        """``self.request`` is not available within this method"""
        return data
    
    def render(self):
        widget = self.get_widget()
        return widget.render(self.get_value())

class LoggerFilter(SentryFilter):
    label = 'Logger'
    column = 'logger'

class ServerNameFilter(SentryFilter):
    label = 'Server Name'
    column = 'server_name'

    def get_choices(self):
        return SortedDict((l, l) for l in Message.objects.values_list(self.get_column(), flat=True).distinct())

    def get_query_set(self, queryset):
        return queryset.filter(message_set__server_name=self.get_value())

class LevelFilter(SentryFilter):
    label = 'Level'
    column = 'level'
    
    def get_choices(self):
        return SortedDict((str(k), v) for k, v in LOG_LEVELS)