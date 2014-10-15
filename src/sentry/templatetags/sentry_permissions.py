"""
sentry.templatetags.sentry_permissions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django import template

register = template.Library()

# TODO: Django doesn't seem to introspect function args correctly for filters
# so we can't just register.filter(can_add_team_member)


@register.filter
def can_add_team_member(user, team):
    from sentry.permissions import can_add_team_member

    return can_add_team_member(user, team)
