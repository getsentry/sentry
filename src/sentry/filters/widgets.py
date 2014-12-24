"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('Widget', 'TextWidget', 'ChoiceWidget')

from django.utils.safestring import mark_safe
from django.utils.html import escape

import six


class Widget(object):
    def __init__(self, filter, request):
        self.filter = filter
        self.request = request

    def get_query_string(self):
        return self.filter.get_query_string()


class TextWidget(Widget):
    def render(self, value, placeholder='', **kwargs):
        return mark_safe(u'''
            <div class="filter-text">
                <input type="text" name="%(name)s" value="%(value)s" data-allowClear="true" data-placeholder="Search for a %(label)s"/>
            </div>''' % dict(
            name=self.filter.get_query_param(),
            value=escape(value),
            label=self.filter.label.lower(),
            placeholder=escape(placeholder or 'enter %s' % self.filter.label.lower()),
        ))


class ChoiceWidget(TextWidget):
    allow_any = True

    def render(self, value, **kwargs):
        choices = self.filter.get_choices()
        if len(choices) == self.filter.max_choices:
            return super(ChoiceWidget, self).render(value, placeholder='e.g. %s' % choices.keys()[0], **kwargs)

        query_string = self.get_query_string()
        column = self.filter.get_query_param()
        choices = choices.items()

        output = [u'<select name="%(column)s" class="filter-list" rel="%(column)s" data-allowClear="true" data-placeholder="Select a %(label)s">' % dict(
            column=column,
            label=self.filter.label.lower(),
        )]
        if self.allow_any:
            output.append(u'<option></option>' % dict(
                active=not value and ' selected="selected"' or '',
                query_string=query_string,
                label=self.filter.label,
                column=column,
            ))
        for key, val in choices:
            key = six.text_type(key)
            output.append(u'<option%(active)s value="%(key)s">%(value)s</option>' % dict(
                active=value == key and ' selected="selected"' or '',
                column=column,
                key=key,
                value=val,
                query_string=query_string,
            ))
        output.append(u'</select>')
        return mark_safe(u'\n'.join(output))
