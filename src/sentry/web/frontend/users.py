"""
sentry.web.frontend.users
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.models import TagValue, GroupTag
from sentry.web.decorators import login_required, has_access
from sentry.web.helpers import render_to_response

DEFAULT_SORT_OPTION = 'recent'
SORT_OPTIONS = {
    'recent': 'Last Seen',
    'newest': 'First Seen',
    'events': 'Number of Events',
}


@has_access
@login_required
def user_list(request, team):
    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    tag_list = TagValue.objects.filter(project__team=team, key='sentry:user')

    if sort == 'recent':
        tag_list = tag_list.order_by('-last_seen')
    elif sort == 'newest':
        tag_list = tag_list.order_by('-first_seen')
    elif sort == 'events':
        tag_list = tag_list.order_by('-num_events')

    return render_to_response('sentry/users/list.html', {
        'tag_list': tag_list,
        'team': team,
        'sort_label': SORT_OPTIONS[sort],
        'SECTION': 'users',
        'SORT_OPTIONS': SORT_OPTIONS,
    }, request)


@has_access
@login_required
def user_details(request, team, user_id):
    tag = TagValue.objects.get(
        project__team=team,
        key='sentry:user',
        id=user_id,
    )

    event_list = GroupTag.objects.filter(
        project__team=team,
        key='sentry:user',
        value=tag.value,
    )

    return render_to_response('sentry/users/details.html', {
        'team': team,
        'tag': tag,
        'event_list': event_list,
        'SECTION': 'users',
    }, request)
