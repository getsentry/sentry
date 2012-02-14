"""
sentry.templatetags.sentry_admin_helpers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import template

from sentry.conf import settings

register = template.Library()


@register.filter
def avg_events_per_day(project):
    """
    Project is expected to have already been annotated with avg_events_per_n
    and n_value properties.
    """
    if not project.avg_events_per_n:
        per_day = 0
    else:
        n_per_hour = (60 / settings.MINUTE_NORMALIZATION)
        per_day = int(project.avg_events_per_n / project.n_value) - (project.n_value % n_per_hour)

    return per_day
