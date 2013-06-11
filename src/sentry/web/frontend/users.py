"""
sentry.web.frontend.users
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.models import TagValue, Group
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
def user_list(request, team, project):
    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    tag_list = TagValue.objects.filter(project=project, key='sentry:user')

    if sort == 'recent':
        tag_list = tag_list.order_by('-last_seen')
    elif sort == 'newest':
        tag_list = tag_list.order_by('-first_seen')
    elif sort == 'events':
        tag_list = tag_list.order_by('-times_seen')

    return render_to_response('sentry/users/list.html', {
        'team': team,
        'project': project,
        'tag_list': tag_list,
        'sort_label': SORT_OPTIONS[sort],
        'SECTION': 'users',
        'SORT_OPTIONS': SORT_OPTIONS,
    }, request)


@has_access
@login_required
def user_details(request, team, project, user_id):
    tag = TagValue.objects.get(
        project=project,
        key='sentry:user',
        id=user_id,
    )

    event_list = Group.objects.filter(
        grouptag__project=project,
        grouptag__key='sentry:user',
        grouptag__value=tag.value,
    )

    return render_to_response('sentry/users/details.html', {
        'team': team,
        'project': project,
        'tag': tag,
        'event_list': event_list,
        'SECTION': 'users',
    }, request)
