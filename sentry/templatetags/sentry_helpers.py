from django import template
from django.db.models import Count
from django.utils import simplejson

from sentry.helpers import get_db_engine
from sentry.plugins import GroupActionProvider

import datetime

register = template.Library()

@register.filter
def is_dict(value):
    return isinstance(value, dict)

@register.filter
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

@register.filter
def num_digits(value):
    return len(str(value))

@register.filter
def chart_data(group, max_days=90):
    hours = max_days*24
    
    today = datetime.datetime.now().replace(microsecond=0, second=0, minute=0)

    if hasattr(group, '_state'):
        from django.db import connections
        conn = connections[group._state.db]
    else:
        from django.db import connection as conn

    method = conn.ops.date_trunc_sql('hour', 'datetime')

    chart_qs = list(group.message_set.all()\
                      .filter(datetime__gte=datetime.datetime.now() - datetime.timedelta(hours=hours))\
                      .extra(select={'grouper': method}).values('grouper')\
                      .annotate(num=Count('id')).values_list('grouper', 'num')\
                      .order_by('grouper'))

    min_date = chart_qs[0][0]
    if min_date and min_date < datetime.datetime.now() - datetime.timedelta(days=1):
        stop_hours = (datetime.datetime.now() - min_date).days * 24
        start_hours = (datetime.datetime.now() - chart_qs[-1][0]).days * 24
    else:
        stop_hours = 24
        start_hours = 0
    
    rows = dict(chart_qs)
    if rows:
        max_y = max(rows.values())
    else:
        max_y = 1
    
    return {
        'points': [rows.get(today-datetime.timedelta(hours=d), 0) for d in xrange(start_hours, stop_hours)][::-1],
        'categories': [str(today-datetime.timedelta(hours=d)) for d in xrange(start_hours, stop_hours)][::-1],
    }

@register.filter
def to_json(data):
    return simplejson.dumps(data)

def sentry_version():
    from sentry import get_version
    return get_version()
register.simple_tag(sentry_version)

@register.filter
def get_actions(group, request):
    action_list = []
    for cls in GroupActionProvider.plugins.itervalues():
        inst = cls(group.pk)
        action_list = inst.actions(request, action_list, group)
    for action in action_list:
        yield action[0], action[1], request.path == action[1]

@register.filter
def get_panels(group, request):
    panel_list = []
    for cls in GroupActionProvider.plugins.itervalues():
        inst = cls(group.pk)
        panel_list = inst.panels(request, panel_list, group)
    for panel in panel_list:
        yield panel[0], panel[1], request.path == panel[1]

@register.filter
def get_widgets(group, request):
    for cls in GroupActionProvider.plugins.itervalues():
        inst = cls(group.pk)
        resp = inst.widget(request, group)
        if resp:
            yield resp

@register.filter
def get_tags(group, request):
    tag_list = []
    for cls in GroupActionProvider.plugins.itervalues():
        inst = cls(group.pk)
        tag_list = inst.tags(request, tag_list, group)
    for tag in tag_list:
        yield tag

@register.filter
def timesince(value):
    from django.template.defaultfilters import timesince
    if not value:
        return 'Never'
    if value < datetime.datetime.now() - datetime.timedelta(days=5):
        return value.date()
    value = (' '.join(timesince(value).split(' ')[0:2])).strip(',')
    if value == '0 minutes':
        return 'Just now'
    if value == '1 day':
        return 'Yesterday'
    return value + ' ago'
