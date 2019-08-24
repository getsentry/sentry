from __future__ import absolute_import

import datetime

from django import template
from django.utils import timezone

from sentry import tsdb

register = template.Library()


@register.filter
def with_event_counts(project_list):
    end = timezone.now()
    start = end - datetime.timedelta(days=1)

    tsdb_results = tsdb.get_range(
        model=tsdb.models.project, keys=[p.id for p in project_list], start=start, end=end
    )

    for project in project_list:
        yield project, sum(t[1] for t in tsdb_results[project.id])
