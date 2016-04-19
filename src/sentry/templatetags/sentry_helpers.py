"""
sentry.templatetags.sentry_helpers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# XXX: Import django-paging's template tags so we don't have to worry about
#      INSTALLED_APPS
from __future__ import absolute_import

import functools
import os.path
import pytz
import six


from collections import namedtuple
from datetime import timedelta
from paging.helpers import paginate as paginate_func
from pkg_resources import parse_version as Version
from six.moves import range
from urllib import quote

from django import template
from django.conf import settings
from django.template import RequestContext
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import escape
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext as _

from sentry import options
from sentry.api.serializers import serialize as serialize_func
from sentry.constants import EVENTS_PER_PAGE
from sentry.models import Organization
from sentry.utils import json
from sentry.utils.strings import to_unicode
from sentry.utils.avatar import get_gravatar_url, get_email_avatar, get_letter_avatar
from sentry.utils.javascript import to_json
from sentry.utils.strings import (
    soft_break as _soft_break,
    soft_hyphenate,
    truncatechars,
)
from templatetag_sugar.register import tag
from templatetag_sugar.parser import Name, Variable, Constant, Optional

SentryVersion = namedtuple('SentryVersion', [
    'current', 'latest', 'update_available', 'build',
])


register = template.Library()

truncatechars = register.filter(stringfilter(truncatechars))
truncatechars.is_safe = True

register.filter(to_json)


@register.simple_tag
def absolute_uri(path='', *args):
    from sentry.utils.http import absolute_uri
    return absolute_uri(path.format(*args))


@register.filter
def pprint(value, break_after=10):
    """
    break_after is used to define how often a <span> is
    inserted (for soft wrapping).
    """

    value = to_unicode(value)
    return mark_safe(u'<span></span>'.join(
        [escape(value[i:(i + break_after)]) for i in range(0, len(value), break_after)]
    ))


@register.filter
def is_url(value):
    if not isinstance(value, six.string_types):
        return False
    if not value.startswith(('http://', 'https://')):
        return False
    if ' ' in value:
        return False
    return True


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
def small_count(v):
    if not v:
        return 0
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
def num_digits(value):
    return len(str(value))


@register.filter
def to_str(data):
    return str(data)


@register.filter
def is_none(value):
    return value is None


@register.simple_tag(takes_context=True)
def serialize(context, value):
    value = serialize_func(value, context['request'].user)
    value = json.dumps(value)
    value = value.replace('<', '&lt;').replace('>', '&gt;')
    return mark_safe(value)


@register.simple_tag(takes_context=True)
def get_sentry_version(context):
    import sentry
    current = sentry.VERSION

    latest = options.get('sentry:latest_version') or current
    update_available = Version(latest) > Version(current)
    build = sentry.__build__ or current

    context['sentry_version'] = SentryVersion(
        current, latest, update_available, build
    )
    return ''


@register.filter
def timesince(value, now=None):
    from django.template.defaultfilters import timesince
    if now is None:
        now = timezone.now()
    if not value:
        return _('never')
    if value < (now - timedelta(days=5)):
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
    # value is assumed to be in ms
    value = value / 1000.0
    hours, minutes, seconds = 0, 0, 0
    if value > 3600:
        hours = value / 3600
        value = value % 3600
    if value > 60:
        minutes = value / 60
        value = value % 60
    seconds = value
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


# XXX: this is taken from django-paging so that we may render
#      a custom template, and not worry about INSTALLED_APPS
@tag(register, [Variable('queryset_or_list'),
                Constant('from'), Variable('request'),
                Optional([Constant('as'), Name('asvar')]),
                Optional([Constant('per_page'), Variable('per_page')])])
def paginate(context, queryset_or_list, request, asvar=None, per_page=EVENTS_PER_PAGE):
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
def paginator(context, queryset_or_list, request, asvar=None, per_page=EVENTS_PER_PAGE):
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


@register.filter
def date(dt, arg=None):
    from django.template.defaultfilters import date
    if not timezone.is_aware(dt):
        dt = dt.replace(tzinfo=timezone.utc)
    return date(dt, arg)


@tag(register, [Constant('for'), Variable('user'),
                Constant('from'), Variable('project'),
                Constant('as'), Name('asvar')])
def get_project_dsn(context, user, project, asvar):
    from sentry.models import ProjectKey

    if not user.is_authenticated():
        context[asvar] = None
        return ''

    try:
        key = ProjectKey.objects.filter(project=project)[0]
    except ProjectKey.DoesNotExist:
        context[asvar] = None
    else:
        context[asvar] = key.get_dsn()

    return ''


# Adapted from http://en.gravatar.com/site/implement/images/django/
# The "mm" default is for the grey, "mystery man" icon. See:
#   http://en.gravatar.com/site/implement/images/
@tag(register, [Variable('email'),
                Optional([Constant('size'), Variable('size')]),
                Optional([Constant('default'), Variable('default')])])
def gravatar_url(context, email, size=None, default='mm'):
    return get_gravatar_url(email, size, default)


@tag(register, [Variable('display_name'),
                Variable('identifier'),
                Optional([Constant('size'), Variable('size')])])
def letter_avatar_svg(context, display_name, identifier, size=None):
    return get_letter_avatar(display_name, identifier, size=size)


# Don't use this in any situations where you're rendering more
# than 1-2 avatars. It will make a request for every user!
@tag(register, [Variable('display_name'),
                Variable('identifier'),
                Optional([Constant('size'), Variable('size')])])
def email_avatar(context, display_name, identifier, size=None):
    return get_email_avatar(display_name, identifier, size)


@register.filter
def trim_schema(value):
    return value.split('//', 1)[-1]


@register.filter
def with_metadata(group_list, request):
    group_list = list(group_list)
    if request.user.is_authenticated() and group_list:
        project = group_list[0].project
        bookmarks = set(project.bookmark_set.filter(
            user=request.user,
            group__in=group_list,
        ).values_list('group_id', flat=True))
    else:
        bookmarks = set()

    # TODO(dcramer): this is obsolete and needs to pull from the tsdb backend
    historical_data = {}

    for g in group_list:
        yield g, {
            'is_bookmarked': g.pk in bookmarks,
            'historical_data': ','.join(str(x[1]) for x in historical_data.get(g.id, [])),
        }


@register.inclusion_tag('sentry/plugins/bases/tag/widget.html')
def render_tag_widget(group, tag):
    return {
        'title': tag['label'],
        'tag_name': tag['key'],
        'group': group,
    }


@register.simple_tag
def percent(value, total):
    if not (value and total):
        return 0
    return int(int(value) / float(total) * 100)


@register.filter
def titlize(value):
    return value.replace('_', ' ').title()


@register.filter
def split(value, delim=''):
    return value.split(delim)


@register.inclusion_tag('sentry/partial/github_button.html')
def github_button(user, repo):
    return {
        'user': user,
        'repo': repo,
    }


@register.filter
def urlquote(value, safe=''):
    return quote(value.encode('utf8'), safe)


@register.filter
def basename(value):
    return os.path.basename(value)


@register.filter
def user_display_name(user):
    return user.name or user.username


@register.simple_tag(takes_context=True)
def localized_datetime(context, dt, format='DATETIME_FORMAT'):
    request = context['request']
    timezone = getattr(request, 'timezone', None)
    if not timezone:
        timezone = pytz.timezone(settings.SENTRY_DEFAULT_TIME_ZONE)

    dt = dt.astimezone(timezone)

    return date(dt, format)


@register.filter
def list_organizations(user):
    return Organization.objects.get_for_user(user)


@register.filter
def count_pending_access_requests(organization):
    from sentry.models import OrganizationAccessRequest

    return OrganizationAccessRequest.objects.filter(
        team__organization=organization,
    ).count()


@register.filter
def format_userinfo(user):
    parts = user.username.split('@')
    if len(parts) == 1:
        username = user.username
    else:
        username = parts[0].lower()
    return mark_safe('<span title="%s">%s</span>' % (
        escape(user.username),
        escape(username),
    ))


@register.inclusion_tag('sentry/includes/captcha.html')
def load_captcha():
    return {
        'api_key': settings.RECAPTCHA_PUBLIC_KEY,
    }


@register.filter
def soft_break(value, length):
    return _soft_break(
        value,
        length,
        functools.partial(soft_hyphenate, length=max(length // 10, 10)),
    )
