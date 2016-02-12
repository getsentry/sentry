"""
sentry.templatetags.sentry_activity
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import logging

from django import template
from django.utils.html import escape, urlize, linebreaks
from django.utils.safestring import mark_safe

from sentry.models import Activity, User
from sentry.templatetags.sentry_helpers import timesince
from sentry.utils.avatar import get_gravatar_url

register = template.Library()


ACTIVITY_ACTION_STRINGS = {
    Activity.NOTE: 'left a note',
    Activity.SET_RESOLVED: 'marked this event as resolved',
    Activity.SET_UNRESOLVED: 'marked this event as unresolved',
    Activity.SET_MUTED: 'marked this event as muted',
    Activity.SET_PUBLIC: 'made this event public',
    Activity.SET_PRIVATE: 'made this event private',
    Activity.SET_REGRESSION: 'marked this event as a regression',
    Activity.CREATE_ISSUE: u'created an issue on {provider:s} titled <a href="{location:s}">{title:s}</a>',
    Activity.FIRST_SEEN: 'first saw this event',
    Activity.ASSIGNED: 'assigned this event to {user:s}',
    Activity.UNASSIGNED: 'unassigned this event',
    Activity.RELEASE: 'saw a new release: {version:s}',
}


@register.filter
def render_activity(item):
    if not item.group:
        # not implemented
        return

    try:
        action_str = ACTIVITY_ACTION_STRINGS[item.type]
    except KeyError:
        logging.warning('Unknown activity type present: %s', item.type)
        return

    if item.type == Activity.CREATE_ISSUE:
        action_str = action_str.format(**item.data)
    elif item.type == Activity.ASSIGNED:
        if item.data['assignee'] == item.user_id:
            assignee_name = 'themselves'
        else:
            try:
                assignee = User.objects.get(id=item.data['assignee'])
            except User.DoesNotExist:
                assignee_name = 'unknown'
            else:
                assignee_name = assignee.get_display_name()
        action_str = action_str.format(user=assignee_name)

    output = ''

    if item.user:
        user = item.user
        name = user.name or user.email
        output += '<span class="avatar"><img src="%s"></span> ' % (get_gravatar_url(user.email, size=20),)
        output += '<strong>%s</strong> %s' % (escape(name), action_str)
    else:
        output += '<span class="avatar sentry"></span> '
        output += 'The system %s' % (action_str,)

    output += ' <span class="sep">&mdash;</span> <span class="time">%s</span>' % (timesince(item.datetime),)

    if item.type == Activity.NOTE:
        output += linebreaks(urlize(escape(item.data['text'])))

    return mark_safe(output)
