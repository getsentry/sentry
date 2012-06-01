"""
sentry.templatetags.sentry_helpers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# XXX: Import django-paging's template tags so we dont have to worry about
#      INSTALLED_APPS
from django import template
from django.template import RequestContext
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from django.utils.html import escape
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext as _
from paging.helpers import paginate as paginate_func
from sentry.conf import settings
from sentry.utils import json
from sentry.utils.dates import utc_to_local, local_to_utc
from templatetag_sugar.register import tag
from templatetag_sugar.parser import Name, Variable, Constant, Optional

import datetime
import hashlib
import urllib

register = template.Library()


@register.filter
def pprint(value, break_after=10):
    """
    A wrapper around pprint.pprint -- for debugging, really.

    break_after is used to define how often a <span> is
    inserted (for soft wrapping).
    """
    from pprint import pformat

    value = pformat(value).decode('utf-8', 'replace')
    return mark_safe(u'<span></span>'.join(
        [escape(value[i:(i + break_after)]) for i in xrange(0, len(value), break_after)]
    ))


# seriously Django?
@register.filter
def subtract(value, amount):
    return int(value) - int(amount)


@register.filter
def has_charts(group):
    from sentry.utils.db import has_charts
    if hasattr(group, '_state'):
        db = group._state.db or 'default'
    else:
        db = 'default'
    return has_charts(db)


@register.filter
def as_sorted(value):
    return sorted(value)


@register.filter
def is_dict(value):
    return isinstance(value, dict)


@register.filter
def small_count(v):
    z = [
        (1000000000, _('b')),
        (1000000, _('m')),
        (1000, _('k')),
    ]
    v = int(v)
    for x, y in z:
        o, p = divmod(v, x)
        if o:
            if len(str(o)) > 2 or not p:
                return '%d%s' % (o, y)
            return '%.1f%s' % (v / float(x), y)
    return v


@register.filter
def with_priority(result_list, key='score'):
    if result_list:
        if isinstance(result_list[0], (dict, list, tuple)):
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
def to_json(data):
    return json.dumps(data)


@register.filter
def to_str(data):
    return str(data)


@register.simple_tag
def sentry_version():
    import sentry
    return sentry.VERSION


@register.filter
def timesince(value):
    from django.template.defaultfilters import timesince
    now = utc_to_local(datetime.datetime.utcnow())
    if not value:
        return _('never')
    if value < (now - datetime.timedelta(days=5)):
        return value.date()
    value = (' '.join(timesince(value, now).split(' ')[0:2])).strip(',')
    if value == _('0 minutes'):
        return _('just now')
    if value == _('1 day'):
        return _('yesterday')
    return value + _(' ago')


@register.filter
def duration(value):
    if not value:
        return '0s'
    hours, minutes, seconds = 0, 0, 0
    if value > 3600:
        hours = value / 3600
        value = value % 3600
    if value > 60:
        minutes = value / 60
        value = value % 60
    seconds = value / 60
    output = []
    if hours:
        output.append('%dh' % hours)
    if minutes:
        output.append('%dm' % minutes)
    if seconds > 1:
        output.append('%0.2fs' % seconds)
    elif seconds:
        output.append('%dms' % (seconds * 1000))
    return ''.join(output)


@register.filter(name='truncatechars')
@stringfilter
def truncatechars(value, arg):
    """
    Truncates a string after a certain number of chars.

    Argument: Number of chars to truncate after.
    """
    try:
        length = int(arg)
    except ValueError:  # Invalid literal for int().
        return value  # Fail silently.
    if len(value) > length:
        return value[:length] + '...'
    return value
truncatechars.is_safe = True


# XXX: this is taken from django-paging so that we may render
#      a custom template, and not worry about INSTALLED_APPS
@tag(register, [Variable('queryset_or_list'),
                Constant('from'), Variable('request'),
                Optional([Constant('as'), Name('asvar')]),
                Optional([Constant('per_page'), Variable('per_page')])])
def paginate(context, queryset_or_list, request, asvar=None, per_page=settings.MESSAGES_PER_PAGE):
    """{% paginate queryset_or_list from request as foo[ per_page 25] %}"""
    result = paginate_func(request, queryset_or_list, per_page, endless=True)

    context_instance = RequestContext(request)
    paging = mark_safe(render_to_string('sentry/partial/_pager.html', result, context_instance))

    result = dict(objects=result['paginator'].get('objects', []), paging=paging)

    if asvar:
        context[asvar] = result
        return ''
    return result


@tag(register, [Variable('queryset_or_list'),
                Constant('from'), Variable('request'),
                Optional([Constant('as'), Name('asvar')]),
                Optional([Constant('per_page'), Variable('per_page')])])
def paginator(context, queryset_or_list, request, asvar=None, per_page=settings.MESSAGES_PER_PAGE):
    """{% paginator queryset_or_list from request as foo[ per_page 25] %}"""
    result = paginate_func(request, queryset_or_list, per_page, endless=True)

    if asvar:
        context[asvar] = result
        return ''
    return result


@tag(register, [Constant('from'), Variable('request'),
                Optional([Constant('without'), Name('withoutvar')]),
                Optional([Constant('as'), Name('asvar')])])
def querystring(context, request, withoutvar, asvar=None):
    params = request.GET.copy()

    if withoutvar in params:
        del params[withoutvar]

    result = params.urlencode()
    if asvar:
        context[asvar] = result
        return ''
    return result


@register.inclusion_tag('sentry/partial/_form.html')
def render_form(form):
    return {'form': form}


@register.filter
def as_bookmarks(group_list, user):
    group_list = list(group_list)
    if user.is_authenticated() and group_list:
        project = group_list[0].project
        bookmarks = set(project.bookmark_set.filter(
            user=user,
            group__in=group_list,
        ).values_list('group_id', flat=True))
    else:
        bookmarks = set()

    for g in group_list:
        yield g, g.pk in bookmarks


@register.filter
def date(datetime, arg=None):
    from django.template.defaultfilters import date
    return date(local_to_utc(datetime), arg)


@tag(register, [Constant('for'), Variable('user'),
                Constant('from'), Variable('project'),
                Constant('as'), Name('asvar')])
def get_project_dsn(context, user, project, asvar):
    from sentry.models import ProjectKey

    if not user.is_authenticated():
        context[asvar] = None
        return ''

    try:
        key = ProjectKey.objects.get(user=user, project=project)
    except ProjectKey.DoesNotExist:
        try:
            key = ProjectKey.objects.filter(user=None, project=project)[0]
        except IndexError:
            context[asvar] = None
        else:
            context[asvar] = key.get_dsn()
    else:
        context[asvar] = key.get_dsn()

    return ''


# Adapted from http://en.gravatar.com/site/implement/images/django/
# The "mm" default is for the grey, "mystery man" icon. See:
#   http://en.gravatar.com/site/implement/images/
@tag(register, [Variable('email'),
                Optional([Constant('size'), Variable('sizevar')]),
                Optional([Constant('default'), Variable('defaultvar')])])
def gravatar_url(context, email, sizevar=None, defaultvar='mm'):
    # XXX - use request.is_secure() in django 1.4
    if context['request'].META['wsgi.url_scheme'] == 'https':
        base = 'https://secure.gravatar.com'
    else:
        base = 'http://www.gravatar.com'

    gravatar_url = "%s/avatar/%s" % (base, hashlib.md5(email.lower()).hexdigest())

    properties = {}
    if sizevar:
        properties['s'] = str(sizevar)
    if defaultvar:
        properties['d'] = defaultvar
    if properties:
        gravatar_url += "?" + urllib.urlencode(properties)

    return gravatar_url
