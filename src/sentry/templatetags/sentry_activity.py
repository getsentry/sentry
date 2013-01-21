"""
sentry.templatetags.sentry_activity
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import template
from django.utils.html import escape, linebreaks
from django.utils.safestring import mark_safe

from sentry.models import Activity
from sentry.templatetags.sentry_helpers import timesince


register = template.Library()


ACTIVITY_ACTION_STRINGS = {
    Activity.COMMENT: 'left a comment',
    Activity.SET_RESOLVED: 'marked this event as resolved',
    Activity.SET_UNRESOLVED: 'marked this event as unresolved',
    Activity.SET_MUTED: 'marked this event as muted',
    Activity.SET_PUBLIC: 'made this event public',
    Activity.SET_PRIVATE: 'made this event private',
    Activity.SET_REGRESSION: 'marked this event as a regression',
}


@register.filter
def render_activity(item):
    if not item.group:
        # not implemented
        return

    action_str = ACTIVITY_ACTION_STRINGS[item.type]

    output = '<p>'

    if item.user:
        name = item.user.first_name or item.user.email
        output += '<strong>%s</strong> %s' % (escape(name), action_str)
    else:
        output += 'The system %s' % (action_str,)

    output += ' &mdash; %s</p>' % (timesince(item.datetime),)

    if item.type == Activity.COMMENT:
        output += linebreaks(item.data['body'])

    return mark_safe(output)
