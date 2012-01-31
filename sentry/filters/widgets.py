"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('Widget', 'TextWidget', 'ChoiceWidget')

from django.utils.safestring import mark_safe
from django.utils.html import escape


class Widget(object):
    def __init__(self, filter, request):
        self.filter = filter
        self.request = request

    def get_query_string(self):
        return self.filter.get_query_string()


class TextWidget(Widget):
    def render(self, value, placeholder='', **kwargs):
        return mark_safe('<div class="filter-text"><p class="textfield"><input type="text" name="%(name)s" value="%(value)s" placeholder="%(placeholder)s"/></p><p class="submit"><input type="submit" class="search-submit"/></p></div>' % dict(
            name=self.filter.get_query_param(),
            value=escape(value),
            placeholder=escape(placeholder or 'enter %s' % self.filter.label.lower()),
        ))


class ChoiceWidget(Widget):
    allow_any = True

    def render(self, value, **kwargs):
        choices = self.filter.get_choices()
        query_string = self.get_query_string()
        column = self.filter.get_query_param()

        output = ['<ul class="nav nav-tabs nav-stacked filter-list" rel="%s">' % (column,)]
        if self.allow_any:
            output.append('<li%(active)s><a href="%(query_string)s&amp;%(column)s=">Any %(label)s</a></li>' % dict(
                active=not value and ' class="active"' or '',
                query_string=query_string,
                label=self.filter.label,
                column=column,
            ))
        for key, val in choices.iteritems():
            key = unicode(key)
            output.append('<li%(active)s rel="%(key)s"><a href="%(query_string)s&amp;%(column)s=%(key)s">%(value)s</a></li>' % dict(
                active=value == key and ' class="active"' or '',
                column=column,
                key=key,
                value=val,
                query_string=query_string,
            ))
        output.append('</ul>')
        return mark_safe('\n'.join(output))
