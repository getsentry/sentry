"""
sentry.templatetags.sentry_activity
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import template
from django.utils.html import escape, linebreaks
from django.utils.safestring import mark_safe

from sentry.models import Activity
from sentry.templatetags.sentry_helpers import timesince
from sentry.utils.avatar import get_gravatar_url

register = template.Library()


ACTIVITY_ACTION_STRINGS = {
    Activity.NOTE: 'left a comment',
    Activity.SET_RESOLVED: 'marked this event as resolved',
    Activity.SET_UNRESOLVED: 'marked this event as unresolved',
    Activity.SET_MUTED: 'marked this event as muted',
    Activity.SET_PUBLIC: 'made this event public',
    Activity.SET_PRIVATE: 'made this event private',
    Activity.SET_REGRESSION: 'marked this event as a regression',
    Activity.CREATE_ISSUE: u'created an issue on {provider:s} titled <a href="{location:s}">{title:s}</a>',
}


@register.filter
def render_activity(item):
    if not item.group:
        # not implemented
        return

    action_str = ACTIVITY_ACTION_STRINGS[item.type]

    if item.type == Activity.CREATE_ISSUE:
        action_str = action_str.format(**item.data)

    output = ''

    if item.user:
        user = item.user
        name = user.first_name or user.email
        output += '<span class="avatar"><img src="%s"></span> ' % (get_gravatar_url(user.email, size=20),)
        output += '<strong>%s</strong> %s' % (escape(name), action_str)
    else:
        output += '<span class="avatar sentry"></span> '
        output += 'The system %s' % (action_str,)

    output += ' <span class="sep">&mdash;</span> <span class="time">%s</span>' % (timesince(item.datetime),)

    if item.type == Activity.NOTE:
        output += linebreaks(item.data['body'])

    return mark_safe(output)
