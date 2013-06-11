"""
sentry.templatetags.sentry_admin_helpers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime

from django import template
from django.db.models import Sum
from django.utils import timezone

register = template.Library()


@register.filter
def with_event_counts(project_list):
    from sentry.models import ProjectCountByMinute
    results = dict(ProjectCountByMinute.objects.filter(
        project__in=project_list,
        date__gte=timezone.now() - datetime.timedelta(days=30),
    ).values_list('project').annotate(
        total_events=Sum('times_seen'),
    ).values_list('project', 'total_events'))

    for project in project_list:
        avg = results.get(project.pk, 0) / 30.0
        if avg < 5:
            avg = '%.1f' % avg
            if avg == '0.0':
                avg = 0
        else:
            avg = int(avg)
        yield project, avg
