"""
sentry.templatetags.sentry_helpers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
# XXX: Import django-paging's template tags so we don't have to worry about
#      INSTALLED_APPS

import datetime
import os.path

from collections import namedtuple
from paging.helpers import paginate as paginate_func
from pkg_resources import parse_version as Version
from urllib import quote

from django import template
from django.template import RequestContext
from django.template.defaultfilters import stringfilter
from django.template.loader import render_to_string
from django.utils.html import escape
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext as _

from sentry.constants import STATUS_MUTED, EVENTS_PER_PAGE, MEMBER_OWNER
from sentry.models import Team, Group, Option
from sentry.web.helpers import group_is_public
from sentry.utils import to_unicode
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.http import absolute_uri
from sentry.utils.javascript import to_json
from sentry.utils.safe import safe_execute
from sentry.utils.strings import truncatechars
from templatetag_sugar.register import tag
from templatetag_sugar.parser import Name, Variable, Constant, Optional

SentryVersion = namedtuple('SentryVersion', ['current', 'latest',
                                             'update_available'])


register = template.Library()

truncatechars = register.filter(stringfilter(truncatechars))
truncatechars.is_safe = True

register.filter(to_json)

register.simple_tag(absolute_uri)


@register.filter
def pprint(value, break_after=10):
    """
    break_after is used to define how often a <span> is
    inserted (for soft wrapping).
    """

    value = to_unicode(value)
    return mark_safe(u'<span></span>'.join(
        [escape(value[i:(i + break_after)]) for i in xrange(0, len(value), break_after)]
    ))


@register.filter
def is_url(value):
    if not isinstance(value, basestring):
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
def get_sentry_version(context):
    import sentry
    current = sentry.get_version()

    latest = Option.objects.get_value('sentry:latest_version', current)
    update_available = Version(latest) > Version(current)

    context['sentry_version'] = SentryVersion(
        current, latest, update_available
    )
    return ''


@register.filter
def timesince(value, now=None):
    from django.template.defaultfilters import timesince
    from django.utils import timezone
    if now is None:
        now = timezone.now()
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
def is_bookmarked(group, user):
    if user.is_authenticated():
        return group.bookmark_set.filter(
            user=user,
            group=group,
        ).exists()
    return False


@register.filter
def date(datetime, arg=None):
    from django.template.defaultfilters import date
    from django.utils import timezone
    if not timezone.is_aware(datetime):
        datetime = datetime.replace(tzinfo=timezone.utc)
    return date(datetime, arg)


@tag(register, [Constant('for'), Variable('user'),
                Constant('from'), Variable('project'),
                Constant('as'), Name('asvar')])
def get_project_dsn(context, user, project, asvar):
    from sentry.models import ProjectKey

    if not user.is_authenticated():
        context[asvar] = None
        return ''

    try:
        key = ProjectKey.objects.filter(user=None, project=project)[0]
    except ProjectKey.DoesNotExist:
        try:
            key = ProjectKey.objects.get(user=user, project=project)
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
                Optional([Constant('size'), Variable('size')]),
                Optional([Constant('default'), Variable('default')])])
def gravatar_url(context, email, size=None, default='mm'):
    return get_gravatar_url(email, size, default)


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

    if group_list:
        historical_data = Group.objects.get_chart_data_for_group(
            instances=group_list,
            max_days=1,
            key='group',
        )
    else:
        historical_data = {}

    for g in group_list:
        yield g, {
            'is_bookmarked': g.pk in bookmarks,
            'historical_data': ','.join(str(x[1]) for x in historical_data.get(g.id, [])),
        }


@register.inclusion_tag('sentry/plugins/bases/tag/widget.html')
def render_tag_widget(group, tag):
    return {
        'title': tag.replace('_', ' ').title(),
        'tag_name': tag,
        'unique_tags': list(group.get_unique_tags(tag)[:10]),
        'group': group,
    }


@register.filter
def titlize(value):
    return value.replace('_', ' ').title()


@register.filter
def is_muted(value):
    return value == STATUS_MUTED


@register.filter
def split(value, delim=''):
    return value.split(delim)


@register.filter
def get_rendered_interfaces(event, request):
    interface_list = []
    is_public = group_is_public(event.group, request.user)
    for interface in event.interfaces.itervalues():
        html = safe_execute(interface.to_html, event, is_public=is_public)
        if not html:
            continue
        interface_list.append((interface, mark_safe(html)))
    return sorted(interface_list, key=lambda x: x[0].get_display_score(), reverse=True)


@register.inclusion_tag('sentry/partial/github_button.html')
def github_button(user, repo):
    return {
        'user': user,
        'repo': repo,
    }


@register.inclusion_tag('sentry/partial/data_values.html')
def render_values(value, threshold=5, collapse_to=3):
    if isinstance(value, (list, tuple)):
        value = dict(enumerate(value))
        is_list, is_dict = True, True
    else:
        is_list, is_dict = False, isinstance(value, dict)

    context = {
        'is_dict': is_dict,
        'is_list': is_list,
        'threshold': threshold,
        'collapse_to': collapse_to,
    }

    if is_dict:
        value = sorted(value.iteritems())
        value_len = len(value)
        over_threshold = value_len > threshold
        if over_threshold:
            context.update({
                'over_threshold': over_threshold,
                'hidden_values': value_len - collapse_to,
                'value_before_expand': value[:collapse_to],
                'value_after_expand': value[collapse_to:],
            })
        else:
            context.update({
                'over_threshold': over_threshold,
                'hidden_values': 0,
                'value_before_expand': value,
                'value_after_expand': [],
            })

    else:
        context['value'] = value

    return context


@register.inclusion_tag('sentry/partial/_client_config.html')
def client_help(user, project):
    from sentry.web.frontend.docs import get_key_context

    context = get_key_context(user, project)
    context['project'] = project
    return context


@tag(register, [Constant('from'), Variable('project'),
                Constant('as'), Name('asvar')])
def recent_alerts(context, project, asvar):
    from sentry.models import Alert

    context[asvar] = list(Alert.get_recent_for_project(project.id))

    return ''


@register.filter
def reorder_teams(team_list, team):
    pending = []
    for t, p_list in team_list:
        if t == team:
            pending.insert(0, (t, p_list))
        else:
            pending.append((t, p_list))
    return pending


@register.filter
def urlquote(value, safe=''):
    return quote(value.encode('utf8'), safe)


@register.filter
def basename(value):
    return os.path.basename(value)


@register.filter
def can_admin_team(user, team):
    if user.is_superuser:
        return True
    if team.owner == user:
        return True
    if team.slug in Team.objects.get_for_user(user, access=MEMBER_OWNER):
        return True
    return False


@register.filter
def user_display_name(user):
    return user.first_name or user.username
