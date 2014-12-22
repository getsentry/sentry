from __future__ import absolute_import, print_function

from django import template
from django.utils.encoding import force_text
from django.utils.html import mark_safe
from markdown import markdown as markdown_func


register = template.Library()


@register.filter(is_safe=True)
def markdown(value, header_level=3):
    """
    Runs Markdown over a given value, optionally using various
    extensions python-markdown supports.

    Syntax::

        {{ value|markdown }}
    """
    return mark_safe(markdown_func(force_text(value), extensions=[
        'headerid(level=%d)' % (int(header_level),),
    ]))
