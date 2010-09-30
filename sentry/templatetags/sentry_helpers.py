from django import template
from django.db.models import Count

from sentry.helpers import get_db_engine
from sentry.plugins import GroupActionProvider

import datetime
try:
    from pygooglechart import SimpleLineChart
except ImportError:
    SimpleLineChart = None

register = template.Library()

def is_dict(value):
    return isinstance(value, dict)
is_dict = register.filter(is_dict)

def with_priority(result_list, key='score'):
    if result_list:
        if isinstance(result_list[0], dict):
            _get = lambda x, k: x[k]
        else:
            _get = lambda x, k: getattr(x, k)

        min_, max_ = min([_get(r, key) for r in result_list]), max([_get(r, key) for r in result_list])
        mid = (max_ - min_) / 4
        for result in result_list:
            val = _get(result, key)
            if val > max_ - mid:
                priority = 'veryhigh'
            elif val > max_ - mid * 2:
                priority = 'high'
            elif val > max_ - mid * 3:
                priority = 'medium'
            elif val > max_ - mid * 4:
                priority = 'low'
            else:
                priority = 'verylow'
            yield result, priority
with_priority = register.filter(with_priority)

def num_digits(value):
    return len(str(value))
num_digits = register.filter(num_digits)

def can_chart(group):
    engine = get_db_engine()
    return SimpleLineChart and not engine.startswith('sqlite')
can_chart = register.filter(can_chart)

def chart_url(group):
    today = datetime.datetime.now()

    chart_qs = group.message_set.all()\
                      .filter(datetime__gte=today - datetime.timedelta(hours=24))\
                      .extra(select={'hour': 'extract(hour from datetime)'}).values('hour')\
                      .annotate(num=Count('id')).values_list('hour', 'num')

    rows = dict(chart_qs)
    if rows:
        max_y = max(rows.values())
    else:
        max_y = 1

    chart = SimpleLineChart(300, 80, y_range=[0, max_y])
    chart.add_data([max_y]*30)
    chart.add_data([rows.get((today-datetime.timedelta(hours=d)).hour, 0) for d in range(0, 24)][::-1])
    chart.add_data([0]*30)
    chart.fill_solid(chart.BACKGROUND, 'eeeeee')
    chart.add_fill_range('eeeeee', 0, 1)
    chart.add_fill_range('e0ebff', 1, 2)
    chart.set_colours(['eeeeee', '999999', 'eeeeee'])
    chart.set_line_style(1, 1)
    return chart.get_url()
chart_url = register.filter(chart_url)

def sentry_version():
    import sentry
    return '.'.join(map(str, sentry.__version__))
sentry_version = register.simple_tag(sentry_version)

def get_actions(group):
    for cls in GroupActionProvider.plugins.itervalues():
        action = cls(group.pk)
        yield action.url, action.title
get_actions = register.filter(get_actions)