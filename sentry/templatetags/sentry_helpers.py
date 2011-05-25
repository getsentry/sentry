# XXX: Import django-paging's template tags so we dont have to worry about
#      INSTALLED_APPS
from django import template
from django.db.models import Count
from django.utils.safestring import mark_safe
from django.template import RequestContext
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from paging.helpers import paginate as paginate_func
from sentry.utils import json
from sentry.utils import get_db_engine
from sentry.utils.compat.db import connections
from django.utils.translation import ugettext as _
from sentry.plugins import GroupActionProvider
from templatetag_sugar.register import tag
from templatetag_sugar.parser import Name, Variable, Constant, Optional

import datetime

register = template.Library()

@register.filter
def as_sorted(value):
    return sorted(value)

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
    min_date = today - datetime.timedelta(hours=hours)

    if hasattr(group, '_state'):
        db = group._state.db
    else:
        db = 'default'

    conn = connections[db]

    if get_db_engine(getattr(conn, 'alias', 'default')).startswith('oracle'):
        method = conn.ops.date_trunc_sql('hh24', 'datetime')
    else:
        method = conn.ops.date_trunc_sql('hour', 'datetime')

    chart_qs = list(group.message_set.all()\
                      .filter(datetime__gte=min_date)\
                      .extra(select={'grouper': method}).values('grouper')\
                      .annotate(num=Count('id')).values_list('grouper', 'num')\
                      .order_by('grouper'))

    if not chart_qs:
        return {}

    rows = dict(chart_qs)

    #just skip zeroes
    first_seen = hours
    while not rows.get(today - datetime.timedelta(hours=first_seen)) and first_seen > 24:
        first_seen -= 1

    return {
        'points': [rows.get(today-datetime.timedelta(hours=d), 0) for d in xrange(first_seen, -1, -1)],
        'categories': [str(today-datetime.timedelta(hours=d)) for d in xrange(first_seen, -1, -1)],
    }

@register.filter
def to_json(data):
    return json.dumps(data)

@register.simple_tag
def sentry_version():
    import sentry
    return sentry.VERSION

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
        return _('Never')
    if value < datetime.datetime.now() - datetime.timedelta(days=5):
        return value.date()
    value = (' '.join(timesince(value).split(' ')[0:2])).strip(',')
    if value == _('0 minutes'):
        return _('Just now')
    if value == _('1 day'):
        return _('Yesterday')
    return value + _(' ago')

@register.filter(name='truncatechars')
@stringfilter
def truncatechars(value, arg):
    """
    Truncates a string after a certain number of chars.

    Argument: Number of chars to truncate after.
    """
    try:
        length = int(arg)
    except ValueError: # Invalid literal for int().
        return value # Fail silently.
    if len(value) > length:
        return value[:length] + '...'
    return value
truncatechars.is_safe = True

# XXX: this is taken from django-paging so that we may render
#      a custom template, and not worry about INSTALLED_APPS
@tag(register, [Variable('queryset_or_list'),
                Constant('from'), Variable('request'),
                Optional([Constant('as'), Name('asvar')]),
                Optional([Constant('per_page'), Variable('per_page')]),
                Optional([Variable('is_endless')])])
def paginate(context, queryset_or_list, request, asvar, per_page=25, is_endless=True):
    """{% paginate queryset_or_list from request as foo[ per_page 25][ is_endless False %}"""
    context_instance = RequestContext(request)
    paging_context = paginate_func(request, queryset_or_list, per_page, endless=is_endless)
    paging = mark_safe(render_to_string('sentry/partial/_pager.html', paging_context, context_instance))

    result = dict(objects=paging_context['paginator'].get('objects', []), paging=paging)
    if asvar:
        context[asvar] = result
        return ''
    return result